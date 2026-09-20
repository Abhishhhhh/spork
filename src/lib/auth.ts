import { supabase } from './supabase'
import { useOnboardingStore } from '../store/onboardingStore'

export const AUTH_CALLBACK_PATH = '/auth/callback'

/** Email a 6-digit sign-in code. Creates the auth user if the email is new. */
export async function sendEmailCode(email: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: `${window.location.origin}${AUTH_CALLBACK_PATH}` },
  })
  if (!error) return { error: null }
  const msg = error.message.toLowerCase()
  if (msg.includes('rate limit') || msg.includes('too many')) return { error: 'Too many codes requested — wait a minute and try again.' }
  return { error: error.message }
}

/** Exchange the emailed code for a session. */
export async function verifyEmailCode(email: string, code: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'email' })
  if (!error) return { error: null }
  const msg = error.message.toLowerCase()
  if (msg.includes('expired') || msg.includes('invalid')) return { error: 'That code isn’t right or has expired. Try again or send a new one.' }
  return { error: error.message }
}

/** Redirect to Google. The onboarding store is persisted, so the plan survives the round-trip. */
export async function signInWithGoogle(): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}${AUTH_CALLBACK_PATH}` },
  })
  return { error: error ? error.message : null }
}

/**
 * Where to send a freshly signed-in user:
 *   users row exists           → /home/feed         (returning user)
 *   no row, plan in store      → /onboarding/profile (finish account setup)
 *   no row, no plan            → /onboarding/basics  (build the plan first)
 */
export async function routeAfterSignIn(userId: string): Promise<string> {
  const { data: existing } = await supabase.from('users').select('id').eq('id', userId).maybeSingle()
  if (existing) return '/home/feed'
  return useOnboardingStore.getState().calorieGoal !== null ? '/onboarding/profile' : '/onboarding/basics'
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}
