import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useCurrentUser } from '../../hooks/useCurrentUser'
import { useUpdateProfile } from '../../hooks/useProfile'
import { useLogDraftStore } from '../../store/logDraft'
import { useOnboardingStore } from '../../store/onboardingStore'
import { ThemeToggle } from '../../components/ThemeToggle'
import { Skeleton } from '../../components/Skeleton'
import { useToast } from '../../components/Toast'

export default function SettingsScreen() {
  const navigate      = useNavigate()
  const queryClient   = useQueryClient()
  const { data: user, isLoading } = useCurrentUser()
  const updateProfile = useUpdateProfile()
  const { toast }     = useToast()

  const [calorieGoalVal, setCalorieGoalVal] = useState('')
  const [proteinGoalVal, setProteinGoalVal] = useState('')
  const [reminderTime,   setReminderTime]   = useState('')

  if (isLoading) {
    return (
      <div className="flex flex-col px-5 pt-6 gap-4 animate-fade-in">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-12 rounded-2xl" />
        <Skeleton className="h-12 rounded-2xl" />
        <Skeleton className="h-12 rounded-2xl" />
      </div>
    )
  }
  if (!user) return null

  const calorieGoal = user.calorie_goal ?? 2000
  const proteinGoal = (user as unknown as { protein_goal?: number }).protein_goal ?? 0

  function saveField(fields: Parameters<typeof updateProfile.mutate>[0]) {
    updateProfile.mutate(fields, {
      onSuccess: () => toast('Saved ✓'),
      onError:   () => toast('Could not save — try again', 'error'),
    })
  }

  async function handleSignOut() {
    if (!window.confirm('Sign out of Spork?')) return
    await supabase.auth.signOut()
    queryClient.clear()
    useLogDraftStore.getState().reset()
    useOnboardingStore.getState().reset()
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-5rem)] pb-8">

      {/* ── Sticky header ─────────────────────────────────────────── */}
      <div className="sticky top-0 z-10 flex items-center gap-3 bg-background/95 px-5 py-3.5 backdrop-blur-sm border-b border-border/40">
        <button onClick={() => navigate(-1)} aria-label="Back"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-surface shadow-[var(--shadow-card)] text-primary">
          ←
        </button>
        <h1 className="text-base font-bold text-primary">Settings</h1>
      </div>

      <div className="flex flex-col divide-y divide-border/40 mx-5 mt-5">

        {/* ── Appearance ─────────────────────────────────────────── */}
        <div className="pb-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Appearance</p>
          <div className="card px-4 py-3">
            <p className="text-sm font-semibold text-primary mb-3">Theme</p>
            <ThemeToggle />
          </div>
        </div>

        {/* ── Nutrition goals ────────────────────────────────────── */}
        <div className="py-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Nutrition goals</p>
          <div className="card divide-y divide-border/40 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3">
              <p className="text-sm font-semibold text-primary">Daily calories</p>
              <input
                type="number"
                value={calorieGoalVal || calorieGoal}
                onChange={(e) => setCalorieGoalVal(e.target.value)}
                onBlur={() => {
                  const n = Number(calorieGoalVal)
                  if (n >= 800 && n <= 6000) saveField({ calorie_goal: n })
                  setCalorieGoalVal('')
                }}
                className="w-20 rounded-xl bg-surface border border-border/60 px-2 py-1 text-right text-sm font-bold text-primary placeholder:text-muted"
              />
            </div>
            <div className="flex items-center justify-between px-4 py-3">
              <p className="text-sm font-semibold text-primary">Daily protein (g)</p>
              <input
                type="number"
                value={proteinGoalVal || proteinGoal || ''}
                placeholder="0"
                onChange={(e) => setProteinGoalVal(e.target.value)}
                onBlur={() => {
                  const n = Number(proteinGoalVal)
                  if (n >= 0 && n <= 500) saveField({ protein_goal: n })
                  setProteinGoalVal('')
                }}
                className="w-20 rounded-xl bg-surface border border-border/60 px-2 py-1 text-right text-sm font-bold text-primary placeholder:text-muted"
              />
            </div>
          </div>
        </div>

        {/* ── Privacy ───────────────────────────────────────────── */}
        <div className="py-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Privacy</p>
          <div className="card divide-y divide-border/40 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-primary">Posts visible to friends</p>
                <p className="text-xs text-muted">
                  {user.privacy_default === 'public' ? 'Public by default' : 'Private by default'}
                </p>
              </div>
              <button
                onClick={() => saveField({ privacy_default: user.privacy_default === 'public' ? 'private' : 'public' })}
                className={`h-7 w-12 rounded-full transition-colors ${user.privacy_default === 'public' ? 'bg-primary' : 'bg-border'}`}
              >
                <span className={`block h-5 w-5 rounded-full bg-background transition-transform mx-auto ${user.privacy_default === 'public' ? 'translate-x-2.5' : '-translate-x-2.5'}`} />
              </button>
            </div>
          </div>
        </div>

        {/* ── Reminders ─────────────────────────────────────────── */}
        <div className="py-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Reminders</p>
          <div className="card divide-y divide-border/40 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3">
              <div>
                <p className="text-sm font-semibold text-primary">Daily logging reminder</p>
                <p className="text-xs text-muted">UI only — no push notification yet</p>
              </div>
              <input
                type="time"
                value={reminderTime || user.reminder_time || ''}
                onChange={(e) => setReminderTime(e.target.value)}
                onBlur={() => { if (reminderTime) saveField({ reminder_time: reminderTime }) }}
                className="rounded-xl bg-surface border border-border/60 px-2 py-1 text-sm text-primary"
              />
            </div>
          </div>
        </div>

        {/* ── Account ───────────────────────────────────────────── */}
        <div className="py-5">
          <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted">Account</p>
          <div className="card divide-y divide-border/40 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3">
              <p className="text-sm font-semibold text-primary">Email</p>
              <p className="text-sm text-muted">{user.username}</p>
            </div>
            <button
              onClick={handleSignOut}
              className="flex w-full items-center justify-between px-4 py-3 text-left"
            >
              <p className="text-sm font-semibold text-error">Sign out</p>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4 text-error">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
            </button>
          </div>
        </div>

      </div>
    </div>
  )
}
