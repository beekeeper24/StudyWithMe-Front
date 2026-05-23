export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error'

export type OAuthProvider = 'google' | 'kakao'

export type WorkspaceView = 'lobby' | 'studies' | 'posts' | 'chat'

export type AccessTokenResponse = {
  accessToken: string
  accessTokenExpiresAt: string
  tokenType: 'Bearer'
}

export type ChatMessage = {
  id?: number
  roomId: number
  senderMemberId: number
  content: string
  createdAt?: string
}

export type ChatRoom = {
  id: number
  type: string
  studyId?: number | null
  title?: string | null
  createdAt?: string
}

export type ChatRoomMember = {
  memberId: number
  nickname?: string | null
  profileImageUrl?: string | null
  joinedAt?: string
}

export type NotificationItem = {
  id?: number
  receiverMemberId: number
  actorMemberId: number
  type: string
  targetType: string
  targetId: number
  message: string
  read: boolean
  createdAt?: string | null
  readAt?: string | null
}

export type AuthProfile = {
  id?: number
  memberId?: number
  email?: string
  nickname?: string
}

export type StudyItem = {
  id: number
  ownerMemberId: number
  ownerNickname?: string | null
  ownerProfileImageUrl?: string | null
  title: string
  description: string
  status: string
  joinedByRequester?: boolean
  ownedByRequester?: boolean
  createdAt?: string
  updatedAt?: string
}

export type PostItem = {
  id: number
  authorMemberId: number
  title: string
  content: string
  status: string
  createdAt?: string
  updatedAt?: string
}

export type CommentItem = {
  id: number
  postId: number
  authorMemberId: number
  parentCommentId?: number | null
  content: string
  status: string
  createdAt?: string
  updatedAt?: string
}
