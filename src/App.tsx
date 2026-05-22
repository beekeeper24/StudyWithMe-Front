import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Client } from '@stomp/stompjs'
import {
  Bell,
  BookOpen,
  CheckCircle2,
  Circle,
  KeyRound,
  LogIn,
  LogOut,
  MessageSquareText,
  Newspaper,
  Plug,
  Plus,
  RefreshCw,
  Send,
  Settings2,
  ShieldCheck,
  Trash2,
  Users,
  XCircle,
} from 'lucide-react'
import './App.css'
import { consumeOAuthCallback } from './auth'
import {
  closeStudy,
  createComment,
  createPost,
  createStudy,
  deletePost,
  fetchComments,
  fetchMe,
  fetchNotifications,
  fetchPost,
  fetchPosts,
  fetchStudies,
  joinStudy,
  leaveStudy,
  logoutSession,
  oauthLoginUrl,
  refreshAccessToken,
  replyToComment,
  updatePost,
} from './api'
import { API_BASE_URL, WS_URL } from './config'
import { createRealtimeClient, sendChatMessage } from './realtime'
import type {
  AccessTokenResponse,
  AuthProfile,
  ChatMessage,
  CommentItem,
  ConnectionStatus,
  NotificationItem,
  OAuthProvider,
  PostItem,
  StudyItem,
  WorkspaceView,
} from './types'

const navItems: Array<{ id: WorkspaceView; label: string; icon: typeof BookOpen }> = [
  { id: 'studies', label: '스터디', icon: BookOpen },
  { id: 'posts', label: '게시글', icon: Newspaper },
  { id: 'chat', label: '채팅', icon: MessageSquareText },
  { id: 'notifications', label: '알림', icon: Bell },
]

const oauthProviders: Array<{ id: OAuthProvider; label: string }> = [
  { id: 'google', label: 'Google' },
  { id: 'kakao', label: 'Kakao' },
]

const initialOAuthToken = consumeOAuthCallback()

const emptyStudyForm = { title: '', description: '' }
const emptyPostForm = { title: '', content: '' }

