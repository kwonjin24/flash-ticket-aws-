import type { LoginCredentials, RegisterCredentials } from '../types'

export const INITIAL_LOGIN_FORM: LoginCredentials = { userId: '', password: '' }

export const INITIAL_REGISTER_FORM: RegisterCredentials = {
  userId: '',
  password: '',
  confirmPassword: '',
  isAdmin: false,
  adminSecret: '',
}
