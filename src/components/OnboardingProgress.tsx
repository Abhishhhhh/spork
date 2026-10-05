import { useNavigate } from 'react-router-dom'

/**
 * Plan-step header: round back button + a thin progress line. Replaces the
 * old "Your plan" title bar and "01 / 06" counter on the six plan steps.
 */
export function OnboardingProgress({ step, total, back }: { step: number; total: number; back?: string | null }) {
  const navigate = useNavigate()
  return (
    <div className="onb-head">
      {back === null ? <span style={{ width: 42 }} /> : (
        <button type="button" onClick={() => (back ? navigate(back) : navigate(-1))} aria-label="Back" className="circle">←</button>
      )}
      <div className="line" role="progressbar" aria-label={`Step ${step} of ${total}`} aria-valuenow={step} aria-valuemin={1} aria-valuemax={total}>
        <i style={{ width: `${Math.round((step / total) * 100)}%` }} />
      </div>
    </div>
  )
}
