import "./spork-motion.css";

/**
 * "Building your plan" loader — the orb on its own: ring draws, three tines drop, hold, fade, repeat (3.8s).
 * Replaces the ✳ placeholder: put it inside the existing 120×120 #333 tile at size 60.
 */
export function SporkLoader({ size = 60, color = "var(--color-ink)", label = "Building your plan" }: { size?: number; color?: string; label?: string }) {
  return (
    <div role="img" aria-label={label} className="wk" style={{ display: "flex", color, fontSize: size / 0.6 }}>
      <span className="wk-orb" style={{ display: "flex" }}>
        <svg viewBox="0 0 100 100" width="0.6em" height="0.6em" aria-hidden="true" style={{ overflow: "visible", display: "block" }}>
      <circle className="wk-ring" cx="50" cy="50" r="38" fill="none" stroke="currentColor" strokeWidth={12} strokeLinecap="round" pathLength={1} transform="rotate(-90 50 50)" />
      {[37, 50, 63].map((x, i) => (
        <line key={x} className={`wk-t wk-t${i}`} x1={x} y1={38} x2={x} y2={60} stroke="currentColor" strokeWidth={9} strokeLinecap="round" />
      ))}
    </svg>
      </span>
    </div>
  );
}
