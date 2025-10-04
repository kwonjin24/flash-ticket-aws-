import type { DecodedPayload } from '../types'
import type { UserRole } from '../store/auth'

export const decodeToken = (token: string): DecodedPayload => {
  try {
    const payloadSegment = token.split('.')[1]
    if (!payloadSegment) {
      return { userId: null, userUuid: null, role: null }
    }
    const padded = payloadSegment.replace(/-/g, '+').replace(/_/g, '/')
    const json = decodeURIComponent(
      atob(padded)
        .split('')
        .map((c) => `%${(`00${c.charCodeAt(0).toString(16)}`).slice(-2)}`)
        .join(''),
    )
    const payload = JSON.parse(json)
    const userUuid = typeof payload.sub === 'string' ? payload.sub : null
    const loginId = typeof payload.userId === 'string' ? payload.userId : null
    return {
      userId: loginId,
      userUuid,
      role: (payload.role as UserRole) ?? null,
    }
  } catch (error) {
    console.error('Failed to decode access token', error)
    return { userId: null, userUuid: null, role: null }
  }
}
