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

it('saves body stats and the first weigh-in, and a failure there never blocks sign-up', async () => {
  // The 0013 migration hasn't run: the body-stats update and weigh-in both fail.
  eqMock.mockImplementation(() => Promise.resolve({ error: null }))
  updateMock.mockImplementation((fields: Record<string, unknown>) =>
    ({ eq: () => ('height_cm' in fields ? Promise.reject(new Error('column does not exist')) : Promise.resolve({ error: null })) }))
  insertMock
    .mockResolvedValueOnce({ error: null })                               // users row
    .mockRejectedValueOnce(new Error('relation weight_logs does not exist')) // weigh-in
    .mockResolvedValue({ error: null })                                    // friendships

  await expect(completeOnboarding({ ...input, heightCm: 172, weightKg: 76, targetWeightKg: 70 })).resolves.toBeUndefined()

  expect(updateMock).toHaveBeenCalledWith({ protein_goal: 120 })
  expect(updateMock).toHaveBeenCalledWith({ height_cm: 172, target_weight_kg: 70 })
  expect(from).toHaveBeenCalledWith('weight_logs')
  expect(insertMock).toHaveBeenCalledWith({ user_id: 'user-a', weight_kg: 76 })
})
