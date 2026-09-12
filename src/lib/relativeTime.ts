/**
 * Returns a human-friendly relative time string.
 * "just now", "2m ago", "3h ago", "2d ago", "Mar 5"
 */
export function relativeTime(isoTimestamp: string): string {
  const now  = Date.now()
  const then = new Date(isoTimestamp).getTime()
  const diffMs = now - then

  if (diffMs < 60_000)                        return 'just now'
  if (diffMs < 60 * 60_000)                  return `${Math.floor(diffMs / 60_000)}m ago`
  if (diffMs < 24 * 60 * 60_000)             return `${Math.floor(diffMs / (60 * 60_000))}h ago`
  if (diffMs < 7 * 24 * 60 * 60_000)         return `${Math.floor(diffMs / (24 * 60 * 60_000))}d ago`

  return new Date(isoTimestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
