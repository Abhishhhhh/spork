import { beforeEach, expect, it, vi } from 'vitest'
const { from } = vi.hoisted(() => ({ from: vi.fn() }))
vi.mock('./supabase', () => ({ supabase: { from } }))
import { completeOnboarding } from './completeOnboarding'

const input = {
  userId: 'user-a',
  name: 'Sam',
  username: 'sam',
  avatarFile: null,
  calorieGoal: 2200,
  proteinGoal: 120,
  privacyDefault: 'private' as const,
  friendUsernamesToRequest: ['friend'],
}

const insertMock  = vi.fn()
const updateMock  = vi.fn()
const eqMock      = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()

  // chain: .from('users').insert(...)
  insertMock.mockResolvedValue({ error: null })
  updateMock.mockReturnValue({ eq: eqMock })
  eqMock.mockResolvedValue({ error: null })

  from.mockReturnValue({
    insert: insertMock,
    update: updateMock,
    select: vi.fn().mockReturnValue({
      in: vi.fn().mockResolvedValue({ data: [{ id: 'friend-id', username: 'friend' }], error: null }),
    }),
  })
})

it('inserts user row, best-effort protein_goal update, and sends friend requests', async () => {
  await expect(completeOnboarding(input)).resolves.toBeUndefined()

  // Core insert was called without protein_goal
  expect(insertMock).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'user-a', calorie_goal: 2200 })
  )
  expect(insertMock.mock.calls[0][0]).not.toHaveProperty('protein_goal')

  // protein_goal update called (best-effort)
  expect(updateMock).toHaveBeenCalledWith(
    expect.objectContaining({ protein_goal: 120 })
  )
})

it('handles missing protein_goal gracefully', async () => {
  await expect(
    completeOnboarding({ ...input, proteinGoal: null })
  ).resolves.toBeUndefined()

  // protein update should NOT be called when proteinGoal is null
  expect(updateMock).not.toHaveBeenCalled()
})
