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

type Step = 'capture' | 'loading' | 'edit'

export default function LogFlow() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { session } = useSession()
  const { data: user } = useCurrentUser()
  const [step, setStep] = useState<Step>(() => (useLogDraftStore.getState().estimate ? 'edit' : 'capture'))
  const [posting, setPosting] = useState(false)
  const [postError, setPostError] = useState<string | null>(null)
  const [celebrating, setCelebrating] = useState(false)
  const celebrationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (celebrationTimeoutRef.current) clearTimeout(celebrationTimeoutRef.current)
    }
  }, [])

  const photoFile = useLogDraftStore((s) => s.photoFile)
  const applyEstimate = useLogDraftStore((s) => s.applyEstimate)
  const reset = useLogDraftStore((s) => s.reset)
  // Guards against the in-flight estimateMeal() call resolving after the
  // user has already tapped "Skip — enter manually" and started editing
  // fields by hand — without this, the late result would silently
  // overwrite whatever they'd already typed (final review re-review
  // finding, fix wave 1).
  const estimateRequestIdRef = useRef(0)

  async function handleGetEstimate() {
    if (!photoFile) return
    const requestId = ++estimateRequestIdRef.current
    setStep('loading')
    const result = await estimateMeal(photoFile, useLogDraftStore.getState().description)
    if (estimateRequestIdRef.current !== requestId) return
    applyEstimate(result, suggestMealType(new Date()), user?.privacy_default ?? 'public')
    setStep('edit')
  }

  async function handlePost() {
    if (!session || !user || !photoFile) return
    setPosting(true)
    setPostError(null)

    try {
      const draft = useLogDraftStore.getState()
      await postLog({
        userId: session.user.id,
        photoFile,
        mealName: draft.mealName,
        description: draft.description,
        mealType: draft.mealType,
        visibility: draft.visibility,
        estimate: draft.estimate,
        finalCalories: draft.calories,
        finalProteinG: draft.proteinG,
        finalCarbsG: draft.carbsG,
        finalFatG: draft.fatG,
        currentStreakCount: user.streak_count,
        currentStreakLastLogDate: user.streak_last_log_date,
      })

      queryClient.invalidateQueries({ queryKey: ['currentUser'] })
      queryClient.invalidateQueries({ queryKey: ['feed'] })
      queryClient.invalidateQueries({ queryKey: ['friendProfile'] })

      // Only clear the draft on success — a failed attempt leaves
      // everything in place so the retry (Post button, re-enabled below)
      // has the same photo/fields to work with (spec §8: the in-progress
      // draft must survive a failed post).
      reset()
      setCelebrating(true)
      celebrationTimeoutRef.current = setTimeout(() => navigate('/home/feed'), 700)
    } catch {
      setPostError("Couldn't post — check your connection and try again.")
    } finally {
      setPosting(false)
    }
  }

  if (celebrating) {
    return (
      <div className="flex min-h-[calc(100vh-5rem)] flex-col items-center justify-center gap-2">
        <p className="text-4xl">🔥</p>
        <p className="text-lg font-semibold text-primary">Logged!</p>
      </div>
    )
  }

  if (step === 'capture') return <Capture onGetEstimate={handleGetEstimate} />

  if (step === 'loading') {
    return (
      <div className="flex min-h-[calc(100vh-5rem)] flex-col items-center justify-center gap-4 px-6">
        <p className="text-muted">Estimating…</p>
        <button
          onClick={() => {
            estimateRequestIdRef.current++ // invalidate the in-flight handleGetEstimate call, if any
            applyEstimate(null, suggestMealType(new Date()), user?.privacy_default ?? 'public')
            setStep('edit')
          }}
          className="text-sm font-semibold text-primary underline"
        >
          Skip — enter manually
        </button>
      </div>
    )
  }

  return (
    <EstimateEdit onBack={() => setStep('capture')} onPost={handlePost} posting={posting} postError={postError} />
  )
}
