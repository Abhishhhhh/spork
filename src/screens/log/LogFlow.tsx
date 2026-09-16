import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import Capture from './Capture'
import EstimateEdit from './EstimateEdit'
import { useLogDraftStore } from '../../store/logDraft'
import { estimateMeal } from '../../lib/estimateMeal'
import { suggestMealType } from '../../lib/mealType'
import { postLog } from '../../lib/postLog'
import { useSession } from '../../hooks/useSession'
import { useCurrentUser } from '../../hooks/useCurrentUser'
import { useTodayStats } from '../../hooks/useTodayStats'
import { computeNextStreak, getEffectiveStreak } from '../../lib/streak'
import { hapticSuccess, hapticCelebration, hapticError } from '../../lib/haptics'

type Step = 'capture' | 'loading' | 'edit' | 'celebration'

interface CelebrationData {
  logId: string
  calories: number
  newStreakCount: number
  wasStreakBroken: boolean
  remaining: number
  calorieGoal: number
  mealName: string
}

export default function LogFlow() {
  const navigate      = useNavigate()
  const queryClient   = useQueryClient()
  const { session }   = useSession()
  const { data: user } = useCurrentUser()
  const { data: stats } = useTodayStats()

  const [step, setStep]         = useState<Step>(() => (useLogDraftStore.getState().estimate ? 'edit' : 'capture'))
  const [posting, setPosting]   = useState(false)
  const [postError, setPostError] = useState<string | null>(null)
  const [celebData, setCelebData] = useState<CelebrationData | null>(null)
  const estimateRequestIdRef    = useRef(0)

  const photoFile    = useLogDraftStore((s) => s.photoFile)
  const applyEstimate = useLogDraftStore((s) => s.applyEstimate)
  const reset        = useLogDraftStore((s) => s.reset)

  async function handleGetEstimate() {
    if (!photoFile) return
    const requestId = ++estimateRequestIdRef.current
    setStep('loading')
    const result = await estimateMeal(photoFile, useLogDraftStore.getState().description)
    if (estimateRequestIdRef.current !== requestId) return
    applyEstimate(result, suggestMealType(new Date()), user?.privacy_default ?? 'public')
    setStep('edit')
  }

  function handleSkipPhoto() {
    applyEstimate(null, suggestMealType(new Date()), user?.privacy_default ?? 'public')
    setStep('edit')
  }

  async function handlePost() {
    if (!session || !user) return
    setPosting(true)
    setPostError(null)

    try {
      const draft = useLogDraftStore.getState()
      const logId = await postLog({
        userId: session.user.id,
        photoFile,
        mealName: draft.mealName,
        description: draft.description,
        caption: draft.caption,
        mealType: draft.mealType,
        visibility: draft.visibility,
        satiety: draft.satiety,
        estimate: draft.estimate,
        finalCalories: draft.calories,
        finalProteinG: draft.proteinG,
        finalCarbsG: draft.carbsG,
        finalFatG: draft.fatG,
        currentStreakCount: user.streak_count,
        currentStreakLastLogDate: user.streak_last_log_date,
      })

      // Compute new streak for celebration display
      const { streak_count: newStreakCount } = computeNextStreak(
        user.streak_count,
        user.streak_last_log_date,
        new Date(),
      )
      const wasStreakBroken = getEffectiveStreak(user.streak_count, user.streak_last_log_date, new Date()) === 0
      const isStreakMilestone = [7, 30, 100].includes(newStreakCount)

      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ['currentUser'] })
      queryClient.invalidateQueries({ queryKey: ['feed'] })
      queryClient.invalidateQueries({ queryKey: ['todayStats'] })
      queryClient.invalidateQueries({ queryKey: ['friendProfile'] })

      const caloriesLogged = draft.calories ?? 0
      const calorieGoal = stats?.calorieGoal ?? user.calorie_goal ?? 2000
      const prevLogged  = stats?.caloriesLogged ?? 0
      const remaining   = Math.max(calorieGoal - prevLogged - caloriesLogged, 0)

      setCelebData({
        logId,
        calories: caloriesLogged,
        newStreakCount,
        wasStreakBroken,
        remaining,
        calorieGoal,
        mealName: draft.mealName,
      })
      reset()
      setStep('celebration')
      // Haptic — milestone gets celebration pulse, normal post gets success tap
      if (isStreakMilestone) hapticCelebration()
      else hapticSuccess()
    } catch {
      hapticError()
      setPostError("Couldn't post — check your connection and try again.")
    } finally {
      setPosting(false)
    }
  }

  if (step === 'capture') {
    return <Capture onGetEstimate={handleGetEstimate} onSkipPhoto={handleSkipPhoto} />
  }

  if (step === 'loading') {
    return <LoadingScreen onSkip={() => {
      estimateRequestIdRef.current++
      applyEstimate(null, suggestMealType(new Date()), user?.privacy_default ?? 'public')
      setStep('edit')
    }} photoFile={photoFile} />
  }

  if (step === 'edit') {
    return <EstimateEdit onBack={() => setStep('capture')} onPost={handlePost} posting={posting} postError={postError} />
  }

  if (step === 'celebration' && celebData) {
    return <CelebrationScreen data={celebData} onViewPost={() => navigate(`/home/log/${celebData.logId}`)} onDone={() => navigate('/home/feed')} />
  }

  return null
}

