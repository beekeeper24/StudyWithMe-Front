import { useCallback, useMemo, useRef, useState } from 'react'
import type { Client } from '@stomp/stompjs'
import {
  Bell,
  BookOpen,
  Circle,
  KeyRound,
  LogIn,
  LogOut,
  MessageSquareText,
  Newspaper,
  Plug,
  RefreshCw,
  Send,
  Settings2,
  ShieldCheck,
  Users,
} from 'lucide-react'
import './App.css'
import { consumeOAuthCallback } from './auth'
import {
  fetchMe,
  fetchNotifications,
  logoutSession,
  oauthLoginUrl,
  refreshAccessToken,
} from './api'
import { API_BASE_URL, WS_URL } from './config'
import { createRealtimeClient, sendChatMessage } from './realtime'
import type {
  AccessTokenResponse,
  AuthProfile,
  ChatMessage,
  ConnectionStatus,
  NotificationItem,
  OAuthProvider,
} from './types'

const navItems = [
  { label: '스터디', icon: BookOpen },
  { label: '게시글', icon: Newspaper },
  { label: '채팅', icon: MessageSquareText },
  { label: '알림', icon: Bell },
]

const oauthProviders: Array<{ id: OAuthProvider; label: string }> = [
  { id: 'google', label: 'Google' },
  { id: 'kakao', label: 'Kakao' },
]

const initialOAuthToken = consumeOAuthCallback()

