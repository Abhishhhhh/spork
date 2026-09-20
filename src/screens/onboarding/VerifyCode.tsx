import { useEffect, useRef, useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { TopBar } from '../../components/TopBar'
import { routeAfterSignIn, sendEmailCode, verifyEmailCode } from '../../lib/auth'
import { supabase } from '../../lib/supabase'

const CODE_LENGTH = 6
const RESEND_SECONDS = 45

interface LocationState { email?: string; back?: string }

/**
 * "Check your inbox" — six code tiles backed by one invisible input so the
 * OS one-time-code autofill works. Verifies automatically on the 6th digit.
 */
export default function VerifyCode() {
  const navigate = useNavigate()
  const { state } = useLocation() as { state: LocationState | null }
  const email = state?.email ?? ''
  const back  = state?.back ?? '/sign-in'

  const [code, setCode]       = useState('')
  const [error, setError]     = useState<string | null>(null)
  const [busy, setBusy]       = useState(false)
  const [done, setDone]       = useState(false)
  const [cooldown, setCooldown] = useState(RESEND_SECONDS)
  const inputRef = useRef<HTMLInputElement>(null)
  const verifyingRef = useRef(false)

  useEffect(() => { inputRef.current?.focus() }, [])
  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  async function verify(value: string) {
    if (verifyingRef.current) return
    verifyingRef.current = true
    setBusy(true)
    setError(null)
    const { error: verifyError } = await verifyEmailCode(email, value)
    if (verifyError) {
      verifyingRef.current = false
      setBusy(false)
      setError(verifyError)
      setCode('')
      inputRef.current?.focus()
      return
    }
    setDone(true)
    const { data } = await supabase.auth.getUser()
    const next = data.user ? await routeAfterSignIn(data.user.id) : '/home/feed'
    navigate(next, { replace: true })
  }

  function onChange(raw: string) {
    const digits = raw.replace(/\D/g, '').slice(0, CODE_LENGTH)
    setCode(digits)
    if (error) setError(null)
    if (digits.length === CODE_LENGTH) void verify(digits)
  }

  async function resend() {
    if (cooldown > 0 || busy) return
    setError(null)
    const { error: sendError } = await sendEmailCode(email)
    if (sendError) { setError(sendError); return }
    setCooldown(RESEND_SECONDS)
    setCode('')
    inputRef.current?.focus()
  }

  if (!email) return <Navigate to={back} replace />

  return (
    <div className="screen min-h-screen animate-fade-in">
      <TopBar title="Spork" back={back} />

      <div className="icon-box mx-auto" style={{ width: 120, height: 120, fontSize: 52, marginTop: 24 }}>✉︎</div>
      <div style={{ height: 28 }} />

      <h2>Check your inbox.</h2>
      <p className="muted">We sent a sign-in code to <b className="text-ink">{email}</b></p>
      <div style={{ height: 24 }} />

      {/* One real input (for autofill + keyboard) rendered as six tiles */}
      <label className="relative block cursor-text" onClick={() => inputRef.current?.focus()}>
        <span className="sr-only">6-digit code</span>
        <input
          ref={inputRef}
          value={code}
          onChange={(e) => onChange(e.target.value)}
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={CODE_LENGTH}
          disabled={busy}
          aria-label="6-digit code"
          className="absolute inset-0 h-full w-full opacity-0"
          style={{ caretColor: 'transparent' }}
        />
        <span className="grid grid-cols-6 gap-2" aria-hidden="true">
          {Array.from({ length: CODE_LENGTH }, (_, i) => {
            const active = i === code.length && !busy
            return (
              <span key={i}
                className="grid place-items-center rounded-[19px] bg-paper font-display"
                style={{ height: 64, fontSize: 28, boxShadow: active ? 'inset 0 0 0 1.5px var(--color-ink)' : error ? 'inset 0 0 0 1.5px var(--color-error)' : undefined }}>
                {code[i] ?? ''}
              </span>
            )
          })}
        </span>
      </label>

      {error && <p className="error-text">{error}</p>}

      <button type="button" onClick={() => code.length === CODE_LENGTH && verify(code)} disabled={busy || code.length < CODE_LENGTH} className="btn">
        {done ? 'You’re all set →' : busy ? 'Checking…' : 'Continue →'}
      </button>

      <button type="button" onClick={resend} disabled={cooldown > 0 || busy} className="btn ghost">
        {cooldown > 0 ? `Send a new code in 0:${String(cooldown).padStart(2, '0')}` : 'Send a new code'}
      </button>
      <p className="hint">Wrong email? <button type="button" onClick={() => navigate(back)} className="underline text-ink">Go back</button></p>
    </div>
  )
}
