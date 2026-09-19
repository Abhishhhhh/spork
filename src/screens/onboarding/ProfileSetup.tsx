import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { isValidUsernameFormat } from '../../lib/username'
import { useOnboardingStore } from '../../store/onboardingStore'
import { TopBar } from '../../components/TopBar'

export default function ProfileSetup() {
  const navigate = useNavigate()
  const setProfile = useOnboardingStore((s) => s.setProfile)
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

  const avatarPreviewUrl = useMemo(() => (avatarFile ? URL.createObjectURL(avatarFile) : null), [avatarFile])

  useEffect(() => {
    if (!avatarPreviewUrl) return
    return () => URL.revokeObjectURL(avatarPreviewUrl)
  }, [avatarPreviewUrl])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)

    const normalizedUsername = username.trim().toLowerCase().replace(/^@/, '')

    if (!name.trim()) {
      setError('Name is required.')
      return
    }

    if (!isValidUsernameFormat(normalizedUsername)) {
      setError('Username must be 3-20 characters: lowercase letters, numbers, underscores.')
      return
    }

    setChecking(true)
    const { data: existing, error: lookupError } = await supabase
      .from('users')
      .select('id')
      .eq('username', normalizedUsername)
      .maybeSingle()
    setChecking(false)

    if (lookupError) {
      setError('Could not verify username availability. Try again.')
      return
    }

    if (existing) {
      setError('That username is already taken.')
      return
    }

    setProfile({ name: name.trim(), username: normalizedUsername, avatarFile })
    navigate('/onboarding/privacy')
  }

  const initial = (name.trim() || '?').charAt(0).toUpperCase()

  return (
    <div className="screen min-h-screen">
      <TopBar title="Your plan" back="/onboarding/create-account" />

      <h2>Set up your profile</h2>
      <p className="muted">Let your friends recognise you</p>
      <div style={{ height: 28 }} />

      <form onSubmit={handleSubmit}>
        <div className="text-center">
          <label className="inline-block cursor-pointer">
            {avatarPreviewUrl ? (
              <img src={avatarPreviewUrl} alt="" className="avatar bigavatar mx-auto" />
            ) : (
              <span className="avatar bigavatar mx-auto">{initial}</span>
            )}
            <input
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
            />
            <p className="small muted" style={{ marginTop: 10 }}>
              {avatarPreviewUrl ? 'Change profile photo' : 'Add profile photo'}
            </p>
          </label>
        </div>
        <div style={{ height: 28 }} />

        <div className="field">
          <label htmlFor="name">Your name</label>
          <input id="name" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
        </div>
        <div className="field">
          <label htmlFor="username">Username</label>
          <input id="username" placeholder="@username" value={username} onChange={(e) => setUsername(e.target.value)} autoCapitalize="none" autoComplete="username" />
        </div>

        {error && <p className="error-text">{error}</p>}

        <button type="submit" disabled={checking} className="btn">
          {checking ? 'Checking…' : 'Continue'}
        </button>
      </form>
    </div>
  )
}
