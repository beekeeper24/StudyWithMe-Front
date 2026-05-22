import { API_BASE_URL } from './config'
import type { AuthProfile, NotificationItem } from './types'

type ApiResponse<T> = {
  success: boolean
  data: T
  message?: string
}

type ApiErrorResponse = {
  success: false
  error?: {
    code?: string
    message?: string
  }
}

export async function fetchMe(accessToken: string): Promise<AuthProfile> {
  return request<AuthProfile>('/api/v1/auth/me', accessToken)
}

export async function fetchNotifications(
  accessToken: string,
): Promise<NotificationItem[]> {
  return request<NotificationItem[]>('/api/v1/notifications', accessToken)
}

async function request<T>(path: string, accessToken: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  })

  const body = (await response.json()) as ApiResponse<T> | ApiErrorResponse
  if (!response.ok || !body.success) {
    const errorBody = body as ApiErrorResponse
    throw new Error(errorBody.error?.message ?? `HTTP ${response.status}`)
  }

  return body.data
}
