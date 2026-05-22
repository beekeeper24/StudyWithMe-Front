export type ConnectionStatus = 'idle' | 'connecting' | 'connected' | 'error'

export type ChatMessage = {
  id?: number
  roomId: number
  senderMemberId: number
  content: string
  createdAt?: string
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
  createdAt?: string
  readAt?: string | null
}

export type AuthProfile = {
  id?: number
  memberId?: number
  email?: string
  nickname?: string
}
