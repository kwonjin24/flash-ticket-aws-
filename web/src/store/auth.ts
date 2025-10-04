import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type UserRole = 'USER' | 'ADMIN' | null

export type AuthState = {
  accessToken: string | null
  refreshToken: string | null
  userId: string | null
  role: UserRole
  setSession: (payload: { accessToken: string; refreshToken: string | null; userId: string; role: UserRole }) => void
  clear: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      userId: null,
      role: null,
      setSession: ({ accessToken, refreshToken, userId, role }) =>
        set({ accessToken, refreshToken, userId, role }),
      clear: () => set({ accessToken: null, refreshToken: null, userId: null, role: null }),
    }),
    {
      name: 'flash-tickets-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        userId: state.userId,
        role: state.role,
      }),
    },
  ),
)
