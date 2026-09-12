import { beforeEach, expect, it, vi } from 'vitest'

beforeEach(() => {
  vi.resetModules()
  const values = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  })
})

it('restores the plan and profile after a reload without serializing a File', async () => {
  const { useOnboardingStore: first } = await import('./onboardingStore')
  first.getState().setProfile({ name: 'Sam', username: 'sam_test', avatarFile: { name: 'photo.png' } as File })
  first.getState().setCalorieGoal(2200)
  first.getState().addFriendUsername('friend')
  vi.resetModules()
  const { useOnboardingStore: restored } = await import('./onboardingStore')
  expect(restored.getState()).toMatchObject({ name: 'Sam', username: 'sam_test', calorieGoal: 2200, avatarFile: null, friendUsernamesToRequest: ['friend'] })
  restored.getState().reset()
  vi.resetModules()
  expect((await import('./onboardingStore')).useOnboardingStore.getState().calorieGoal).toBeNull()
})