function App() {
  const [activeView, setActiveView] = useState<WorkspaceView>('studies')
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
  const [studies, setStudies] = useState<StudyItem[]>([])
  const [posts, setPosts] = useState<PostItem[]>([])
  const [selectedPost, setSelectedPost] = useState<PostItem | null>(null)
  const [comments, setComments] = useState<CommentItem[]>([])
  const [studyForm, setStudyForm] = useState(emptyStudyForm)
  const [postForm, setPostForm] = useState(emptyPostForm)
  const [commentText, setCommentText] = useState('')
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({})
  const [log, setLog] = useState<string[]>(
    initialOAuthToken
      ? ['OAuth 로그인 callback 처리 완료', '프론트가 준비되었습니다.']
      : ['프론트가 준비되었습니다.'],
  )
  const clientRef = useRef<Client | null>(null)

  const canConnect = accessToken.trim().length > 0
  const activeRoomLabel = roomId.trim() ? `Room #${roomId.trim()}` : '방 미선택'
  const selectedPostId = selectedPost?.id ?? null

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

  const topLevelComments = useMemo(
    () => comments.filter((item) => item.parentCommentId == null),
    [comments],
  )

  useEffect(() => {
    let cancelled = false

    async function loadInitialContent() {
      try {
        const [studyItems, postItems] = await Promise.all([fetchStudies(), fetchPosts()])
        if (cancelled) return
        setStudies(studyItems)
        setPosts(postItems)

        if (postItems.length > 0) {
          const [post, postComments] = await Promise.all([
            fetchPost(postItems[0].id),
            fetchComments(postItems[0].id),
          ])
          if (cancelled) return
          setSelectedPost(post)
          setComments(postComments)
        }
      } catch (error) {
        appendLog(error instanceof Error ? error.message : '초기 데이터 조회 실패')
      }
    }

    void loadInitialContent()
    return () => {
      cancelled = true
    }
  }, [appendLog])

  useEffect(() => {
    if (!initialOAuthToken) return undefined
    let cancelled = false

    async function loadInitialProfile() {
      try {
        const me = await fetchMe(initialOAuthToken?.accessToken ?? '')
        if (!cancelled) {
          setProfile(me)
          appendLog('내 정보 조회 성공')
        }
      } catch (error) {
        if (!cancelled) {
          appendLog(error instanceof Error ? error.message : '내 정보 조회 실패')
        }
      }
    }

    void loadInitialProfile()
    return () => {
      cancelled = true
    }
  }, [appendLog])

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

  async function loadStudies() {
    try {
      const items = await fetchStudies()
      setStudies(items)
    } catch (error) {
      appendLog(error instanceof Error ? error.message : '스터디 목록 조회 실패')
    }
  }

  async function submitStudy() {
    if (!canConnect || !studyForm.title.trim() || !studyForm.description.trim()) return
    try {
      await createStudy(accessToken.trim(), {
        title: studyForm.title.trim(),
        description: studyForm.description.trim(),
      })
      setStudyForm(emptyStudyForm)
      await loadStudies()
      appendLog('스터디 생성 완료')
    } catch (error) {
      appendLog(error instanceof Error ? error.message : '스터디 생성 실패')
    }
  }

  async function mutateStudy(studyId: number, action: 'join' | 'leave' | 'close') {
    if (!canConnect) return
    try {
      if (action === 'join') await joinStudy(accessToken.trim(), studyId)
      if (action === 'leave') await leaveStudy(accessToken.trim(), studyId)
      if (action === 'close') await closeStudy(accessToken.trim(), studyId)
      await loadStudies()
      appendLog(`스터디 ${actionLabel(action)} 완료`)
    } catch (error) {
      appendLog(error instanceof Error ? error.message : `스터디 ${actionLabel(action)} 실패`)
    }
  }

  async function loadPosts() {
    try {
      const items = await fetchPosts()
      setPosts(items)
      if (!selectedPostId && items.length > 0) {
        await selectPost(items[0].id)
      }
    } catch (error) {
      appendLog(error instanceof Error ? error.message : '게시글 목록 조회 실패')
    }
  }

  async function selectPost(postId: number) {
    try {
      const [post, postComments] = await Promise.all([fetchPost(postId), fetchComments(postId)])
      setSelectedPost(post)
      setComments(postComments)
    } catch (error) {
      appendLog(error instanceof Error ? error.message : '게시글 상세 조회 실패')
    }
  }

  async function submitPost() {
    if (!canConnect || !postForm.title.trim() || !postForm.content.trim()) return
    try {
      const post = selectedPost
        ? await updatePost(accessToken.trim(), selectedPost.id, {
            title: postForm.title.trim(),
            content: postForm.content.trim(),
          })
        : await createPost(accessToken.trim(), {
            title: postForm.title.trim(),
            content: postForm.content.trim(),
          })
      setPostForm(emptyPostForm)
      await loadPosts()
      await selectPost(post.id)
      appendLog(selectedPost ? '게시글 수정 완료' : '게시글 작성 완료')
    } catch (error) {
      appendLog(error instanceof Error ? error.message : '게시글 저장 실패')
    }
  }

  async function removePost() {
    if (!canConnect || !selectedPost) return
    try {
      await deletePost(accessToken.trim(), selectedPost.id)
      setSelectedPost(null)
      setComments([])
      await loadPosts()
      appendLog('게시글 삭제 완료')
    } catch (error) {
      appendLog(error instanceof Error ? error.message : '게시글 삭제 실패')
    }
  }

  function beginEditPost(post: PostItem) {
    setSelectedPost(post)
    setPostForm({ title: post.title, content: post.content })
    void selectPost(post.id)
  }

  async function submitComment() {
    if (!canConnect || !selectedPostId || !commentText.trim()) return
    try {
      await createComment(accessToken.trim(), selectedPostId, { content: commentText.trim() })
      setCommentText('')
      await selectPost(selectedPostId)
      appendLog('댓글 작성 완료')
    } catch (error) {
      appendLog(error instanceof Error ? error.message : '댓글 작성 실패')
    }
  }

  async function submitReply(commentId: number) {
    const content = replyDrafts[commentId]?.trim()
    if (!canConnect || !selectedPostId || !content) return
    try {
      await replyToComment(accessToken.trim(), commentId, { content })
      setReplyDrafts((current) => ({ ...current, [commentId]: '' }))
      await selectPost(selectedPostId)
      appendLog('답글 작성 완료')
    } catch (error) {
      appendLog(error instanceof Error ? error.message : '답글 작성 실패')
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
              className={activeView === item.id ? 'nav-item active' : 'nav-item'}
              key={item.id}
              type="button"
              onClick={() => setActiveView(item.id)}
              aria-label={item.label}
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
            <span className="eyebrow">Community workspace</span>
            <h1>스터디 모집과 게시판 운영 콘솔</h1>
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
          <div className="control-actions">
            <button type="button" onClick={loadProfile} disabled={!canConnect}>
              <RefreshCw size={16} />
              내 정보
            </button>
            <button type="button" onClick={loadNotifications} disabled={!canConnect}>
              <Bell size={16} />
              알림 동기화
            </button>
          </div>
        </section>

        {activeView === 'studies' && renderStudies()}
        {activeView === 'posts' && renderPosts()}
        {activeView === 'chat' && renderChat()}
        {activeView === 'notifications' && renderNotifications()}
      </main>
    </div>
  )

  function renderStudies() {
    return (
      <div className="workspace-grid">
        <section className="main-column">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Study</span>
              <h2>스터디 모집</h2>
            </div>
            <button className="icon-text-button" type="button" onClick={loadStudies}>
              <RefreshCw size={16} />
              새로고침
            </button>
          </div>

          <div className="item-list">
            {studies.length === 0 ? (
              <EmptyState icon={BookOpen} text="아직 등록된 스터디가 없습니다." />
            ) : (
              studies.map((study) => (
                <article className="list-row" key={study.id}>
                  <div>
                    <div className="row-title">
                      <strong>{study.title}</strong>
                      <span className={`state-chip ${study.status.toLowerCase()}`}>
                        {study.status}
                      </span>
                    </div>
                    <p>{study.description}</p>
                    <span className="row-meta">
                      owner #{study.ownerMemberId} · {formatTime(study.createdAt)}
                    </span>
                  </div>
                  <div className="row-actions">
                    <button
                      type="button"
                      onClick={() => mutateStudy(study.id, 'join')}
                      disabled={!canConnect || study.status !== 'OPEN'}
                    >
                      <CheckCircle2 size={16} />
                      참여
                    </button>
                    <button
                      type="button"
                      onClick={() => mutateStudy(study.id, 'leave')}
                      disabled={!canConnect}
                    >
                      <XCircle size={16} />
                      탈퇴
                    </button>
                    <button
                      type="button"
                      onClick={() => mutateStudy(study.id, 'close')}
                      disabled={!canConnect || study.status !== 'OPEN'}
                    >
                      마감
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <aside className="side-column">
          <section className="profile-panel">
            <div className="section-heading compact">
              <h2>스터디 만들기</h2>
            </div>
            <div className="form-stack">
              <label>
                <span>제목</span>
                <input
                  value={studyForm.title}
                  onChange={(event) =>
                    setStudyForm((current) => ({ ...current, title: event.target.value }))
                  }
                  placeholder="예: 매일 알고리즘 1문제"
                />
              </label>
              <label>
                <span>소개</span>
                <textarea
                  value={studyForm.description}
                  onChange={(event) =>
                    setStudyForm((current) => ({ ...current, description: event.target.value }))
                  }
                  placeholder="진행 방식, 모집 대상, 규칙을 적어주세요."
                />
              </label>
              <button
                className="primary wide"
                type="button"
                onClick={submitStudy}
                disabled={!canConnect}
              >
                <Plus size={16} />
                생성
              </button>
            </div>
          </section>
          {renderProfilePanel()}
          {renderActivityPanel()}
        </aside>
      </div>
    )
  }

  function renderPosts() {
    return (
      <div className="workspace-grid posts-grid">
        <section className="main-column">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Board</span>
              <h2>커뮤니티 게시글</h2>
            </div>
            <button
              className="icon-text-button"
              type="button"
              onClick={() => {
                setSelectedPost(null)
                setPostForm(emptyPostForm)
                setComments([])
                setCommentText('')
                setReplyDrafts({})
              }}
            >
              <Plus size={16} />
              새 글
            </button>
          </div>

          <div className="split-content">
            <div className="post-list">
              {posts.length === 0 ? (
                <EmptyState icon={Newspaper} text="게시글이 없습니다." />
              ) : (
                posts.map((post) => (
                  <button
                    className={selectedPost?.id === post.id ? 'post-list-item active' : 'post-list-item'}
                    key={post.id}
                    type="button"
                    onClick={() => beginEditPost(post)}
                  >
                    <strong>{post.title}</strong>
                    <span>
                      #{post.id} · author #{post.authorMemberId}
                    </span>
                  </button>
                ))
              )}
            </div>

            <article className="post-detail">
              {selectedPost ? (
                <>
                  <div className="row-title">
                    <h2>{selectedPost.title}</h2>
                    <span className={`state-chip ${selectedPost.status.toLowerCase()}`}>
                      {selectedPost.status}
                    </span>
                  </div>
                  <p>{selectedPost.content}</p>
                  <span className="row-meta">
                    author #{selectedPost.authorMemberId} · {formatTime(selectedPost.createdAt)}
                  </span>
                  <div className="post-actions">
                    <button type="button" onClick={() => beginEditPost(selectedPost)}>
                      수정 준비
                    </button>
                    <button type="button" onClick={removePost} disabled={!canConnect}>
                      <Trash2 size={16} />
                      삭제
                    </button>
                  </div>
                </>
              ) : (
                <EmptyState icon={Newspaper} text="게시글을 선택하거나 새 글을 작성하세요." />
              )}
            </article>
          </div>
        </section>

        <aside className="side-column">
          <section className="profile-panel">
            <div className="section-heading compact">
              <h2>{selectedPost ? '게시글 수정' : '게시글 작성'}</h2>
            </div>
            <div className="form-stack">
              <label>
                <span>제목</span>
                <input
                  value={postForm.title}
                  onChange={(event) =>
                    setPostForm((current) => ({ ...current, title: event.target.value }))
                  }
                  placeholder="게시글 제목"
                />
              </label>
              <label>
                <span>내용</span>
                <textarea
                  className="tall"
                  value={postForm.content}
                  onChange={(event) =>
                    setPostForm((current) => ({ ...current, content: event.target.value }))
                  }
                  placeholder="@닉네임 멘션도 테스트할 수 있습니다."
                />
              </label>
              <button
                className="primary wide"
                type="button"
                onClick={submitPost}
                disabled={!canConnect}
              >
                <Send size={16} />
                저장
              </button>
            </div>
          </section>

          <section className="notification-panel comments-panel">
            <div className="section-heading compact">
              <div>
                <span className="eyebrow">Community</span>
                <h2>댓글과 답글</h2>
              </div>
              <span className="metric">{comments.length}</span>
            </div>
            <div className="form-stack compact-form">
              <textarea
                value={commentText}
                onChange={(event) => setCommentText(event.target.value)}
                placeholder="댓글을 입력하세요."
                disabled={!selectedPostId}
              />
              <button
                className="primary wide"
                type="button"
                onClick={submitComment}
                disabled={!canConnect || !selectedPostId}
              >
                댓글 작성
              </button>
            </div>
            <div className="comment-list">
              {topLevelComments.length === 0 ? (
                <p className="muted">표시할 댓글이 없습니다.</p>
              ) : (
                topLevelComments.map((comment) => renderComment(comment))
              )}
            </div>
          </section>
        </aside>
      </div>
    )
  }

  function renderComment(comment: CommentItem) {
    const replies = comments.filter((item) => item.parentCommentId === comment.id)
    return (
      <article className="comment-row" key={comment.id}>
        <strong>Member {comment.authorMemberId}</strong>
        <p>{comment.content}</p>
        <span>{formatTime(comment.createdAt)}</span>
        <div className="reply-stack">
          {replies.map((reply) => (
            <div className="reply-row" key={reply.id}>
              <strong>Member {reply.authorMemberId}</strong>
              <p>{reply.content}</p>
            </div>
          ))}
          <div className="reply-composer">
            <input
              value={replyDrafts[comment.id] ?? ''}
              onChange={(event) =>
                setReplyDrafts((current) => ({ ...current, [comment.id]: event.target.value }))
              }
              placeholder="답글"
            />
            <button type="button" onClick={() => submitReply(comment.id)} disabled={!canConnect}>
              <Send size={15} />
            </button>
          </div>
        </div>
      </article>
    )
  }

  function renderChat() {
    return (
      <>
        <section className="control-strip" aria-label="chat controls">
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

        <div className="workspace-grid">
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
                <EmptyState icon={MessageSquareText} text="방을 연결하고 메시지를 보내면 여기에 표시됩니다." />
              ) : (
                chatMessages.map((item, index) => (
                  <article className="message-row" key={`${item.id ?? 'local'}-${index}`}>
                    <div className="avatar">{String(item.senderMemberId).slice(-2)}</div>
                    <div>
                      <div className="message-meta">
                        <strong>Member {item.senderMemberId}</strong>
                        <span>{formatTime(item.createdAt)}</span>
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
            {renderProfilePanel()}
            {renderNotificationPanel()}
            {renderActivityPanel()}
          </aside>
        </div>
      </>
    )
  }

  function renderNotifications() {
    return (
      <div className="workspace-grid">
        <section className="main-column">
          <div className="section-heading">
            <div>
              <span className="eyebrow">Notifications</span>
              <h2>알림 수신함</h2>
            </div>
            <button
              className="icon-text-button"
              type="button"
              onClick={loadNotifications}
              disabled={!canConnect}
            >
              <RefreshCw size={16} />
              동기화
            </button>
          </div>
          {renderNotificationPanel()}
        </section>
        <aside className="side-column">
          {renderProfilePanel()}
          {renderActivityPanel()}
        </aside>
      </div>
    )
  }

  function renderProfilePanel() {
    return (
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
    )
  }

  function renderNotificationPanel() {
    return (
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
    )
  }

  function renderActivityPanel() {
    return (
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
    )
  }
}

function EmptyState({
  icon: Icon,
  text,
}: {
  icon: typeof BookOpen
  text: string
}) {
  return (
    <div className="empty-state">
      <Icon size={28} />
      <p>{text}</p>
    </div>
  )
}

function formatTime(value?: string | null) {
  if (!value) return 'now'
  return new Intl.DateTimeFormat('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function actionLabel(action: 'join' | 'leave' | 'close') {
  if (action === 'join') return '참여'
  if (action === 'leave') return '탈퇴'
  return '마감'
}

export default App
