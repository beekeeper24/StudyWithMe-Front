import { API_BASE_URL } from './config'
import type {
  AccessTokenResponse,
  AuthProfile,
  CommentItem,
  ChatMessageReport,
  ChatMessageReportModerationAction,
  ChatMessageReportStatus,
  ChatMessage,
  ChatRoom,
  ChatRoomMember,
  ContentReport,
  ContentReportModerationAction,
  ContentReportStatus,
  MemberSanction,
  MemberSanctionCreatePayload,
  MemberSanctionRestorePayload,
  NotificationItem,
  OAuthProvider,
  PageResponse,
  PostBoardType,
  PostItem,
  PostSearchScope,
  PostSortOrder,
  StudyHistory,
  StudyHistoryScope,
  StudyItem,
  StudyJoinRequest,
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
    detail?: unknown
  }
}

export type StudyPayload = {
  title: string
  progressMethod: string
  targetAudience: string
  rules: string
  capacity: number
  schedule: string
}

export class ApiClientError extends Error {
  code?: string
  detail?: unknown
  status: number

  constructor(message: string, options: { code?: string; detail?: unknown; status: number }) {
    super(message)
    this.name = 'ApiClientError'
    this.code = options.code
    this.detail = options.detail
    this.status = options.status
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

export async function markNotificationRead(
  accessToken: string,
  notificationId: number,
): Promise<NotificationItem> {
  return request<NotificationItem>(`/api/v1/notifications/${notificationId}/read`, accessToken, {
    method: 'POST',
  })
}

export async function markAllNotificationsRead(
  accessToken: string,
): Promise<NotificationItem[]> {
  return request<NotificationItem[]>('/api/v1/notifications/read-all', accessToken, {
    method: 'POST',
  })
}

export async function deleteNotification(
  accessToken: string,
  notificationId: number,
): Promise<void> {
  await request<void>(`/api/v1/notifications/${notificationId}`, accessToken, {
    method: 'DELETE',
  })
}

export async function fetchChatRooms(accessToken: string): Promise<ChatRoom[]> {
  return request<ChatRoom[]>('/api/v1/chat/rooms', accessToken)
}

export async function deleteChatRoom(accessToken: string, roomId: number): Promise<void> {
  await request<void>(`/api/v1/chat/rooms/${roomId}`, accessToken, {
    method: 'DELETE',
  })
}

export async function createPrivateChatRoom(
  accessToken: string,
  targetMemberId: number,
): Promise<ChatRoom> {
  return request<ChatRoom>('/api/v1/chat/private-rooms', accessToken, {
    method: 'POST',
    body: JSON.stringify({ targetMemberId }),
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

export async function deleteChatMessage(
  accessToken: string,
  roomId: number,
  messageId: number,
): Promise<ChatMessage> {
  return request<ChatMessage>(`/api/v1/chat/rooms/${roomId}/messages/${messageId}`, accessToken, {
    method: 'DELETE',
  })
}

export async function reportChatMessage(
  accessToken: string,
  roomId: number,
  messageId: number,
  reason: string,
): Promise<ChatMessageReport> {
  return request<ChatMessageReport>(`/api/v1/chat/rooms/${roomId}/messages/${messageId}/reports`, accessToken, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
}

export async function fetchChatMessageReports(
  accessToken: string,
  status?: ChatMessageReportStatus,
): Promise<ChatMessageReport[]> {
  const query = status ? `?status=${status}` : ''
  return request<ChatMessageReport[]>(`/api/v1/admin/chat-message-reports${query}`, accessToken)
}

export async function assignChatMessageReport(
  accessToken: string,
  reportId: number,
): Promise<ChatMessageReport> {
  return request<ChatMessageReport>(`/api/v1/admin/chat-message-reports/${reportId}/assign`, accessToken, {
    method: 'POST',
  })
}

export async function handleChatMessageReport(
  accessToken: string,
  reportId: number,
  status: Exclude<ChatMessageReportStatus, 'PENDING'>,
  moderationAction: ChatMessageReportModerationAction = 'NONE',
  handlingNote = '',
): Promise<ChatMessageReport> {
  return request<ChatMessageReport>(`/api/v1/admin/chat-message-reports/${reportId}/handle`, accessToken, {
    method: 'POST',
    body: JSON.stringify({ status, moderationAction, handlingNote }),
  })
}

export async function reportPostContent(
  accessToken: string,
  postId: number,
  reason: string,
): Promise<ContentReport> {
  return request<ContentReport>(`/api/v1/posts/${postId}/reports`, accessToken, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
}

export async function reportCommentContent(
  accessToken: string,
  commentId: number,
  reason: string,
): Promise<ContentReport> {
  return request<ContentReport>(`/api/v1/comments/${commentId}/reports`, accessToken, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  })
}

export async function fetchContentReports(
  accessToken: string,
  status?: ContentReportStatus,
): Promise<ContentReport[]> {
  const query = status ? `?status=${status}` : ''
  return request<ContentReport[]>(`/api/v1/admin/content-reports${query}`, accessToken)
}

export async function assignContentReport(
  accessToken: string,
  reportId: number,
): Promise<ContentReport> {
  return request<ContentReport>(`/api/v1/admin/content-reports/${reportId}/assign`, accessToken, {
    method: 'POST',
  })
}

export async function handleContentReport(
  accessToken: string,
  reportId: number,
  status: Exclude<ContentReportStatus, 'PENDING'>,
  moderationAction: ContentReportModerationAction = 'NONE',
  handlingNote = '',
): Promise<ContentReport> {
  return request<ContentReport>(`/api/v1/admin/content-reports/${reportId}/handle`, accessToken, {
    method: 'POST',
    body: JSON.stringify({ status, moderationAction, handlingNote }),
  })
}

export async function fetchMemberSanctions(
  accessToken: string,
  targetMemberId: number,
): Promise<MemberSanction[]> {
  const params = new URLSearchParams({ targetMemberId: String(targetMemberId) })
  return request<MemberSanction[]>(`/api/v1/admin/member-sanctions?${params.toString()}`, accessToken)
}

export async function createMemberSanction(
  accessToken: string,
  payload: MemberSanctionCreatePayload,
): Promise<MemberSanction> {
  return request<MemberSanction>('/api/v1/admin/member-sanctions', accessToken, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function restoreMemberSanction(
  accessToken: string,
  targetMemberId: number,
  payload: MemberSanctionRestorePayload,
): Promise<MemberSanction> {
  return request<MemberSanction>(`/api/v1/admin/members/${targetMemberId}/restore`, accessToken, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function fetchChatRoomMembers(
  accessToken: string,
  roomId: number,
): Promise<ChatRoomMember[]> {
  return request<ChatRoomMember[]>(`/api/v1/chat/rooms/${roomId}/members`, accessToken)
}

export async function fetchStudies(
  accessToken: string,
  keyword = '',
  page = 0,
  size = 20,
): Promise<PageResponse<StudyItem>> {
  const params = new URLSearchParams()
  if (keyword.trim()) params.set('keyword', keyword.trim())
  params.set('page', String(page))
  params.set('size', String(size))
  return request<PageResponse<StudyItem>>(`/api/v1/studies?${params.toString()}`, accessToken)
}

export async function fetchMyStudies(accessToken: string): Promise<StudyHistory> {
  return request<StudyHistory>('/api/v1/studies/me', accessToken)
}

export async function fetchMyStudyPage(
  accessToken: string,
  scope: StudyHistoryScope,
  keyword = '',
  page = 0,
  size = 10,
): Promise<PageResponse<StudyItem>> {
  const params = new URLSearchParams()
  params.set('scope', scope)
  if (keyword.trim()) params.set('keyword', keyword.trim())
  params.set('page', String(page))
  params.set('size', String(size))
  return request<PageResponse<StudyItem>>(`/api/v1/studies/me?${params.toString()}`, accessToken)
}

export async function fetchStudy(studyId: number, accessToken: string): Promise<StudyItem> {
  return request<StudyItem>(`/api/v1/studies/${studyId}`, accessToken)
}

export async function fetchStudyJoinRequests(
  accessToken: string,
  studyId: number,
): Promise<StudyJoinRequest[]> {
  return request<StudyJoinRequest[]>(`/api/v1/studies/${studyId}/join-requests`, accessToken)
}

export async function createStudy(
  accessToken: string,
  payload: StudyPayload,
): Promise<StudyItem> {
  return request<StudyItem>('/api/v1/studies', accessToken, {
    method: 'POST',
    body: JSON.stringify(payload),
  })
}

export async function updateStudy(
  accessToken: string,
  studyId: number,
  payload: StudyPayload,
): Promise<StudyItem> {
  return request<StudyItem>(`/api/v1/studies/${studyId}`, accessToken, {
    method: 'PUT',
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

export async function approveStudyJoinRequest(
  accessToken: string,
  studyId: number,
  memberId: number,
): Promise<StudyItem> {
  return request<StudyItem>(
    `/api/v1/studies/${studyId}/join-requests/${memberId}/approve`,
    accessToken,
    { method: 'POST' },
  )
}

export async function rejectStudyJoinRequest(
  accessToken: string,
  studyId: number,
  memberId: number,
): Promise<StudyItem> {
  return request<StudyItem>(
    `/api/v1/studies/${studyId}/join-requests/${memberId}/reject`,
    accessToken,
    { method: 'POST' },
  )
}

export async function cancelStudyJoinRequest(
  accessToken: string,
  studyId: number,
): Promise<StudyItem> {
  return request<StudyItem>(`/api/v1/studies/${studyId}/join-requests/cancel`, accessToken, {
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

export async function endStudy(
  accessToken: string,
  studyId: number,
): Promise<StudyItem> {
  return request<StudyItem>(`/api/v1/studies/${studyId}/end`, accessToken, {
    method: 'POST',
  })
}

export async function deleteStudy(
  accessToken: string,
  studyId: number,
): Promise<StudyItem> {
  return request<StudyItem>(`/api/v1/studies/${studyId}`, accessToken, {
    method: 'DELETE',
  })
}

export async function hideStudyHistory(
  accessToken: string,
  studyId: number,
): Promise<void> {
  await request<void>(`/api/v1/studies/me/history/${studyId}`, accessToken, {
    method: 'DELETE',
  })
}

export async function hideAllStudyHistory(accessToken: string): Promise<void> {
  await request<void>('/api/v1/studies/me/history', accessToken, {
    method: 'DELETE',
  })
}

export async function fetchPosts(
  accessToken: string,
  boardType?: PostBoardType,
  page = 0,
  size = 20,
  keyword = '',
  searchScope: PostSearchScope = 'ALL',
  sortOrder: PostSortOrder = 'LATEST',
): Promise<PageResponse<PostItem>> {
  const params = new URLSearchParams()
  if (boardType) params.set('boardType', boardType)
  if (keyword.trim()) params.set('keyword', keyword.trim())
  params.set('searchScope', searchScope)
  params.set('sortOrder', sortOrder)
  params.set('page', String(page))
  params.set('size', String(size))
  const query = `?${params.toString()}`
  return request<PageResponse<PostItem>>(`/api/v1/posts${query}`, accessToken)
}

export async function fetchPost(postId: number, accessToken: string): Promise<PostItem> {
  return request<PostItem>(`/api/v1/posts/${postId}`, accessToken)
}

export async function createPost(
  accessToken: string,
  payload: { boardType: PostBoardType; title: string; content: string },
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

export async function fetchComments(
  postId: number,
  accessToken: string,
): Promise<CommentItem[]> {
  return request<CommentItem[]>(`/api/v1/posts/${postId}/comments`, accessToken)
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

export async function updateComment(
  accessToken: string,
  commentId: number,
  payload: { content: string },
): Promise<CommentItem> {
  return request<CommentItem>(`/api/v1/comments/${commentId}`, accessToken, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
}

export async function deleteComment(
  accessToken: string,
  commentId: number,
): Promise<CommentItem> {
  return request<CommentItem>(`/api/v1/comments/${commentId}`, accessToken, {
    method: 'DELETE',
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
    throw new ApiClientError(errorBody.error?.message ?? `HTTP ${response.status}`, {
      code: errorBody.error?.code,
      detail: errorBody.error?.detail,
      status: response.status,
    })
  }

  return body.data
}
