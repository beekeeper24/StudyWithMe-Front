import { Client } from '@stomp/stompjs'
import { WS_URL } from './config'
import type { ChatMessage, NotificationItem } from './types'

type RealtimeHandlers = {
  onConnect: () => void
  onDisconnect: () => void
  onError: (message: string) => void
  onChatMessage: (message: ChatMessage) => void
  onNotification: (notification: NotificationItem) => void
}

export function createRealtimeClient(
  accessToken: string,
  roomId: string,
  handlers: RealtimeHandlers,
) {
  const client = new Client({
    brokerURL: WS_URL,
    connectHeaders: {
      Authorization: `Bearer ${accessToken}`,
    },
    reconnectDelay: 0,
    debug: () => undefined,
    onConnect: () => {
      handlers.onConnect()
      if (roomId.trim()) {
        client.subscribe(`/user/queue/chat.rooms.${roomId.trim()}`, (frame) => {
          handlers.onChatMessage(JSON.parse(frame.body) as ChatMessage)
        })
      }
      client.subscribe('/user/queue/notifications', (frame) => {
        handlers.onNotification(JSON.parse(frame.body) as NotificationItem)
      })
    },
    onDisconnect: handlers.onDisconnect,
    onStompError: (frame) => {
      handlers.onError(frame.headers.message ?? 'STOMP error')
    },
    onWebSocketError: () => {
      handlers.onError('WebSocket connection failed')
    },
  })

  return client
}

export function sendChatMessage(
  client: Client | null,
  roomId: string,
  content: string,
) {
  if (!client?.connected || !roomId.trim() || !content.trim()) {
    return
  }

  client.publish({
    destination: `/app/chat.rooms.${roomId.trim()}.messages`,
    body: JSON.stringify({ content: content.trim() }),
  })
}
