
/** Static orb mark (app icon glyph, small brand spots). Inherits currentColor. */
export function SporkOrb({ size = 24, color = "currentColor" }: { size?: number; color?: string }) {
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} role="img" aria-label="Spork">
      <circle cx="50" cy="50" r="38" fill="none" stroke={color} strokeWidth={12} />
      {[37, 50, 63].map((x) => (
        <line key={x} x1={x} y1={38} x2={x} y2={60} stroke={color} strokeWidth={9} strokeLinecap="round" />
      ))}
    </svg>
  );
}
