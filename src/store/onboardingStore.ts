import { create } from 'zustand'

export type PrivacyDefault = 'public' | 'private'

interface OnboardingState {
  name: string
  username: string
  avatarFile: File | null
  calorieGoal: number | null
  privacyDefault: PrivacyDefault
  friendUsernamesToRequest: string[]
  setProfile: (fields: { name: string; username: string; avatarFile: File | null }) => void
  setCalorieGoal: (goal: number) => void
  setPrivacyDefault: (value: PrivacyDefault) => void
  addFriendUsername: (username: string) => void
  reset: () => void
}

const initialState = {
  name: '',
  username: '',
  avatarFile: null as File | null,
  calorieGoal: null as number | null,
  privacyDefault: 'public' as PrivacyDefault,
  friendUsernamesToRequest: [] as string[],
}

export const useOnboardingStore = create<OnboardingState>((set) => ({
  ...initialState,
  setProfile: (fields) => set(fields),
  setCalorieGoal: (goal) => set({ calorieGoal: goal }),
  setPrivacyDefault: (value) => set({ privacyDefault: value }),
  addFriendUsername: (username) =>
    set((state) => ({ friendUsernamesToRequest: [...state.friendUsernamesToRequest, username] })),
  reset: () => set(initialState),
}))