function App() {
  const [accessToken, setAccessToken] = useState(initialOAuthToken?.accessToken ?? '')
  const [tokenExpiresAt, setTokenExpiresAt] = useState<string | null>(
    initialOAuthToken?.accessTokenExpiresAt ?? null,
  )
  const [roomId, setRoomId] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<ConnectionStatus>('idle')
  const [profile, setProfile] = useState<AuthProfile | null>(null)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [log, setLog] = useState<string[]>(
    initialOAuthToken
      ? ['OAuth 로그인 callback 처리 완료', '프론트가 준비되었습니다.']
      : ['프론트가 준비되었습니다.'],
  )
  const clientRef = useRef<Client | null>(null)

  const canConnect = accessToken.trim().length > 0
  const activeRoomLabel = roomId.trim() ? `Room #${roomId.trim()}` : '방 미선택'

  const appendLog = useCallback((item: string) => {
    setLog((current) => [item, ...current].slice(0, 8))
  }, [])

  const applyToken = useCallback((token: AccessTokenResponse) => {
    setAccessToken(token.accessToken)
    setTokenExpiresAt(token.accessTokenExpiresAt)
  }, [])


  const statusText = useMemo(() => {
    if (status === 'connected') return '연결됨'
    if (status === 'connecting') return '연결 중'
    if (status === 'error') return '오류'
    return '대기'
  }, [status])

  function startOAuth(provider: OAuthProvider) {
    window.location.assign(oauthLoginUrl(provider))
  }

  async function refreshSession() {
    try {
      const token = await refreshAccessToken()
      applyToken(token)
      appendLog('access token 재발급 성공')
    } catch (error) {
      appendLog(error instanceof Error ? error.message : 'access token 재발급 실패')
    }
  }

  async function logout() {
    try {
      await logoutSession()
      disconnectRealtime()
      setAccessToken('')
      setTokenExpiresAt(null)
      setProfile(null)
      setNotifications([])
      appendLog('로그아웃 완료')
    } catch (error) {
      appendLog(error instanceof Error ? error.message : '로그아웃 실패')
    }
  }

  async function loadProfile() {
    if (!canConnect) return
    try {
      const me = await fetchMe(accessToken.trim())
      setProfile(me)
      appendLog('내 정보 조회 성공')
    } catch (error) {
      appendLog(error instanceof Error ? error.message : '내 정보 조회 실패')
    }
  }

  async function loadNotifications() {
    if (!canConnect) return
    try {
      const items = await fetchNotifications(accessToken.trim())
      setNotifications(items)
      appendLog(`알림 ${items.length}개 동기화`)
    } catch (error) {
      appendLog(error instanceof Error ? error.message : '알림 조회 실패')
    }
  }

  function connectRealtime() {
    if (!canConnect) return
    clientRef.current?.deactivate()
    setStatus('connecting')
    appendLog('STOMP 연결 시도')

    const client = createRealtimeClient(accessToken.trim(), roomId, {
      onConnect: () => {
        setStatus('connected')
        appendLog('STOMP 연결 성공')
      },
      onDisconnect: () => {
        setStatus('idle')
        appendLog('STOMP 연결 종료')
      },
      onError: (errorMessage) => {
        setStatus('error')
        appendLog(errorMessage)
      },
      onChatMessage: (incoming) => {
        setChatMessages((current) => [...current, incoming].slice(-30))
      },
      onNotification: (incoming) => {
        setNotifications((current) => [incoming, ...current].slice(0, 30))
      },
    })

    clientRef.current = client
    client.activate()
  }

  function disconnectRealtime() {
    clientRef.current?.deactivate()
    clientRef.current = null
    setStatus('idle')
  }

  function submitMessage() {
    sendChatMessage(clientRef.current, roomId, message)
    setMessage('')
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">S</div>
          <div>
            <strong>StudyWithMe</strong>
            <span>community</span>
          </div>
        </div>

        <nav className="nav-list" aria-label="main navigation">
          {navItems.map((item) => (
            <button
              className={item.label === '채팅' ? 'nav-item active' : 'nav-item'}
              key={item.label}
              type="button"
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>

        <div className="sidebar-footer">
          <Settings2 size={18} />
          <span>Backend {API_BASE_URL}</span>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">Realtime workspace</span>
            <h1>스터디 커뮤니티 실시간 콘솔</h1>
          </div>
          <div className={`status-pill ${status}`}>
            <Circle size={10} fill="currentColor" />
            {statusText}
          </div>
        </header>

        <section className="auth-strip" aria-label="oauth login controls">
          <div className="auth-summary">
            <ShieldCheck size={19} />
            <div>
              <strong>{canConnect ? '인증 세션 준비됨' : 'OAuth 로그인 필요'}</strong>
              <span>
                {tokenExpiresAt
                  ? `access token 만료 ${formatTime(tokenExpiresAt)}`
                  : 'refresh token은 HttpOnly cookie로 관리됩니다.'}
              </span>
            </div>
          </div>
          <div className="auth-actions">
            {oauthProviders.map((provider) => (
              <button key={provider.id} type="button" onClick={() => startOAuth(provider.id)}>
                <LogIn size={16} />
                {provider.label}
              </button>
            ))}
            <button type="button" onClick={refreshSession}>
              <KeyRound size={16} />
              재발급
            </button>
            <button type="button" onClick={logout}>
              <LogOut size={16} />
              로그아웃
            </button>
          </div>
        </section>

        <section className="control-strip" aria-label="connection controls">
          <label>
            <span>Access token</span>
            <input
              value={accessToken}
              onChange={(event) => setAccessToken(event.target.value)}
              placeholder="OAuth callback 또는 재발급으로 자동 입력됩니다"
              type="password"
            />
          </label>
          <label className="room-field">
            <span>Chat room</span>
            <input
              value={roomId}
              onChange={(event) => setRoomId(event.target.value)}
              placeholder="roomId"
              inputMode="numeric"
            />
          </label>
          <div className="control-actions">
            <button type="button" onClick={loadProfile} disabled={!canConnect}>
              <RefreshCw size={16} />
              내 정보
            </button>
            <button type="button" onClick={loadNotifications} disabled={!canConnect}>
              <Bell size={16} />
              알림 동기화
            </button>
            <button
              className="primary"
              type="button"
              onClick={connectRealtime}
              disabled={!canConnect || status === 'connecting'}
            >
              <Plug size={16} />
              연결
            </button>
            <button type="button" onClick={disconnectRealtime}>
              해제
            </button>
          </div>
        </section>

        <div className="content-grid">
          <section className="main-column">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Chat</span>
                <h2>{activeRoomLabel}</h2>
              </div>
              <span className="metric">{chatMessages.length} messages</span>
            </div>

            <div className="chat-panel">
              {chatMessages.length === 0 ? (
                <div className="empty-state">
                  <MessageSquareText size={28} />
                  <p>방을 연결하고 메시지를 보내면 여기에 표시됩니다.</p>
                </div>
              ) : (
                chatMessages.map((item, index) => (
                  <article className="message-row" key={`${item.id ?? 'local'}-${index}`}>
                    <div className="avatar">{String(item.senderMemberId).slice(-2)}</div>
                    <div>
                      <div className="message-meta">
                        <strong>Member {item.senderMemberId}</strong>
                        <span>{item.createdAt ? formatTime(item.createdAt) : 'now'}</span>
                      </div>
                      <p>{item.content}</p>
                    </div>
                  </article>
                ))
              )}
            </div>

            <div className="composer">
              <input
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') submitMessage()
                }}
                placeholder="메시지를 입력하세요"
              />
              <button type="button" onClick={submitMessage}>
                <Send size={18} />
              </button>
            </div>
          </section>

          <aside className="side-column">
            <section className="profile-panel">
              <div className="section-heading compact">
                <h2>내 상태</h2>
              </div>
              <div className="profile-row">
                <div className="avatar large">
                  {profile?.nickname?.slice(0, 1).toUpperCase() ?? '?'}
                </div>
                <div>
                  <strong>{profile?.nickname ?? '인증 대기'}</strong>
                  <span>{profile?.email ?? WS_URL}</span>
                </div>
              </div>
            </section>

            <section className="notification-panel">
              <div className="section-heading compact">
                <div>
                  <span className="eyebrow">Notifications</span>
                  <h2>실시간 알림</h2>
                </div>
                <span className="metric">{notifications.length}</span>
              </div>
              <div className="notification-list">
                {notifications.length === 0 ? (
                  <p className="muted">아직 수신한 알림이 없습니다.</p>
                ) : (
                  notifications.map((item, index) => (
                    <article className="notice-row" key={`${item.id ?? 'notice'}-${index}`}>
                      <Bell size={17} />
                      <div>
                        <strong>{item.message}</strong>
                        <span>
                          {item.type} · target #{item.targetId}
                        </span>
                      </div>
                    </article>
                  ))
                )}
              </div>
            </section>

            <section className="activity-panel">
              <div className="section-heading compact">
                <h2>활동 로그</h2>
              </div>
              <ul>
                {log.map((item, index) => (
                  <li key={`${item}-${index}`}>
                    <Users size={14} />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          </aside>
        </div>
      </main>
    </div>
  )
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

export default App
