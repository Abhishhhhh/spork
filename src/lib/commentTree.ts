export interface CommentRow {
  id: string
  user_id: string
  parent_comment_id: string | null
  body: string
  created_at: string
}

/**
 * Turns a flat list of comment rows into a two-level tree: top-level
 * comments, each carrying its own replies sorted oldest-first. Generic
 * over T so a caller can attach extra fields (e.g. author info) before
 * grouping and get them back untouched on both the top-level comment and
 * its replies. A reply whose parent isn't present in `rows` at all (e.g.
 * a data inconsistency) is silently dropped rather than surfaced as its
 * own top-level item — nothing in this app should ever produce one, since
 * the RLS insert policy requires a real, non-reply parent to exist
 * (spec §4), but the function itself doesn't assume that invariant holds.
 */
export function groupComments<T extends CommentRow>(rows: T[]): (T & { replies: T[] })[] {
  const topLevel = rows.filter((r) => r.parent_comment_id === null)

  const repliesByParent = new Map<string, T[]>()
  for (const row of rows) {
    if (row.parent_comment_id === null) continue
    const list = repliesByParent.get(row.parent_comment_id) ?? []
    list.push(row)
    repliesByParent.set(row.parent_comment_id, list)
  }

  return topLevel
    .slice()
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((top) => ({
      ...top,
      replies: (repliesByParent.get(top.id) ?? []).slice().sort((a, b) => a.created_at.localeCompare(b.created_at)),
    }))
}
