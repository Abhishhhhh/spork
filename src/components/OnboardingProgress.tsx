/** Thin progress bar + "01 / 06" step counter used on the six plan steps. */
export function OnboardingProgress({ step, total }: { step: number; total: number }) {
  return (
    <>
      <div className="progress" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={total}>
        <i style={{ width: `${Math.round((step / total) * 100)}%` }} />
      </div>
      <p className="step">{String(step).padStart(2, '0')} / {String(total).padStart(2, '0')}</p>
    </>
  )
}
