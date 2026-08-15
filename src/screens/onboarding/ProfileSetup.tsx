import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { isValidUsernameFormat } from '../../lib/username'
import { useOnboardingStore } from '../../store/onboardingStore'
import { OnboardingProgress } from '../../components/OnboardingProgress'

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

    const normalizedUsername = username.trim().toLowerCase()

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
    navigate('/onboarding/goal')
  }

  return (
    <div className="flex min-h-screen flex-col px-6 py-8">
      <button
        onClick={() => navigate('/welcome')}
        aria-label="Back"
        className="mb-6 flex h-9 w-9 items-center justify-center rounded-full border border-border text-primary"
      >
        ←
      </button>
      <OnboardingProgress step={1} total={4} />

      <h1 className="mb-2 text-2xl font-bold text-primary">Set up your profile</h1>
      <p className="mb-8 text-sm text-muted">This is what friends see on the feed.</p>

      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <label className="mx-auto mb-2 flex h-24 w-24 cursor-pointer items-center justify-center overflow-hidden rounded-full bg-border/60 text-center text-sm text-muted">
          {avatarPreviewUrl ? (
            <img src={avatarPreviewUrl} alt="" className="h-24 w-24 object-cover" />
          ) : (
            'Add photo'
          )}
          <input
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
          />
        </label>
        <input
          placeholder="Your name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-full bg-border/60 px-5 py-3 text-base text-primary placeholder:text-muted"
        />
        <input
          placeholder="@ username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="rounded-full bg-border/60 px-5 py-3 text-base text-primary placeholder:text-muted"
        />
        {error && <p className="text-sm text-error">{error}</p>}
        <button
          type="submit"
          disabled={checking}
          className="rounded-full bg-primary py-3 text-base font-semibold text-background disabled:opacity-50"
        >
          {checking ? 'Checking…' : 'Continue'}
        </button>
      </form>
    </div>
  )
}
