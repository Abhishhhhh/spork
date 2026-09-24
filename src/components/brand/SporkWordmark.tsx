import "./spork-motion.css";

/**
 * Spork wordmark: "sp" + orb (the o as a plate with three tines) + "rk".
 *
 * play="once"  → ring draws, tines drop, "sp"/"rk" slide out from behind the o, then it STAYS (Welcome screen, Splash).
 * play="loop"  → repeats every 3.8s (only for previews).
 * play="none"  → static, no motion.
 * Respects prefers-reduced-motion (shows the finished wordmark).
 *
 * `size` is the font size in px. Letters render in the app's headline font: pass it via `fontFamily`
 * (design used Quicksand 700; Spork uses Fredoka 500 for headings, so that is the default here).
 */
type Props = {
  size?: number;
  color?: string;
  play?: "once" | "loop" | "none";
  fontFamily?: string;
  className?: string;
};

export function SporkWordmark({ size = 34, color = "var(--color-ink)", play = "once", fontFamily = "var(--font-display)", className = "" }: Props) {
  const mode = play === "once" ? "wk-once" : play === "none" ? "wk-still" : "";
  return (
    <div
      role="img"
      aria-label="Spork"
      className={`wk ${mode} ${className}`}
      style={{ display: "inline-flex", alignItems: "baseline", color, fontFamily, fontWeight: 500, letterSpacing: "-0.035em", fontSize: size, lineHeight: 1 }}
    >
      <span className="wk-clip" aria-hidden="true"><span className="wk-l">sp</span></span>
      <span style={{ display: "inline-flex", margin: "0 0.02em", transform: "translateY(0.035em)" }}>
        <span className="wk-orb" style={{ display: "flex" }}>
          <svg viewBox="0 0 100 100" width="0.6em" height="0.6em" aria-hidden="true" style={{ overflow: "visible", display: "block" }}>
      <circle className="wk-ring" cx="50" cy="50" r="38" fill="none" stroke="currentColor" strokeWidth={12} strokeLinecap="round" pathLength={1} transform="rotate(-90 50 50)" />
      {[37, 50, 63].map((x, i) => (
        <line key={x} className={`wk-t wk-t${i}`} x1={x} y1={38} x2={x} y2={60} stroke="currentColor" strokeWidth={9} strokeLinecap="round" />
      ))}
    </svg>
        </span>
      </span>
      <span className="wk-clip" aria-hidden="true"><span className="wk-r">rk</span></span>
    </div>
  );
}
