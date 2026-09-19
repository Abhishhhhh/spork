import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useCurrentUser } from '../../hooks/useCurrentUser'
import { useUpdateProfile } from '../../hooks/useProfile'
import { useLogDraftStore } from '../../store/logDraft'
import { useOnboardingStore } from '../../store/onboardingStore'
import { ThemeToggle } from '../../components/ThemeToggle'
import { Skeleton } from '../../components/Skeleton'
import { useToast } from '../../components/Toast'
import { TopBar } from '../../components/TopBar'

export default function SettingsScreen() {
  const queryClient   = useQueryClient()
  const { data: user, isLoading } = useCurrentUser()
  const updateProfile = useUpdateProfile()
  const { toast }     = useToast()

  const [calorieGoalVal, setCalorieGoalVal] = useState('')
  const [proteinGoalVal, setProteinGoalVal] = useState('')
  const [reminderTime,   setReminderTime]   = useState('')

  if (isLoading) {
    return (
      <div className="animate-fade-in">
        <TopBar title="Settings" back="/home/profile" />
        <Skeleton className="h-16 !rounded-[27px]" />
        <Skeleton className="mt-3 h-28 !rounded-[27px]" />
        <Skeleton className="mt-3 h-16 !rounded-[27px]" />
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

  const inlineInput = 'editable w-20 bg-transparent text-right font-semibold outline-none'

  return (
    <div>
      <TopBar title="Settings" back="/home/profile" />

      {/* ── Appearance ─────────────────────────────────────────── */}
      <div className="section">
        <span className="caps">Appearance</span>
        <div className="card" style={{ margin: 0 }}>
          <div className="flex items-center justify-between">
            <b className="font-semibold">Theme</b>
            <ThemeToggle />
          </div>
        </div>
      </div>

      {/* ── Nutrition goals ────────────────────────────────────── */}
      <div className="section">
        <span className="caps">Nutrition goals</span>
        <div className="card" style={{ margin: 0 }}>
          <div className="flex items-center justify-between">
            <label htmlFor="cal-goal">Daily calories</label>
            <input
              id="cal-goal"
              type="number"
              inputMode="numeric"
              value={calorieGoalVal || calorieGoal}
              onChange={(e) => setCalorieGoalVal(e.target.value)}
              onBlur={() => {
                const n = Number(calorieGoalVal)
                if (n >= 800 && n <= 6000) saveField({ calorie_goal: n })
                setCalorieGoalVal('')
              }}
              className={inlineInput}
            />
          </div>
          <div className="divider" />
          <div className="flex items-center justify-between">
            <label htmlFor="protein-goal">Daily protein · g</label>
            <input
              id="protein-goal"
              type="number"
              inputMode="numeric"
              value={proteinGoalVal || proteinGoal || ''}
              placeholder="0"
              onChange={(e) => setProteinGoalVal(e.target.value)}
              onBlur={() => {
                const n = Number(proteinGoalVal)
                if (n >= 0 && n <= 500) saveField({ protein_goal: n })
                setProteinGoalVal('')
              }}
              className={inlineInput}
            />
          </div>
        </div>
      </div>

      {/* ── Privacy ───────────────────────────────────────────── */}
      <div className="section">
        <span className="caps">Privacy</span>
        <div className="card" style={{ margin: 0 }}>
          <div className="flex items-center justify-between">
            <span>
              <b className="block font-semibold">Posts visible to friends</b>
              <p className="small muted">{user.privacy_default === 'public' ? 'Public by default' : 'Private by default'}</p>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={user.privacy_default === 'public'}
              aria-label="Posts visible to friends"
              onClick={() => saveField({ privacy_default: user.privacy_default === 'public' ? 'private' : 'public' })}
              className={`switch ${user.privacy_default === 'public' ? '' : 'off'}`}
            />
          </div>
        </div>
      </div>

      {/* ── Reminders ─────────────────────────────────────────── */}
      <div className="section">
        <span className="caps">Reminders</span>
        <div className="card" style={{ margin: 0 }}>
          <div className="flex items-center justify-between">
            <span>
              <b className="block font-semibold">Daily logging reminder</b>
              <p className="tiny muted">UI only · no push notification yet</p>
            </span>
            <input
              type="time"
              value={reminderTime || user.reminder_time || ''}
              onChange={(e) => setReminderTime(e.target.value)}
              onBlur={() => { if (reminderTime) saveField({ reminder_time: reminderTime }) }}
              className="editable bg-transparent font-semibold outline-none"
              aria-label="Reminder time"
            />
          </div>
        </div>
      </div>

      {/* ── Account ───────────────────────────────────────────── */}
      <div className="section">
        <span className="caps">Account</span>
        <div className="card" style={{ margin: 0 }}>
          <div className="flex items-center justify-between">
            <span>Username</span>
            <span className="muted">@{user.username}</span>
          </div>
          <div className="divider" />
          <button type="button" onClick={handleSignOut} className="font-semibold">Sign out →</button>
        </div>
      </div>
    </div>
  )
}
