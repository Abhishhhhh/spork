import { describe, expect, it } from 'vitest'
import { groupComments, type CommentRow } from './commentTree'

function comment(id: string, parentId: string | null, createdAt: string): CommentRow {
  return { id, user_id: 'u1', parent_comment_id: parentId, body: `body-${id}`, created_at: createdAt }
}

describe('groupComments', () => {
  it('returns an empty array for no comments', () => {
    expect(groupComments([])).toEqual([])
  })

  it('returns a single top-level comment with no replies', () => {
    const rows = [comment('a', null, '2026-08-16T10:00:00Z')]
    expect(groupComments(rows)).toEqual([{ ...rows[0], replies: [] }])
  })

  it('attaches replies to their parent, sorted oldest-first', () => {
    const rows = [
      comment('a', null, '2026-08-16T10:00:00Z'),
      comment('reply2', 'a', '2026-08-16T10:05:00Z'),
      comment('reply1', 'a', '2026-08-16T10:02:00Z'),
    ]
    const result = groupComments(rows)
    expect(result).toHaveLength(1)
    expect(result[0].id).toBe('a')
    expect(result[0].replies.map((r) => r.id)).toEqual(['reply1', 'reply2'])
  })

  it('sorts top-level comments oldest-first and keeps each groups replies separate', () => {
    const rows = [
      comment('b', null, '2026-08-16T11:00:00Z'),
      comment('a', null, '2026-08-16T10:00:00Z'),
      comment('reply-to-a', 'a', '2026-08-16T10:30:00Z'),
      comment('reply-to-b', 'b', '2026-08-16T11:30:00Z'),
    ]
    const result = groupComments(rows)
    expect(result.map((c) => c.id)).toEqual(['a', 'b'])
    expect(result[0].replies.map((r) => r.id)).toEqual(['reply-to-a'])
    expect(result[1].replies.map((r) => r.id)).toEqual(['reply-to-b'])
  })

  it('silently drops a reply whose parent is not in the row set', () => {
    const rows = [comment('orphan-reply', 'missing-parent', '2026-08-16T10:00:00Z')]
    expect(groupComments(rows)).toEqual([])
  })

  it('preserves extra fields the caller attached to each row', () => {
    const withAuthor = [{ ...comment('a', null, '2026-08-16T10:00:00Z'), author: { name: 'Maya' } }]
    const result = groupComments(withAuthor)
    expect(result[0].author).toEqual({ name: 'Maya' })
  })
})
