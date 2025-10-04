import type { UserRole } from '../store/auth'

export type TokenDto = {
  accessToken: string
  refreshToken?: string
}

export type LoginCredentials = {
  userId: string
  password: string
}

export type RegisterCredentials = {
  userId: string
  password: string
  confirmPassword: string
  isAdmin: boolean
  adminSecret: string
}

export type DecodedPayload = {
  userId: string | null
  role: UserRole
}
