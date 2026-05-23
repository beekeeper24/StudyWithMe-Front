import { API_BASE_URL } from './config'
import type {
  AccessTokenResponse,
  AuthProfile,
  CommentItem,
  ChatMessage,
  ChatRoom,
  ChatRoomMember,
  NotificationItem,
  OAuthProvider,
  PostItem,
  StudyHistory,
  StudyItem,
} from './types'

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

export function oauthLoginUrl(provider: OAuthProvider) {
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

export async function withdrawAccount(accessToken: string): Promise<void> {
  await request<void>('/api/v1/auth/me', accessToken, {
    method: 'DELETE',
  })
}

export async function fetchMe(accessToken: string): Promise<AuthProfile> {
  return request<AuthProfile>('/api/v1/auth/me', accessToken)
}

export async function updateNickname(
  accessToken: string,
  nickname: string,
): Promise<AuthProfile> {
  return request<AuthProfile>('/api/v1/auth/me/nickname', accessToken, {
    method: 'PUT',
    body: JSON.stringify({ nickname }),
  })
}

export async function completeSignup(
  accessToken: string,
  nickname: string,
  termsAgreed: boolean,
  privacyPolicyAgreed: boolean,
): Promise<AuthProfile> {
  return request<AuthProfile>('/api/v1/auth/me/signup', accessToken, {
    method: 'PUT',
    body: JSON.stringify({ nickname, termsAgreed, privacyPolicyAgreed }),
  })
}

export async function fetchNotifications(
  accessToken: string,
): Promise<NotificationItem[]> {
  return request<NotificationItem[]>('/api/v1/notifications', accessToken)
}

export async function fetchChatRooms(accessToken: string): Promise<ChatRoom[]> {
  return request<ChatRoom[]>('/api/v1/chat/rooms', accessToken)
}

export async function deleteChatRoom(accessToken: string, roomId: number): Promise<void> {
  await request<void>(`/api/v1/chat/rooms/${roomId}`, accessToken, {
    method: 'DELETE',
  })
}

export async function createStudyChatRoom(
  accessToken: string,
  studyId: number,
): Promise<ChatRoom> {
  return request<ChatRoom>(`/api/v1/studies/${studyId}/chat-room`, accessToken, {
    method: 'POST',
  })
}

export async function fetchChatMessages(
  accessToken: string,
  roomId: number,
): Promise<ChatMessage[]> {
  return request<ChatMessage[]>(`/api/v1/chat/rooms/${roomId}/messages`, accessToken)
}

export async function fetchChatRoomMembers(
  accessToken: string,
  roomId: number,
): Promise<ChatRoomMember[]> {
  return request<ChatRoomMember[]>(`/api/v1/chat/rooms/${roomId}/members`, accessToken)
}

export async function fetchStudies(accessToken?: string): Promise<StudyItem[]> {
  return request<StudyItem[]>('/api/v1/studies', accessToken)
}

export async function fetchMyStudies(accessToken: string): Promise<StudyHistory> {
  return request<StudyHistory>('/api/v1/studies/me', accessToken)
}

export async function fetchStudy(studyId: number, accessToken?: string): Promise<StudyItem> {
  return request<StudyItem>(`/api/v1/studies/${studyId}`, accessToken)
}

export async function createStudy(
  accessToken: string,
  payload: { title: string; description: string },
): Promise<StudyItem> {
  return request<StudyItem>('/api/v1/studies', accessToken, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function joinStudy(
  accessToken: string,
  studyId: number,
): Promise<StudyItem> {
  return request<StudyItem>(`/api/v1/studies/${studyId}/join`, accessToken, {
    method: 'POST',
  })
}

export async function leaveStudy(
  accessToken: string,
  studyId: number,
): Promise<StudyItem> {
  return request<StudyItem>(`/api/v1/studies/${studyId}/leave`, accessToken, {
    method: 'POST',
  })
}

export async function closeStudy(
  accessToken: string,
  studyId: number,
): Promise<StudyItem> {
  return request<StudyItem>(`/api/v1/studies/${studyId}/close`, accessToken, {
    method: 'POST',
  })
}

export async function fetchPosts(): Promise<PostItem[]> {
  return request<PostItem[]>('/api/v1/posts')
}

export async function fetchPost(postId: number): Promise<PostItem> {
  return request<PostItem>(`/api/v1/posts/${postId}`)
}

export async function createPost(
  accessToken: string,
  payload: { title: string; content: string },
): Promise<PostItem> {
  return request<PostItem>('/api/v1/posts', accessToken, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updatePost(
  accessToken: string,
  postId: number,
  payload: { title: string; content: string },
): Promise<PostItem> {
  return request<PostItem>(`/api/v1/posts/${postId}`, accessToken, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function deletePost(
  accessToken: string,
  postId: number,
): Promise<PostItem> {
  return request<PostItem>(`/api/v1/posts/${postId}`, accessToken, {
    method: 'DELETE',
  })
}

export async function fetchComments(postId: number): Promise<CommentItem[]> {
  return request<CommentItem[]>(`/api/v1/posts/${postId}/comments`)
}

export async function createComment(
  accessToken: string,
  postId: number,
  payload: { content: string },
): Promise<CommentItem> {
  return request<CommentItem>(`/api/v1/posts/${postId}/comments`, accessToken, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function replyToComment(
  accessToken: string,
  commentId: number,
  payload: { content: string },
): Promise<CommentItem> {
  return request<CommentItem>(`/api/v1/comments/${commentId}/replies`, accessToken, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
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
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
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
