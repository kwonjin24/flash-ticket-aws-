import ky from 'ky'
import { useAuthStore } from '../store/auth'

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000'

export const http = ky.create({
  prefixUrl: API_BASE_URL.replace(/\/$/, ''),
  hooks: {
    beforeRequest: [
      (request) => {
        const { accessToken } = useAuthStore.getState()
        if (accessToken) {
          request.headers.set('Authorization', `Bearer ${accessToken}`)
        }
      },
    ],
  },
  retry: { limit: 0 },
})
