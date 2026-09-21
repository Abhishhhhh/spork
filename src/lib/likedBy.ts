/**
 * "Liked by @friend and 3 others" — names only the viewer's accepted
 * friends (never strangers who liked a friend's post), folds the rest into
 * a count. Pure so it can be unit-tested and shared by PostCard/MealDetail.
 *
 * `total` is the displayed count (may include the optimistic ±1), so the
 * "others" remainder stays consistent while a like is in flight.
 */
export function likedByLabel(input: {
  likerIds: string[]
  total: number
  viewerId: string | undefined
  viewerLiked: boolean
  friendUsernameById: Map<string, string>
}): string | null {
  const { likerIds, total, viewerId, viewerLiked, friendUsernameById } = input
  if (total <= 0) return null

  const friendNames: string[] = []
  for (const id of likerIds) {
    if (id === viewerId) continue
    const username = friendUsernameById.get(id)
    if (username) friendNames.push(`@${username}`)
    if (friendNames.length === 2) break
  }

  if (friendNames.length === 0) {
    if (viewerLiked && total === 1) return 'Liked by you'
    return `${total} ${total === 1 ? 'like' : 'likes'}`
  }

  const rest = Math.max(0, total - friendNames.length)
  const names = friendNames.length === 2 && rest > 0
    ? `${friendNames[0]}, ${friendNames[1]}`
    : friendNames.join(' and ')
  if (rest === 0) return `Liked by ${names}`
  return `Liked by ${names} and ${rest} ${rest === 1 ? 'other' : 'others'}`
}
