export function ForkLogo({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M7 2.5v5.5" />
      <path d="M10 2.5v5.5" />
      <path d="M13 2.5v5.5" />
      <path d="M7 8a3 3 0 0 0 6 0" />
      <path d="M10 8v13" />
    </svg>
  )
}
