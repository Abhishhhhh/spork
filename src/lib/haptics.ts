/**
 * Haptic feedback via the Web Vibration API.
 *
 * Support: Android Chrome/Firefox ✅ — iOS Safari ❌ (silently ignored).
 * Always safe to call — guards against missing API and thrown errors.
 */

function vibrate(pattern: number | number[]) {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern)
    }
  } catch {
    // Silently ignore — vibration is enhancement-only
  }
}

/** Short double-tap — confirmation (post saved, action completed) */
export function hapticSuccess() {
  vibrate([30, 50, 30])
}

/** Single soft tap — light feedback (like, toggle) */
export function hapticLight() {
  vibrate(15)
}

/** Strong pulse — celebration (streak milestone, first meal) */
export function hapticCelebration() {
  vibrate([50, 40, 80, 40, 50])
}

/** Error thud — something went wrong */
export function hapticError() {
  vibrate([80, 60, 80])
}
