import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type UserRole = 'USER' | 'ADMIN' | null

export type AuthState = {
  accessToken: string | null
  refreshToken: string | null
  userId: string | null
  userUuid: string | null
  role: UserRole
  setSession: (payload: {
    accessToken: string
    refreshToken: string | null
    userId: string | null
    userUuid: string
    role: UserRole
  }) => void
  clear: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      userId: null,
      userUuid: null,
      role: null,
      setSession: ({ accessToken, refreshToken, userId, userUuid, role }) =>
        set({ accessToken, refreshToken, userId, userUuid, role }),
      clear: () => set({ accessToken: null, refreshToken: null, userId: null, userUuid: null, role: null }),
    }),
    {
      name: 'flash-tickets-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        userId: state.userId,
        userUuid: state.userUuid,
        role: state.role,
      }),
    },
  ),
)
