/**
 * Computes the count delta to apply on top of the server's last-known
 * likeCount while an optimistic local override is in flight. The same
 * three-way ternary was duplicated across MealDetail.tsx, Feed.tsx, and
 * FriendProfile.tsx (final whole-branch review, 2026-08-16) — extracted
 * here as the one place this arithmetic can go subtly wrong.
 */
export function computeLikeDelta(optimistic: boolean | null | undefined, actual: boolean): -1 | 0 | 1 {
  if (optimistic === null || optimistic === undefined) return 0
  if (optimistic === actual) return 0
  return optimistic ? 1 : -1
}
