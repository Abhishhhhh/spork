import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { isValidUsernameFormat } from '../../lib/username'
import { useOnboardingStore } from '../../store/onboardingStore'

export default function ProfileSetup() {
  const navigate = useNavigate()
  const setProfile = useOnboardingStore((s) => s.setProfile)
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

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
    <div className="flex min-h-screen flex-col justify-center px-6">
      <h1 className="mb-8 text-2xl font-bold text-neutral-900">Set up your profile</h1>
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        <input
          placeholder="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="rounded-2xl border border-neutral-200 px-4 py-3 text-base"
        />
        <input
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="rounded-2xl border border-neutral-200 px-4 py-3 text-base"
        />
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
          className="text-sm text-neutral-500"
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={checking}
          className="rounded-2xl bg-orange-500 py-3 text-base font-semibold text-white disabled:opacity-50"
        >
          {checking ? 'Checking…' : 'Next'}
        </button>
      </form>
    </div>
  )
}