// ── Loading screen ───────────────────────────────────────────────────────────

function LoadingScreen({ onSkip, photoFile }: { onSkip: () => void; photoFile: File | null }) {
  const [dots, setDots] = useState('.')
  const previewUrl = photoFile ? URL.createObjectURL(photoFile) : null

  useEffect(() => {
    const id = setInterval(() => setDots((d) => (d.length >= 3 ? '.' : d + '.')), 500)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    return () => { if (previewUrl) URL.revokeObjectURL(previewUrl) }
  }, [previewUrl])

  return (
    <div className="relative flex min-h-[calc(100vh-5rem)] flex-col items-center justify-center gap-6 overflow-hidden">
      {/* Blurred photo backdrop */}
      {previewUrl && (
        <img src={previewUrl} alt="" className="absolute inset-0 h-full w-full object-cover opacity-20 blur-xl scale-110" />
      )}
      <div className="relative flex flex-col items-center gap-4 px-8 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-2xl animate-pulse">
          ✨
        </div>
        <p className="text-base font-semibold text-primary">Analysing your meal{dots}</p>
        <p className="text-sm text-muted">AI is identifying ingredients and estimating macros</p>
        <button onClick={onSkip} className="mt-4 rounded-full bg-surface shadow-[var(--shadow-card)] bg-background/80 px-5 py-2 text-sm font-medium text-primary">
          Skip — enter manually
        </button>
      </div>
    </div>
  )
}

// ── Celebration screen ───────────────────────────────────────────────────────

function CelebrationScreen({ data, onViewPost, onDone }: {
  data: CelebrationData
  onViewPost: () => void
  onDone: () => void
}) {
  const pct = data.calorieGoal > 0 ? Math.min(Math.round(((data.calorieGoal - data.remaining) / data.calorieGoal) * 100), 100) : 0
  const isStreakMilestone = [7, 30, 100].includes(data.newStreakCount)

  return (
    <div className="flex min-h-[calc(100vh-5rem)] flex-col items-center justify-center gap-6 px-6 text-center">
      {/* Emoji / milestone */}
      <div className="flex flex-col items-center gap-2">
        <p className="text-4xl">{isStreakMilestone ? '🏆' : '🔥'}</p>
        <h1 className="text-xl font-bold text-primary">
          {isStreakMilestone
            ? `${data.newStreakCount}-day streak! 🎉`
            : data.wasStreakBroken
            ? 'Streak back on track!'
            : 'Logged!'}
        </h1>
        {data.mealName && (
          <p className="text-sm text-muted">{data.mealName}</p>
        )}
      </div>

      {/* Calorie summary */}
      <div className="w-full card p-4 text-left">
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-primary">Today's budget</p>
          <p className="text-sm font-bold text-primary">{data.calories.toLocaleString()} kcal added</p>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-border mb-2">
          <div className="h-3 rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted">{pct}% of daily goal</p>
          {data.remaining > 0 ? (
            <p className="text-xs font-semibold text-primary">{data.remaining.toLocaleString()} kcal remaining</p>
          ) : (
            <p className="text-xs font-semibold text-error">Goal reached ✓</p>
          )}
        </div>
      </div>

      {/* Streak count */}
      <div className="flex items-center gap-3">
        <span className="text-xl">🔥</span>
        <div className="text-left">
          <p className="text-lg font-bold text-primary">{data.newStreakCount} day streak</p>
          {isStreakMilestone && (
            <p className="text-xs text-muted">You've hit a milestone!</p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex w-full flex-col gap-2">
        <button onClick={onViewPost}
          className="w-full rounded-full bg-surface shadow-[var(--shadow-card)] py-3 text-sm font-semibold text-primary">
          View post
        </button>
        <button onClick={onDone}
          className="w-full rounded-full bg-primary py-3 text-base font-semibold text-background">
          Back to feed
        </button>
      </div>
    </div>
  )
}
