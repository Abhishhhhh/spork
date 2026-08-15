export function OnboardingProgress({ step, total }: { step: number; total: number }) {
  return (
    <div className="mb-8 flex gap-2">
      {Array.from({ length: total }, (_, i) => (
        <div key={i} className={`h-1.5 flex-1 rounded-full ${i < step ? 'bg-primary' : 'bg-border'}`} />
      ))}
    </div>
  )
}
