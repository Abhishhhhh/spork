import { useNavigate } from 'react-router-dom'

interface TopBarProps {
  title: string
  /** Route to go back to. Omit for history back, `null` to hide the back button. */
  back?: string | null
  right?: React.ReactNode
}

/** Spork header bar — circle back button · Fredoka title · optional right slot. */
export function TopBar({ title, back, right }: TopBarProps) {
  const navigate = useNavigate()
  return (
    <div className="topbar">
      {back === null ? (
        <span style={{ width: 42 }} />
      ) : (
        <button
          type="button"
          onClick={() => (back ? navigate(back) : navigate(-1))}
          aria-label="Back"
          className="circle"
        >
          ←
        </button>
      )}
      <span className="clay">{title}</span>
      {right ?? <span style={{ width: 42 }} />}
    </div>
  )
}
