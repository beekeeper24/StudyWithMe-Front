import { API_BASE_URL } from './config'
import type { AccessTokenResponse, AuthProfile, NotificationItem } from './types'

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

export function oauthLoginUrl(provider: 'google' | 'kakao') {
  return `${API_BASE_URL}/oauth2/authorization/${provider}`
}

export async function refreshAccessToken(): Promise<AccessTokenResponse> {
  return request<AccessTokenResponse>('/api/v1/auth/refresh', undefined, {
    method: 'POST',
  })
}

export async function logoutSession(): Promise<void> {
  await request<void>('/api/v1/auth/logout', undefined, {
    method: 'POST',
  })
}

export async function fetchMe(accessToken: string): Promise<AuthProfile> {
  return request<AuthProfile>('/api/v1/auth/me', accessToken)
}

export async function fetchNotifications(
  accessToken: string,
): Promise<NotificationItem[]> {
  return request<NotificationItem[]>('/api/v1/notifications', accessToken)
}

async function request<T>(
  path: string,
  accessToken?: string,
  init: RequestInit = {},
): Promise<T> {
  const headers = new Headers(init.headers)
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`)
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers,
  })

  const body = (await response.json()) as ApiResponse<T> | ApiErrorResponse
  if (!response.ok || !body.success) {
    const errorBody = body as ApiErrorResponse
    throw new Error(errorBody.error?.message ?? `HTTP ${response.status}`)
  }

  return body.data
}
