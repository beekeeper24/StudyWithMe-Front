export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error'

export type OAuthProvider = 'google' | 'kakao'

export type WorkspaceView = 'lobby' | 'studies' | 'posts' | 'chat' | 'mypage'

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
  profileImageUrl?: string | null
  nicknameRequired?: boolean
  termsAgreementRequired?: boolean
  signupRequired?: boolean
  termsVersion?: string | null
  privacyPolicyVersion?: string | null
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

export type StudyHistory = {
  activeStudies: StudyItem[]
  pastStudies: StudyItem[]
}

export type PostItem = {
  id: number
  authorMemberId: number
  authorNickname?: string | null
  authorProfileImageUrl?: string | null
  ownedByRequester?: boolean
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
  authorNickname?: string | null
  authorProfileImageUrl?: string | null
  ownedByRequester?: boolean
  parentCommentId?: number | null
  content: string
  status: string
  createdAt?: string
  updatedAt?: string
}
