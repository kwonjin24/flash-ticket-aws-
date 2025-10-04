import ky, { HTTPError } from 'ky'
import { useAuthStore } from '../store/auth'
import { useQueueStore } from '../store/queue'
import { useOrderStore } from '../store/order'

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000'

let gateTokenErrorHandled = false

const handleGateTokenError = async (response: Response) => {
  const authClear = useAuthStore.getState().clear
  const queueReset = useQueueStore.getState().reset
  const orderReset = useOrderStore.getState().reset
  authClear()
  queueReset()
  orderReset()
  try {
    await response.clone().json()
  } catch {
    // ignore parse errors
  }
  window.alert('대기열 정보가 만료되었습니다. 다시 로그인해주세요.')
  window.location.replace('/auth/login')
}

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
    afterResponse: [
      async (request, options, response) => {
        if (response.ok) {
          return response
        }

        if ((response.status === 401 || response.status === 403) && !gateTokenErrorHandled) {
          try {
            const data = await response.clone().json()
            const message = Array.isArray(data?.message)
              ? data.message.join(', ')
              : typeof data?.message === 'string'
                ? data.message
                : ''
            if (message.toLowerCase().includes('gate token')) {
              gateTokenErrorHandled = true
              await handleGateTokenError(response)
            }
          } catch {
            // ignore
          }
        }

        throw new HTTPError(response, request, options)
      },
    ],
  },
  retry: { limit: 0 },
})
