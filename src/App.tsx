import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { Client } from '@stomp/stompjs'
import {
  Bell,
  BookOpen,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  CircleAlert,
  Circle,
  ArrowLeft,
  House,
  KeyRound,
  LogIn,
  LogOut,
  MessageSquareText,
  Newspaper,
  PanelLeftClose,
  PanelLeftOpen,
  Plug,
  Plus,
  PencilLine,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Send,
  Settings2,
  Trash2,
  User,
  Users,
  X,
} from 'lucide-react'
import './App.css'
import { consumeOAuthCallback } from './auth'
import {
  closeStudy,
  completeSignup,
  approveStudyJoinRequest,
  cancelStudyJoinRequest,
  createComment,
  createPost,
  createPrivateChatRoom,
  createStudy,
  createStudyChatRoom,
  deleteChatRoom,
  deleteComment,
  deleteNotification,
  deletePost,
  deleteStudy,
  endStudy,
  fetchChatRoomMembers,
  fetchChatMessages,
  fetchChatRooms,
  fetchComments,
  fetchMe,
  fetchMyStudies,
  fetchNotifications,
  fetchPost,
  fetchPosts,
  fetchStudy,
  fetchStudyJoinRequests,
  fetchStudies,
  hideAllStudyHistory,
  hideStudyHistory,
  joinStudy,
  leaveStudy,
  logoutSession,
  markNotificationRead,
  oauthLoginUrl,
  refreshAccessToken,
  replyToComment,
  rejectStudyJoinRequest,
  updateNickname,
  updateComment,
  updatePost,
  updateStudy,
  withdrawAccount,
  ApiClientError,
} from './api'
import { API_BASE_URL } from './config'
import { createRealtimeClient, sendChatMessage } from './realtime'
import type {
  AccessTokenResponse,
  AuthProfile,
  ChatMessage,
  ChatRoom,
  ChatRoomMember,
  CommentItem,
  ConnectionStatus,
  NotificationItem,
  OAuthProvider,
  PostBoardType,
  PostItem,
  StudyHistory,
  StudyItem,
  StudyJoinRequest,
  WorkspaceView,
} from './types'

const navItems: Array<{ id: WorkspaceView; label: string; icon: typeof BookOpen }> = [
  { id: 'lobby', label: '홈', icon: House },
  { id: 'studies', label: '스터디', icon: BookOpen },
  { id: 'posts', label: '커뮤니티', icon: Newspaper },
  { id: 'chat', label: '채팅', icon: MessageSquareText },
]

const communityBoards = [
  { id: 'free', label: '자유게시판', boardType: 'FREE' },
  { id: 'question', label: '질문게시판', boardType: 'QUESTION' },
  { id: 'review', label: '후기게시판', boardType: 'REVIEW' },
  { id: 'notice', label: '공지사항', boardType: 'NOTICE' },
] as const

type CommunityBoardId = (typeof communityBoards)[number]['id']

function communityBoardType(boardId: CommunityBoardId): PostBoardType {
  return communityBoards.find((board) => board.id === boardId)?.boardType ?? 'FREE'
}

function communityBoardId(boardType: PostBoardType): CommunityBoardId {
  return communityBoards.find((board) => board.boardType === boardType)?.id ?? 'free'
}

const postPageSize = 20

type CommunityRoute = {
  boardId: CommunityBoardId
  postId?: number
}

function communityPath(boardId: CommunityBoardId, postId?: number) {
  return postId ? `/community/${boardId}/${postId}` : `/community/${boardId}`
}

function parseCommunityRoute(pathname: string): CommunityRoute | null {
  const parts = pathname.split('/').filter(Boolean)
  if (parts[0] !== 'community') return null
  const board = communityBoards.find((item) => item.id === parts[1])
  if (!board) return null
  if (parts[2] == null) return { boardId: board.id }
  const postId = Number(parts[2])
  if (!Number.isInteger(postId) || postId <= 0) return null
  return { boardId: board.id, postId }
}

const recruitingStudyStatuses = new Set(['OPEN', 'RECRUITING'])

const oauthProviders: Array<{ id: OAuthProvider; label: string }> = [
  { id: 'google', label: 'Google' },
  { id: 'kakao', label: 'Kakao' },
]

const initialOAuthToken = consumeOAuthCallback()

const emptyStudyForm = {
  title: '',
  progressMethod: '',
  targetAudience: '',
  rules: '',
  capacity: '',
  schedule: '',
}
type StudyForm = typeof emptyStudyForm
type StudyFormField = keyof StudyForm
type StudyFormErrors = Partial<Record<StudyFormField, string>>

const studyFormFieldOrder: StudyFormField[] = [
  'title',
  'progressMethod',
  'targetAudience',
  'capacity',
  'schedule',
  'rules',
]
const studyFormFieldLabels: Record<StudyFormField, string> = {
  title: '제목',
  progressMethod: '진행 방식',
  targetAudience: '모집 대상',
  rules: '규칙',
  capacity: '정원',
  schedule: '일정',
}
const studyFormFieldExamples: Record<StudyFormField, string> = {
  title: '매일 알고리즘 1문제',
  progressMethod: '매주 화/목 21시에 온라인으로 진행',
  targetAudience: 'Java 기초를 끝내고 알고리즘을 시작하려는 사람',
  rules: '불참 시 전날 공유, 풀이 인증 필수',
  capacity: '6',
  schedule: '매주 화요일 21:00',
}
const studyFormFieldMaxLengths: Partial<Record<StudyFormField, number>> = {
  title: 100,
  progressMethod: 500,
  targetAudience: 500,
  rules: 1000,
  schedule: 200,
}
const emptyPostForm = { title: '', content: '' }
const emptyStudyHistory: StudyHistory = { activeStudies: [], pastStudies: [] }
type StudyBoardMode = 'list' | 'write'
type StudyListScope = 'recruiting' | 'active'
type StudyAction = 'join' | 'leave' | 'close' | 'end' | 'delete' | 'hideHistory'
type PostBoardMode = 'list' | 'detail' | 'write'
type ToastKind = 'success' | 'error' | 'info'
type ToastMessage = {
  id: number
  kind: ToastKind
  title: string
  message?: string
}
type StudyConfirmAction =
  | { type: 'study'; studyId: number; action: 'delete' | 'hideHistory'; title: string; message: string; confirmLabel: string }
  | { type: 'allHistory'; title: string; message: string; confirmLabel: string }

const studyListScopes: Array<{ id: StudyListScope; label: string }> = [
  { id: 'recruiting', label: '모집 중' },
  { id: 'active', label: '참여 중' },
]

async function fetchVisibleStudies(token?: string) {
  if (token) {
    try {
      return await fetchStudies(token)
    } catch {
      return fetchStudies()
    }
  }
  return fetchStudies()
}

async function fetchVisibleStudy(studyId: number, token?: string) {
  if (token) {
    try {
      return await fetchStudy(studyId, token)
    } catch {
      return fetchStudy(studyId)
    }
  }
  return fetchStudy(studyId)
}

function App() {
  const [activeView, setActiveView] = useState<WorkspaceView>('lobby')
  const [accessToken, setAccessToken] = useState(initialOAuthToken?.accessToken ?? '')
  const [tokenExpiresAt, setTokenExpiresAt] = useState<string | null>(
    initialOAuthToken?.accessTokenExpiresAt ?? null,
  )
  const [roomId, setRoomId] = useState('')
  const [message, setMessage] = useState('')
  const [status, setStatus] = useState<ConnectionStatus>('idle')
  const [profile, setProfile] = useState<AuthProfile | null>(null)
  const [chatRooms, setChatRooms] = useState<ChatRoom[]>([])
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatMembers, setChatMembers] = useState<ChatRoomMember[]>([])
  const [notifications, setNotifications] = useState<NotificationItem[]>([])
  const [studies, setStudies] = useState<StudyItem[]>([])
  const [myStudyHistory, setMyStudyHistory] = useState<StudyHistory>(emptyStudyHistory)
  const [selectedStudy, setSelectedStudy] = useState<StudyItem | null>(null)
  const [studyJoinRequests, setStudyJoinRequests] = useState<StudyJoinRequest[]>([])
  const [studyBoardMode, setStudyBoardMode] = useState<StudyBoardMode>('list')
  const [studyListScope, setStudyListScope] = useState<StudyListScope>('recruiting')
  const [editingStudyId, setEditingStudyId] = useState<number | null>(null)
  const [posts, setPosts] = useState<PostItem[]>([])
  const [selectedPost, setSelectedPost] = useState<PostItem | null>(null)
  const [editingPostId, setEditingPostId] = useState<number | null>(null)
  const [postBoardMode, setPostBoardMode] = useState<PostBoardMode>('list')
  const [selectedCommunityBoard, setSelectedCommunityBoard] =
    useState<CommunityBoardId>('free')
  const [postPage, setPostPage] = useState(0)
  const [hasNextPostPage, setHasNextPostPage] = useState(false)
  const [postSearchKeyword, setPostSearchKeyword] = useState('')
  const [comments, setComments] = useState<CommentItem[]>([])
  const [studyForm, setStudyForm] = useState(emptyStudyForm)
  const [studyFormErrors, setStudyFormErrors] = useState<StudyFormErrors>({})
  const [postForm, setPostForm] = useState(emptyPostForm)
  const [nicknameDraft, setNicknameDraft] = useState('')
  const [nicknameError, setNicknameError] = useState('')
  const [toast, setToast] = useState<ToastMessage | null>(null)
  const [isNicknameSaving, setIsNicknameSaving] = useState(false)
  const [termsAgreed, setTermsAgreed] = useState(false)
  const [privacyPolicyAgreed, setPrivacyPolicyAgreed] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [replyDrafts, setReplyDrafts] = useState<Record<number, string>>({})
  const [editingCommentId, setEditingCommentId] = useState<number | null>(null)
  const [commentEditText, setCommentEditText] = useState('')
  const [commentDeleteTarget, setCommentDeleteTarget] = useState<CommentItem | null>(null)
  const [studyConfirmAction, setStudyConfirmAction] = useState<StudyConfirmAction | null>(null)
  const [lobbySlideIndex, setLobbySlideIndex] = useState(0)
  const [showDevTools, setShowDevTools] = useState(false)
  const [showNotificationMenu, setShowNotificationMenu] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showAccountManagementModal, setShowAccountManagementModal] = useState(false)
  const [showWithdrawalConfirm, setShowWithdrawalConfirm] = useState(false)
  const [showChatMembers, setShowChatMembers] = useState(false)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false)
  const [sessionChecked, setSessionChecked] = useState(Boolean(initialOAuthToken))
  const [log, setLog] = useState<string[]>(
    initialOAuthToken
      ? ['로그인 처리 완료', '프론트가 준비되었습니다.']
      : ['프론트가 준비되었습니다.'],
  )
  const clientRef = useRef<Client | null>(null)

  const canConnect = accessToken.trim().length > 0
  const needsSignup = profile?.signupRequired === true
    || profile?.nicknameRequired === true
    || profile?.termsAgreementRequired === true
  const selectedPostId = selectedPost?.id ?? null
  const profileImageSrc =
    profile?.profileImageUrl ?? avatarDataUrl(profile?.nickname ?? profile?.email ?? 'StudyWithMe')
  const recruitingStudies = useMemo(
    () => studies.filter((study) => isStudyRecruiting(study.status)),
    [studies],
  )
  const visibleStudyItems = useMemo(() => {
    if (studyListScope === 'active') return myStudyHistory.activeStudies
    return recruitingStudies
  }, [myStudyHistory.activeStudies, recruitingStudies, studyListScope])
  const activeRoom = useMemo(
    () => chatRooms.find((room) => String(room.id) === roomId.trim()),
    [chatRooms, roomId],
  )
  const knownStudies = useMemo(
    () => [...studies, ...myStudyHistory.activeStudies, ...myStudyHistory.pastStudies],
    [myStudyHistory.activeStudies, myStudyHistory.pastStudies, studies],
  )
  const activeRoomStudy = activeRoom?.studyId == null
    ? null
    : knownStudies.find((study) => study.id === activeRoom.studyId) ?? null
  const isActiveRoomReadOnly = activeRoomStudy != null
    && (isStudyEnded(activeRoomStudy.status) || isStudyDeleted(activeRoomStudy.status))
  const activeRoomLabel = activeRoom ? chatRoomTitle(activeRoom, knownStudies) : '방 미선택'
  const activeProfileMemberId = profile?.memberId ?? profile?.id ?? null

  const appendLog = useCallback((item: string) => {
    setLog((current) => [item, ...current].slice(0, 8))
  }, [])

  const showToast = useCallback((kind: ToastKind, title: string, message?: string) => {
    setToast({
      id: Date.now(),
      kind,
      title,
      message: message && message !== title ? message : undefined,
    })
  }, [])

  const applyProfile = useCallback((nextProfile: AuthProfile | null) => {
    setProfile(nextProfile)
    setNicknameDraft(nextProfile?.nickname ?? '')
    setNicknameError('')
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
  const filteredPosts = useMemo(() => {
    const keyword = postSearchKeyword.trim().toLowerCase()
    if (!keyword) return posts
    return posts.filter((post) =>
      `${post.title} ${post.content} ${authorDisplayName(post)}`.toLowerCase().includes(keyword),
    )
  }, [postSearchKeyword, posts])
  const unreadNotifications = useMemo(
    () => notifications.filter((item) => !item.read).length,
    [notifications],
  )
  const isAdmin = profile?.roles?.includes('ADMIN') === true

  useEffect(() => {
    if (!toast) return undefined
    const timer = window.setTimeout(() => setToast(null), 4200)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (!canConnect || needsSignup) return undefined
    let cancelled = false

    async function loadInitialContent() {
      try {
        const [studyItems, postItems] = await Promise.all([
          fetchVisibleStudies(accessToken.trim()),
          fetchPosts(accessToken.trim(), 'FREE'),
        ])
        if (cancelled) return
        setStudies(studyItems)
        setPosts(postItems)
      } catch (error) {
        const message = errorMessage(error, '데이터를 불러오지 못했습니다.')
        appendLog(message)
        showToast('error', '데이터를 불러오지 못했습니다.', message)
      }
    }

    void loadInitialContent()
    return () => {
      cancelled = true
    }
  }, [accessToken, appendLog, canConnect, needsSignup, showToast])

  useEffect(() => {
    if (!canConnect || needsSignup) return undefined

    function applyCommunityRoute() {
      const route = parseCommunityRoute(window.location.pathname)
      if (!route) return

      setActiveView('posts')
      setSelectedCommunityBoard(route.boardId)
      setEditingPostId(null)
      setPostForm(emptyPostForm)
      setPostSearchKeyword('')

      if (route.postId == null) {
        setSelectedPost(null)
        setComments([])
        setPostBoardMode('list')
        void loadPosts(route.boardId, 0)
        return
      }

      void loadPosts(route.boardId, 0)
      void selectPost(route.postId, { pushRoute: false })
    }

    applyCommunityRoute()
    window.addEventListener('popstate', applyCommunityRoute)
    return () => window.removeEventListener('popstate', applyCommunityRoute)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, canConnect, needsSignup])

  useEffect(() => {
    if (!showAccountManagementModal) return undefined

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setShowAccountManagementModal(false)
        setShowWithdrawalConfirm(false)
      }
    }

    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [showAccountManagementModal])

  useEffect(() => {
    if (!initialOAuthToken) return undefined
    let cancelled = false

    async function loadInitialProfile() {
      try {
        const token = initialOAuthToken?.accessToken ?? ''
        const me = await fetchMe(token)
        if (!cancelled) {
          applyProfile(me)
        }
        if (cancelled || isSignupRequired(me)) return

        const [items, rooms, history] = await Promise.all([
          fetchNotifications(token),
          fetchChatRooms(token),
          fetchMyStudies(token),
        ])
        if (!cancelled) {
          setNotifications(items)
          setChatRooms(rooms)
          setMyStudyHistory(history)
          appendLog('내 정보 조회 성공')
        }
      } catch (error) {
        if (!cancelled) {
          const message = errorMessage(error, '내 정보를 불러오지 못했습니다.')
          appendLog(message)
          showToast('error', '내 정보를 불러오지 못했습니다.', message)
        }
      }
    }

    void loadInitialProfile()
    return () => {
      cancelled = true
    }
  }, [appendLog, applyProfile, showToast])

  useEffect(() => {
    if (initialOAuthToken) return
    let cancelled = false

    async function restoreSession() {
      try {
        const token = await refreshAccessToken()
        if (cancelled) return
        applyToken(token)
        const me = await fetchMe(token.accessToken)
        if (cancelled) return
        applyProfile(me)
        if (isSignupRequired(me)) return

        const [items, history, rooms] = await Promise.all([
          fetchNotifications(token.accessToken),
          fetchMyStudies(token.accessToken),
          fetchChatRooms(token.accessToken),
        ])
        if (cancelled) return
        setNotifications(items)
        setMyStudyHistory(history)
        setChatRooms(rooms)
        appendLog('세션 자동 복구 완료')
      } catch {
        if (!cancelled) {
          appendLog('로그인이 필요합니다')
        }
      } finally {
        if (!cancelled) {
          setSessionChecked(true)
        }
      }
    }

    void restoreSession()
    return () => {
      cancelled = true
    }
  }, [appendLog, applyProfile, applyToken])

  function startOAuth(provider: OAuthProvider) {
    window.location.assign(oauthLoginUrl(provider))
  }

  async function refreshSession() {
    try {
      const token = await refreshAccessToken()
      applyToken(token)
      appendLog('access token 재발급 성공')
      showToast('success', '세션이 갱신되었습니다.')
    } catch (error) {
      reportRequestError(error, '세션을 갱신하지 못했습니다.')
    }
  }

  async function logout() {
    try {
      await logoutSession()
      clearAuthenticatedState()
      appendLog('로그아웃 완료')
    } catch (error) {
      reportRequestError(error, '로그아웃하지 못했습니다.')
    }
  }

  async function withdrawCurrentAccount() {
    if (!canConnect || isNicknameSaving) return

    try {
      setIsNicknameSaving(true)
      await withdrawAccount(accessToken.trim())
      clearAuthenticatedState()
      appendLog('회원 탈퇴 완료')
      showToast('success', '회원 탈퇴가 완료되었습니다.')
    } catch (error) {
      reportRequestError(error, '회원 탈퇴를 진행하지 못했습니다.')
    } finally {
      setIsNicknameSaving(false)
    }
  }

  function clearAuthenticatedState() {
    disconnectRealtime()
    setAccessToken('')
    setTokenExpiresAt(null)
    applyProfile(null)
    setNotifications([])
    setChatRooms([])
    setChatMessages([])
    setChatMembers([])
    setStudies([])
    setMyStudyHistory(emptyStudyHistory)
    setSelectedStudy(null)
    setEditingStudyId(null)
    setStudyForm(emptyStudyForm)
    setStudyFormErrors({})
    setStudyBoardMode('list')
    setPosts([])
    setSelectedPost(null)
    setComments([])
    setPostBoardMode('list')
    setPostSearchKeyword('')
    setEditingCommentId(null)
    setCommentEditText('')
    setShowNotificationMenu(false)
    setShowProfileMenu(false)
    setShowAccountManagementModal(false)
    setShowWithdrawalConfirm(false)
    setShowChatMembers(false)
    setTermsAgreed(false)
    setPrivacyPolicyAgreed(false)
    setSessionChecked(true)
  }

  async function loadProfile() {
    if (!canConnect) return
    try {
      const me = await fetchMe(accessToken.trim())
      applyProfile(me)
      appendLog('내 정보 조회 성공')
    } catch (error) {
      reportRequestError(error, '내 정보를 불러오지 못했습니다.')
    }
  }

  async function submitNickname() {
    const nickname = nicknameDraft.trim()
    if (!canConnect || isNicknameSaving) return
    if (!isValidNickname(nickname)) {
      setNicknameError('2~20자의 한글, 영문, 숫자, 밑줄만 사용할 수 있습니다.')
      return
    }

    try {
      setIsNicknameSaving(true)
      setNicknameError('')
      const updatedProfile = await updateNickname(accessToken.trim(), nickname)
      applyProfile(updatedProfile)
      setActiveView('lobby')
      appendLog('별명 설정 완료')
      showToast('success', '별명이 저장되었습니다.')
      await Promise.all([loadStudies(), loadMyStudies(), loadChatRooms()])
    } catch (error) {
      const message = errorMessage(error, '별명을 저장하지 못했습니다.')
      setNicknameError(message)
      appendLog(message)
      if (isSessionExpired(error)) {
        showToast('error', '로그인이 필요합니다.', '다시 로그인해 주세요.')
        clearAuthenticatedState()
      }
    } finally {
      setIsNicknameSaving(false)
    }
  }

  async function submitSignup() {
    const nickname = nicknameDraft.trim()
    if (!canConnect || isNicknameSaving) return
    if (!isValidNickname(nickname)) {
      setNicknameError('2~20자의 한글, 영문, 숫자, 밑줄만 사용할 수 있습니다.')
      return
    }
    if (!termsAgreed || !privacyPolicyAgreed) {
      setNicknameError('필수 약관에 모두 동의해야 가입할 수 있습니다.')
      return
    }

    try {
      setIsNicknameSaving(true)
      setNicknameError('')
      const updatedProfile = await completeSignup(
        accessToken.trim(),
        nickname,
        termsAgreed,
        privacyPolicyAgreed,
      )
      applyProfile(updatedProfile)
      setTermsAgreed(false)
      setPrivacyPolicyAgreed(false)
      setActiveView('lobby')
      appendLog('회원가입 완료')
      showToast('success', '가입이 완료되었습니다.')
      await Promise.all([loadStudies(), loadMyStudies(), loadChatRooms()])
    } catch (error) {
      const message = errorMessage(error, '회원가입을 완료하지 못했습니다.')
      setNicknameError(message)
      appendLog(message)
      if (isSessionExpired(error)) {
        showToast('error', '로그인이 필요합니다.', '다시 로그인해 주세요.')
        clearAuthenticatedState()
      }
    } finally {
      setIsNicknameSaving(false)
    }
  }

  async function loadNotifications() {
    if (!canConnect) return
    try {
      const items = await fetchNotifications(accessToken.trim())
      setNotifications(items)
      appendLog(`알림 ${items.length}개 동기화`)
    } catch (error) {
      reportRequestError(error, '알림을 불러오지 못했습니다.')
    }
  }

  async function loadChatRooms(token = accessToken.trim()) {
    if (!token) return []
    try {
      const rooms = await fetchChatRooms(token)
      setChatRooms(rooms)
      appendLog(`채팅방 ${rooms.length}개 동기화`)
      return rooms
    } catch (error) {
      reportRequestError(error, '채팅방을 불러오지 못했습니다.')
      return []
    }
  }

  async function loadStudies() {
    try {
      const items = await fetchVisibleStudies(accessToken.trim())
      setStudies(items)
      setSelectedStudy((current) =>
        current ? (items.find((item) => item.id === current.id) ?? null) : null,
      )
    } catch (error) {
      reportRequestError(error, '스터디 목록을 불러오지 못했습니다.')
    }
  }

  async function loadMyStudies(token = accessToken.trim()) {
    if (!token) return null
    try {
      const history = await fetchMyStudies(token)
      setMyStudyHistory(history)
      appendLog('내 스터디 이력 동기화')
      return history
    } catch (error) {
      reportRequestError(error, '내 스터디 이력을 불러오지 못했습니다.')
      return null
    }
  }

  async function selectStudy(studyId: number) {
    try {
      const item = await fetchVisibleStudy(studyId, accessToken.trim())
      setSelectedStudy(item)
      if (item.ownedByRequester) {
        await loadStudyJoinRequests(item.id)
      } else {
        setStudyJoinRequests([])
      }
    } catch (error) {
      reportRequestError(error, '스터디 상세를 불러오지 못했습니다.')
    }
  }

  async function openStudyHistoryDetail(study: StudyItem) {
    setSelectedStudy(study)
    if (study.ownedByRequester && !isStudyEnded(study.status) && !isStudyDeleted(study.status)) {
      await loadStudyJoinRequests(study.id)
    } else {
      setStudyJoinRequests([])
    }
  }

  async function loadStudyJoinRequests(studyId: number) {
    if (!canConnect) return
    try {
      const requests = await fetchStudyJoinRequests(accessToken.trim(), studyId)
      setStudyJoinRequests(requests)
    } catch {
      setStudyJoinRequests([])
    }
  }

  async function toggleStudyDetail(studyId: number) {
    if (selectedStudy?.id === studyId) {
      setSelectedStudy(null)
      return
    }
    await selectStudy(studyId)
  }

  async function openStudyChatRoom(studyId: number) {
    if (!canConnect) return
    try {
      const room = await createStudyChatRoom(accessToken.trim(), studyId)
      setSelectedStudy(null)
      setStudyJoinRequests([])
      setActiveView('chat')
      await loadChatRooms()
      await loadChatMessages(room.id)
      appendLog('스터디 채팅방 준비 완료')
    } catch (error) {
      reportRequestError(error, '스터디 채팅방을 열지 못했습니다.')
    }
  }

  async function openPrivateChatRoom(targetMemberId: number) {
    if (!canConnect) return
    try {
      const room = await createPrivateChatRoom(accessToken.trim(), targetMemberId)
      setSelectedStudy(null)
      setStudyJoinRequests([])
      setActiveView('chat')
      await loadChatRooms()
      await loadChatMessages(room.id)
      appendLog('1:1 채팅방 준비 완료')
    } catch (error) {
      reportRequestError(error, '1:1 채팅방을 열지 못했습니다.')
    }
  }

  async function submitStudy() {
    if (!canConnect) {
      showToast('error', '로그인이 필요합니다.', '다시 로그인해 주세요.')
      return
    }

    const validation = validateStudyForm(studyForm)
    if (Object.keys(validation.errors).length > 0) {
      setStudyFormErrors(validation.errors)
      showToast('error', '스터디 정보를 확인해 주세요.', validation.firstMessage)
      return
    }

    const capacity = Number(studyForm.capacity)
    const payload = {
      title: studyForm.title.trim(),
      progressMethod: studyForm.progressMethod.trim(),
      targetAudience: studyForm.targetAudience.trim(),
      rules: studyForm.rules.trim(),
      capacity,
      schedule: studyForm.schedule.trim(),
    }
    try {
      const saved = editingStudyId == null
        ? await createStudy(accessToken.trim(), payload)
        : await updateStudy(accessToken.trim(), editingStudyId, payload)
      resetStudyEditor()
      await loadStudies()
      await loadMyStudies()
      setSelectedStudy(saved)
      setStudyBoardMode('list')
      appendLog(editingStudyId == null ? '스터디 생성 완료' : '스터디 수정 완료')
      showToast('success', editingStudyId == null ? '스터디가 생성되었습니다.' : '스터디가 수정되었습니다.')
    } catch (error) {
      const serverErrors = studyFormErrorsFromApiError(error)
      if (Object.keys(serverErrors).length > 0) {
        const firstMessage = firstStudyFormErrorMessage(serverErrors)
        setStudyFormErrors(serverErrors)
        showToast('error', '입력값을 확인해 주세요.', firstMessage)
        appendLog(firstMessage)
        return
      }

      if (isInvalidInputError(error)) {
        const message = '서버가 필드 정보를 주지 않았습니다. 제목, 진행 방식, 모집 대상, 정원, 일정, 규칙을 다시 확인해 주세요.'
        showToast('error', '입력값을 확인해 주세요.', message)
        appendLog(message)
        return
      }

      reportRequestError(error, editingStudyId == null ? '스터디를 생성하지 못했습니다.' : '스터디를 수정하지 못했습니다.')
    }
  }

  function resetStudyEditor() {
    setStudyForm(emptyStudyForm)
    setStudyFormErrors({})
    setEditingStudyId(null)
  }

  function updateStudyFormField(field: StudyFormField, value: string) {
    setStudyForm((current) => ({ ...current, [field]: value }))
    setStudyFormErrors((current) => {
      if (!current[field]) return current
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  function openCreateStudyEditor() {
    resetStudyEditor()
    setSelectedStudy(null)
    setStudyBoardMode('write')
  }

  function openEditStudyEditor(study: StudyItem) {
    const detail = studyDetail(study)
    setStudyForm({
      title: study.title,
      progressMethod: detail.progressMethod,
      targetAudience: detail.targetAudience,
      rules: detail.rules,
      capacity: study.capacity == null ? '' : String(study.capacity),
      schedule: detail.schedule === '협의' ? '' : detail.schedule,
    })
    setEditingStudyId(study.id)
    setStudyFormErrors({})
    setSelectedStudy(study)
    setStudyBoardMode('write')
  }

  async function mutateStudy(studyId: number, action: StudyAction) {
    if (!canConnect) return
    const wasSelected = selectedStudy?.id === studyId
    try {
      if (action === 'join') await joinStudy(accessToken.trim(), studyId)
      if (action === 'leave') await leaveStudy(accessToken.trim(), studyId)
      if (action === 'close') await closeStudy(accessToken.trim(), studyId)
      if (action === 'end') await endStudy(accessToken.trim(), studyId)
      if (action === 'delete') await deleteStudy(accessToken.trim(), studyId)
      if (action === 'hideHistory') await hideStudyHistory(accessToken.trim(), studyId)
      await loadStudies()
      await loadChatRooms()
      await loadMyStudies()
      await loadNotifications()
      if (selectedStudy?.ownedByRequester) {
        await loadStudyJoinRequests(studyId)
      }
      if (action === 'close' || action === 'end' || action === 'delete' || action === 'hideHistory') {
        setSelectedStudy(null)
      } else if (wasSelected) {
        await selectStudy(studyId)
      }
      appendLog(`스터디 ${actionLabel(action)} 완료`)
      showToast('success', studyActionSuccessMessage(action))
    } catch (error) {
      reportRequestError(error, studyActionFailureMessage(action))
    }
  }

  function requestStudyMutation(studyId: number, action: StudyAction) {
    if (action === 'delete') {
      setStudyConfirmAction({
        type: 'study',
        studyId,
        action,
        title: '스터디 삭제',
        message: '스터디를 삭제할까요?',
        confirmLabel: '삭제',
      })
      return
    }
    if (action === 'hideHistory') {
      setStudyConfirmAction({
        type: 'study',
        studyId,
        action,
        title: '지난 스터디 목록 삭제',
        message: '이 스터디를 지난 스터디 목록에서 삭제할까요?',
        confirmLabel: '목록에서 삭제',
      })
      return
    }
    void mutateStudy(studyId, action)
  }

  function requestHideAllStudyHistory() {
    if (myStudyHistory.pastStudies.length === 0) return
    setStudyConfirmAction({
      type: 'allHistory',
      title: '지난 스터디 전체 삭제',
      message: '지난 스터디 목록을 모두 비울까요?',
      confirmLabel: '전체 삭제',
    })
  }

  async function confirmStudyAction() {
    if (!studyConfirmAction || !canConnect) return
    const action = studyConfirmAction
    setStudyConfirmAction(null)
    if (action.type === 'study') {
      await mutateStudy(action.studyId, action.action)
      return
    }
    try {
      await hideAllStudyHistory(accessToken.trim())
      await loadMyStudies()
      appendLog('지난 스터디 전체 목록 삭제 완료')
      showToast('success', '지난 스터디 목록을 비웠습니다.')
    } catch (error) {
      reportRequestError(error, '지난 스터디 목록을 비우지 못했습니다.')
    }
  }

  async function approveJoinRequest(studyId: number, memberId: number) {
    if (!canConnect) return
    try {
      await approveStudyJoinRequest(accessToken.trim(), studyId, memberId)
      await Promise.all([
        loadStudies(),
        loadMyStudies(),
        loadChatRooms(),
        loadNotifications(),
        loadStudyJoinRequests(studyId),
      ])
      if (selectedStudy?.id === studyId) {
        await selectStudy(studyId)
      }
      showToast('success', '참여 신청을 승인했습니다.')
    } catch (error) {
      reportRequestError(error, '참여 신청을 승인하지 못했습니다.')
    }
  }

  async function rejectJoinRequest(studyId: number, memberId: number) {
    if (!canConnect) return
    try {
      await rejectStudyJoinRequest(accessToken.trim(), studyId, memberId)
      await Promise.all([loadNotifications(), loadStudyJoinRequests(studyId)])
      showToast('success', '참여 신청을 거절했습니다.')
    } catch (error) {
      reportRequestError(error, '참여 신청을 거절하지 못했습니다.')
    }
  }

  async function cancelJoinRequest(studyId: number) {
    if (!canConnect) return
    try {
      await cancelStudyJoinRequest(accessToken.trim(), studyId)
      await Promise.all([loadStudies(), loadMyStudies(), loadNotifications()])
      if (selectedStudy?.id === studyId) {
        await selectStudy(studyId)
      }
      showToast('success', '참여 신청을 취소했습니다.')
    } catch (error) {
      reportRequestError(error, '참여 신청을 취소하지 못했습니다.')
    }
  }

  async function openNotification(item: NotificationItem) {
    setShowNotificationMenu(false)
    setShowProfileMenu(false)
    void markNotificationReadLocally(item)

    if (item.targetType === 'CHAT_ROOM') {
      setActiveView('chat')
      await loadChatRooms()
      await loadChatMessages(item.targetId)
      return
    }

    if (item.targetType !== 'STUDY') {
      return
    }

    const notificationType = item.type.toUpperCase()
    if (notificationType === 'STUDY_JOIN_REQUESTED') {
      setActiveView('studies')
      setStudyListScope('active')
      await selectStudy(item.targetId)
      return
    }

    if (notificationType === 'STUDY_JOIN_APPROVED') {
      const history = await loadMyStudies()
      setActiveView('studies')
      setStudyListScope('active')
      const activeStudy = history?.activeStudies.find((study) => study.id === item.targetId)
      if (activeStudy) {
        await openStudyHistoryDetail(activeStudy)
        return
      }
      await selectStudy(item.targetId)
      return
    }

    if (notificationType === 'STUDY_ENDED' || notificationType === 'STUDY_DELETED') {
      const history = await loadMyStudies()
      setActiveView('mypage')
      const pastStudy = history?.pastStudies.find((study) => study.id === item.targetId)
      if (pastStudy) {
        await openStudyHistoryDetail(pastStudy)
      }
      return
    }

    setActiveView('studies')
    setStudyListScope('recruiting')
    await loadStudies()
    await selectStudy(item.targetId)
  }

  async function markNotificationReadLocally(item: NotificationItem) {
    if (!item.id || item.read) return
    try {
      const updated = await markNotificationRead(accessToken.trim(), item.id)
      setNotifications((current) =>
        current.map((notification) =>
          notification.id === updated.id ? updated : notification,
        ),
      )
    } catch {
      setNotifications((current) =>
        current.map((notification) =>
          notification.id === item.id
            ? { ...notification, read: true, readAt: new Date().toISOString() }
            : notification,
        ),
      )
    }
  }

  async function markAllNotificationsRead() {
    const unreadItems = notifications.filter((item) => item.id && !item.read)
    if (unreadItems.length === 0) return

    await Promise.all(unreadItems.map((item) => markNotificationReadLocally(item)))
  }

  async function removeNotification(item: NotificationItem) {
    if (!item.id) return
    try {
      await deleteNotification(accessToken.trim(), item.id)
      setNotifications((current) =>
        current.filter((notification) => notification.id !== item.id),
      )
    } catch (error) {
      reportRequestError(error, '알림을 삭제하지 못했습니다.')
    }
  }

  function isStudyJoined(studyId: number) {
    return (
      studies.find((study) => study.id === studyId)?.joinedByRequester === true ||
      myStudyHistory.activeStudies.find((study) => study.id === studyId)?.joinedByRequester === true ||
      myStudyHistory.pastStudies.find((study) => study.id === studyId)?.joinedByRequester === true ||
      (selectedStudy?.id === studyId && selectedStudy.joinedByRequester === true)
    )
  }

  function isStudyJoinRequested(study: StudyItem) {
    return study.joinRequestedByRequester === true
  }

  function pushCommunityRoute(boardId: CommunityBoardId, postId?: number) {
    const nextPath = communityPath(boardId, postId)
    if (window.location.pathname !== nextPath) {
      window.history.pushState(null, '', nextPath)
    }
  }

  async function loadPosts(
    boardId: CommunityBoardId = selectedCommunityBoard,
    page = postPage,
  ) {
    try {
      const items = await fetchPosts(
        accessToken.trim(),
        communityBoardType(boardId),
        page,
        postPageSize,
      )
      setPosts(items)
      setPostPage(page)
      setHasNextPostPage(items.length === postPageSize)
    } catch (error) {
      reportRequestError(error, '커뮤니티 글을 불러오지 못했습니다.')
    }
  }

  async function selectPost(postId: number, options: { pushRoute?: boolean } = {}) {
    try {
      const [post, postComments] = await Promise.all([
        fetchPost(postId, accessToken.trim()),
        fetchComments(postId, accessToken.trim()),
      ])
      const boardId = communityBoardId(post.boardType)
      setSelectedCommunityBoard(boardId)
      setSelectedPost(post)
      setComments(postComments)
      setPostBoardMode('detail')
      if (options.pushRoute !== false) {
        pushCommunityRoute(boardId, post.id)
      }
    } catch (error) {
      reportRequestError(error, '글 상세를 불러오지 못했습니다.')
    }
  }

  async function submitPost() {
    if (!canConnect || !postForm.title.trim() || !postForm.content.trim()) return
    if (communityBoardType(selectedCommunityBoard) === 'NOTICE' && !isAdmin) {
      showToast('error', '공지사항은 관리자만 작성할 수 있습니다.')
      return
    }
    try {
      const post = editingPostId
        ? await updatePost(accessToken.trim(), editingPostId, {
            title: postForm.title.trim(),
            content: postForm.content.trim(),
          })
        : await createPost(accessToken.trim(), {
            boardType: communityBoardType(selectedCommunityBoard),
            title: postForm.title.trim(),
            content: postForm.content.trim(),
          })
      setPostForm(emptyPostForm)
      setEditingPostId(null)
      await loadPosts(communityBoardId(post.boardType), 0)
      await selectPost(post.id)
      setPostBoardMode('detail')
      appendLog(editingPostId ? '게시글 수정 완료' : '게시글 작성 완료')
      showToast('success', editingPostId ? '글이 수정되었습니다.' : '글이 작성되었습니다.')
    } catch (error) {
      reportRequestError(error, '글을 저장하지 못했습니다.')
    }
  }

  async function removePost() {
    if (!canConnect || !selectedPost) return
    const boardId = communityBoardId(selectedPost.boardType)
    try {
      await deletePost(accessToken.trim(), selectedPost.id)
      setSelectedPost(null)
      setComments([])
      await loadPosts(boardId, 0)
      setPostBoardMode('list')
      pushCommunityRoute(boardId)
      appendLog('게시글 삭제 완료')
      showToast('success', '글이 삭제되었습니다.')
    } catch (error) {
      reportRequestError(error, '글을 삭제하지 못했습니다.')
    }
  }

  function beginEditPost(post: PostItem) {
    setSelectedCommunityBoard(communityBoardId(post.boardType))
    setSelectedPost(post)
    setEditingPostId(post.id)
    setPostForm({ title: post.title, content: post.content })
    setPostBoardMode('write')
  }

  function beginCreatePost() {
    setSelectedPost(null)
    setEditingPostId(null)
    setPostForm(emptyPostForm)
    setComments([])
    setCommentText('')
    setReplyDrafts({})
    setEditingCommentId(null)
    setCommentEditText('')
    setPostBoardMode('write')
    pushCommunityRoute(selectedCommunityBoard)
  }

  async function submitComment() {
    if (!canConnect || !selectedPostId || !commentText.trim()) return
    try {
      await createComment(accessToken.trim(), selectedPostId, { content: commentText.trim() })
      setCommentText('')
      await selectPost(selectedPostId)
      appendLog('댓글 작성 완료')
    } catch (error) {
      reportRequestError(error, '댓글을 작성하지 못했습니다.')
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
      reportRequestError(error, '답글을 작성하지 못했습니다.')
    }
  }

  function beginEditComment(comment: CommentItem) {
    setEditingCommentId(comment.id)
    setCommentEditText(comment.content)
  }

  function cancelEditComment() {
    setEditingCommentId(null)
    setCommentEditText('')
  }

  async function submitCommentEdit(commentId: number) {
    const content = commentEditText.trim()
    if (!canConnect || !selectedPostId || !content) return
    try {
      await updateComment(accessToken.trim(), commentId, { content })
      setEditingCommentId(null)
      setCommentEditText('')
      await selectPost(selectedPostId)
      appendLog('댓글 수정 완료')
      showToast('success', '댓글이 수정되었습니다.')
    } catch (error) {
      reportRequestError(error, '댓글을 수정하지 못했습니다.')
    }
  }

  async function removeComment(commentId: number) {
    if (!canConnect || !selectedPostId) return
    try {
      await deleteComment(accessToken.trim(), commentId)
      if (editingCommentId === commentId) {
        setEditingCommentId(null)
        setCommentEditText('')
      }
      setCommentDeleteTarget(null)
      await selectPost(selectedPostId)
      appendLog('댓글 삭제 완료')
      showToast('success', '댓글이 삭제되었습니다.')
    } catch (error) {
      reportRequestError(error, '댓글을 삭제하지 못했습니다.')
    }
  }

  async function loadChatMessages(roomIdValue: number) {
    if (!canConnect) return
    try {
      disconnectRealtime()
      setRoomId(String(roomIdValue))
      setShowChatMembers(false)
      const messages = await fetchChatMessages(accessToken.trim(), roomIdValue)
      setChatMessages(messages)
      try {
        const members = await fetchChatRoomMembers(accessToken.trim(), roomIdValue)
        setChatMembers(members)
      } catch {
        setChatMembers([])
      }
      const targetRoom = chatRooms.find((room) => room.id === roomIdValue)
      const targetStudy = targetRoom?.studyId == null
        ? null
        : knownStudies.find((study) => study.id === targetRoom.studyId) ?? null
      if (targetStudy && (isStudyEnded(targetStudy.status) || isStudyDeleted(targetStudy.status))) {
        appendLog(`채팅 메시지 ${messages.length}개 동기화`)
        return
      }
      connectRealtime(roomIdValue)
      appendLog(`채팅 메시지 ${messages.length}개 동기화`)
    } catch (error) {
      setChatMembers([])
      reportRequestError(error, '채팅방을 불러오지 못했습니다.')
    }
  }

  async function removeChatRoom(targetRoom: ChatRoom) {
    if (!canConnect) return
    try {
      await deleteChatRoom(accessToken.trim(), targetRoom.id)
      if (roomId === String(targetRoom.id)) {
        disconnectRealtime()
        setRoomId('')
        setChatMessages([])
        setChatMembers([])
        setShowChatMembers(false)
      }
      await loadChatRooms()
      appendLog('채팅방 삭제 완료')
      showToast('success', '채팅방이 삭제되었습니다.')
    } catch (error) {
      reportRequestError(error, '채팅방을 삭제하지 못했습니다.')
    }
  }

  function connectRealtime(targetRoomId = Number(roomId.trim())) {
    if (!canConnect) return
    if (!Number.isFinite(targetRoomId) || targetRoomId <= 0) return
    clientRef.current?.deactivate()
    setStatus('connecting')
    appendLog('채팅 실시간 연결 시도')

    const client = createRealtimeClient(accessToken.trim(), String(targetRoomId), {
      onConnect: () => {
        setStatus('connected')
        appendLog('채팅 실시간 연결 완료')
        void loadNotifications()
      },
      onDisconnect: () => {
        setStatus('idle')
        appendLog('채팅 실시간 연결 종료')
      },
      onError: (errorMessage) => {
        setStatus('error')
        appendLog(errorMessage)
        showToast('error', '채팅 연결에 문제가 있습니다.', errorMessage)
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

  function reportRequestError(error: unknown, fallback: string) {
    const message = errorMessage(error, fallback)
    appendLog(message)

    if (isSessionExpired(error)) {
      showToast('error', '로그인이 필요합니다.', '다시 로그인해 주세요.')
      clearAuthenticatedState()
      return
    }

    showToast('error', fallback, message)
  }

  function submitMessage() {
    if (!roomId) {
      showToast('info', '채팅방을 선택해 주세요.')
      return
    }
    if (isActiveRoomReadOnly) {
      showToast('info', '종료된 스터디 채팅방입니다.')
      return
    }
    sendChatMessage(clientRef.current, roomId, message)
    setMessage('')
  }

  function openAccountManagementModal() {
    setShowAccountManagementModal(true)
    setShowWithdrawalConfirm(false)
  }

  function closeAccountManagementModal() {
    setShowAccountManagementModal(false)
    setShowWithdrawalConfirm(false)
  }

  if (!canConnect) {
    return (
      <>
        <main className="login-page">
          <section className="login-card" aria-label="StudyWithMe 로그인">
            <div className="brand login-brand">
              <div className="brand-mark">S</div>
              <div>
                <strong>StudyWithMe</strong>
              </div>
            </div>
            <div className="login-actions">
              {oauthProviders.map((provider) => (
                <button
                  className="primary"
                  key={provider.id}
                  type="button"
                  onClick={() => startOAuth(provider.id)}
                  disabled={!sessionChecked}
                >
                  <LogIn size={17} />
                  {provider.label}로 로그인
                </button>
              ))}
            </div>
          </section>
        </main>
        {toast && renderToast()}
      </>
    )
  }

  if (needsSignup) {
    return (
      <>
        <main className="login-page">
          <section className="signup-card" aria-label="회원가입">
            <div className="brand login-brand">
              <img className="nickname-profile-image" src={profileImageSrc} alt="" />
              <div>
                <strong>회원가입</strong>
                <span>{profile?.email ?? 'StudyWithMe'}</span>
              </div>
            </div>
            <label>
              <span>별명</span>
              <input
                value={nicknameDraft}
                onChange={(event) => {
                  setNicknameDraft(event.target.value)
                  setNicknameError('')
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && termsAgreed && privacyPolicyAgreed) {
                    void submitSignup()
                  }
                }}
                placeholder="예: 스터디왕"
                autoFocus
              />
            </label>
            <div className="terms-checklist" aria-label="필수 약관">
              <label className="terms-check">
                <input
                  type="checkbox"
                  checked={termsAgreed}
                  onChange={(event) => {
                    setTermsAgreed(event.target.checked)
                    setNicknameError('')
                  }}
                />
                <span>서비스 이용약관 동의</span>
                <em>필수</em>
              </label>
              <label className="terms-check">
                <input
                  type="checkbox"
                  checked={privacyPolicyAgreed}
                  onChange={(event) => {
                    setPrivacyPolicyAgreed(event.target.checked)
                    setNicknameError('')
                  }}
                />
                <span>개인정보 처리방침 동의</span>
                <em>필수</em>
              </label>
            </div>
            {nicknameError && <p className="form-error">{nicknameError}</p>}
            <button
              className="primary wide"
              type="button"
              onClick={submitSignup}
              disabled={
                isNicknameSaving
                || !nicknameDraft.trim()
                || !termsAgreed
                || !privacyPolicyAgreed
              }
            >
              가입 완료
            </button>
          </section>
        </main>
        {toast && renderToast()}
      </>
    )
  }

  return (
    <div className={isSidebarCollapsed ? 'app-shell sidebar-collapsed' : 'app-shell'}>
      <aside className={isSidebarCollapsed ? 'sidebar collapsed' : 'sidebar'}>
        <div className="brand">
          <div className="brand-mark">S</div>
          <div>
            <strong>StudyWithMe</strong>
          </div>
          <button
            className="sidebar-toggle"
            type="button"
            onClick={() => setIsSidebarCollapsed((current) => !current)}
            aria-label={isSidebarCollapsed ? '사이드 메뉴 펼치기' : '사이드 메뉴 접기'}
            title={isSidebarCollapsed ? '펼치기' : '접기'}
          >
            {isSidebarCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
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

        {showDevTools && (
          <div className="sidebar-footer">
            <Settings2 size={18} />
            <span>Backend {API_BASE_URL}</span>
          </div>
        )}
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <span className="eyebrow">StudyWithMe</span>
            <h1>{pageTitle()}</h1>
          </div>
          <div className="topbar-actions">
            <div className="topbar-menu">
              <button
                className="notification-button"
                type="button"
                onClick={() => {
                  setShowNotificationMenu((current) => !current)
                  setShowProfileMenu(false)
                  void loadNotifications()
                }}
                aria-label={`알림 ${unreadNotifications}개`}
                aria-expanded={showNotificationMenu}
                title="알림"
              >
                <Bell size={18} />
                {unreadNotifications > 0 && (
                  <span className="notification-badge">{unreadNotifications}</span>
                )}
              </button>
              {showNotificationMenu && renderNotificationPopup()}
            </div>
            <div className="topbar-menu">
              <button
                className="profile-button"
                type="button"
                onClick={() => {
                  setShowProfileMenu((current) => !current)
                  setShowNotificationMenu(false)
                }}
                aria-label="프로필"
                aria-expanded={showProfileMenu}
                title="프로필"
              >
                <img src={profileImageSrc} alt="" />
              </button>
              {showProfileMenu && (
                <div className="profile-menu" role="menu">
                  <div className="profile-menu-header">
                    <img src={profileImageSrc} alt="" />
                    <div>
                      <div className="profile-name-row">
                        <strong>{profile?.nickname ?? '프로필 확인 중'}</strong>
                        {isAdmin && <span className="admin-role-badge">관리자</span>}
                      </div>
                      <span>{profile?.email ?? '계정 정보를 불러오는 중입니다.'}</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveView('mypage')
                      setShowProfileMenu(false)
                      void loadMyStudies()
                    }}
                  >
                    <User size={15} />
                    마이페이지
                  </button>
                  <button type="button" onClick={logout}>
                    <LogOut size={15} />
                    로그아웃
                  </button>
                </div>
              )}
            </div>
            <button
              className="dev-toggle-button"
              type="button"
              onClick={() => setShowDevTools((current) => !current)}
              aria-label="개발 도구"
              title="개발 도구"
            >
              <SlidersHorizontal size={16} />
            </button>
            {showDevTools && (
              <div className={`status-pill ${status}`}>
                <Circle size={10} fill="currentColor" />
                {statusText}
              </div>
            )}
          </div>
        </header>

        {showDevTools && (
          <section className="control-strip" aria-label="developer controls">
            <label>
              <span>Access token</span>
              <input
                value={accessToken}
                onChange={(event) => setAccessToken(event.target.value)}
                placeholder="로그인 또는 재발급으로 자동 입력됩니다"
                type="password"
              />
              <em className="dev-note">
                {tokenExpiresAt ? `만료 예정: ${formatTime(tokenExpiresAt)}` : 'access token 없음'}
              </em>
            </label>
            <div className="control-actions">
              <button type="button" onClick={refreshSession}>
                <KeyRound size={16} />
                재발급
              </button>
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
        )}

        {activeView === 'lobby' && renderLobby()}
        {activeView === 'studies' && renderStudies()}
        {activeView === 'posts' && renderPosts()}
        {activeView === 'chat' && renderChat()}
        {activeView === 'mypage' && renderMyPage()}
        {renderStudyDetailModal()}
        {showAccountManagementModal && renderAccountManagementModal()}
        {studyConfirmAction && renderStudyConfirmModal()}
        {commentDeleteTarget && renderCommentDeleteConfirmModal()}
      </main>
      {toast && renderToast()}
    </div>
  )

  function renderLobby() {
    const lobbySlides = [
      {
        id: 'study',
        label: '스터디 모집',
        title: '함께 공부할 사람을 찾고',
        view: 'studies' as WorkspaceView,
        icon: BookOpen,
      },
      {
        id: 'community',
        label: '커뮤니티',
        title: '경험과 질문을 나누고',
        view: 'posts' as WorkspaceView,
        icon: Newspaper,
      },
      {
        id: 'chat',
        label: '채팅',
        title: '참여자와 바로 이어집니다',
        view: 'chat' as WorkspaceView,
        icon: MessageSquareText,
      },
    ]
    const activeLobbySlide = lobbySlides[lobbySlideIndex]
    const ActiveLobbyIcon = activeLobbySlide.icon
    const moveLobbySlide = (direction: 1 | -1) => {
      setLobbySlideIndex((current) => (current + direction + lobbySlides.length) % lobbySlides.length)
    }

    return (
      <div className="lobby-page">
        <section className="lobby-showcase" aria-label="StudyWithMe 로비">
          <div className="lobby-showcase-copy">
            <span className="eyebrow">StudyWithMe</span>
            <h2>스터디가 모이고 대화가 이어지는 공간</h2>
            <div className="lobby-showcase-actions">
              <button
                className="primary"
                type="button"
                onClick={() => setActiveView(activeLobbySlide.view)}
              >
                <ActiveLobbyIcon size={17} />
                {activeLobbySlide.label}
              </button>
              <button type="button" onClick={() => moveLobbySlide(1)}>
                다음 보기
              </button>
            </div>
          </div>

          <div className="lobby-carousel" aria-live="polite">
            <div
              className="lobby-carousel-track"
              style={{ transform: `translateX(-${lobbySlideIndex * 100}%)` }}
            >
              <article className="lobby-slide study-slide" aria-label="스터디 모집 화면">
                <div className="lobby-slide-top">
                  <span>Study</span>
                  <strong>스터디 모집</strong>
                </div>
                <div className="feature-board">
                  <div className="feature-card wide">
                    <strong>React 집중 스터디</strong>
                    <span>온라인 · 6명 · 주 2회</span>
                    <div className="feature-progress"><span /></div>
                  </div>
                  <div className="feature-card">
                    <strong>SQL 문제풀이</strong>
                    <span>모집 중</span>
                  </div>
                  <div className="feature-card">
                    <strong>CS 면접 준비</strong>
                    <span>승인 대기</span>
                  </div>
                </div>
              </article>

              <article className="lobby-slide community-slide" aria-label="커뮤니티 화면">
                <div className="lobby-slide-top">
                  <span>Community</span>
                  <strong>커뮤니티</strong>
                </div>
                <div className="feature-feed">
                  <div>
                    <strong>스터디 회고 공유</strong>
                    <span>후기게시판 · 방금 전</span>
                  </div>
                  <div>
                    <strong>집중이 안 될 때 루틴</strong>
                    <span>자유게시판 · 댓글 8</span>
                  </div>
                  <div>
                    <strong>면접 질문 정리 방식</strong>
                    <span>질문게시판 · 답변 3</span>
                  </div>
                </div>
              </article>

              <article className="lobby-slide chat-slide" aria-label="채팅 화면">
                <div className="lobby-slide-top">
                  <span>Chat</span>
                  <strong>채팅</strong>
                </div>
                <div className="feature-chat">
                  <div className="feature-bubble">오늘 범위 어디까지 할까요?</div>
                  <div className="feature-bubble self">저는 3장까지 가능합니다.</div>
                  <div className="feature-bubble">그럼 10시에 맞춰서 시작해요.</div>
                </div>
              </article>
            </div>
            <button
              className="lobby-carousel-arrow previous"
              type="button"
              onClick={() => moveLobbySlide(-1)}
              aria-label="이전 로비 화면"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              className="lobby-carousel-arrow next"
              type="button"
              onClick={() => moveLobbySlide(1)}
              aria-label="다음 로비 화면"
            >
              <ChevronRight size={18} />
            </button>
            <div className="lobby-carousel-dots" aria-label="로비 화면 선택">
              {lobbySlides.map((slide, index) => (
                <button
                  className={index === lobbySlideIndex ? 'active' : ''}
                  key={slide.id}
                  type="button"
                  onClick={() => setLobbySlideIndex(index)}
                  aria-label={`${slide.label} 보기`}
                  aria-pressed={index === lobbySlideIndex}
                />
              ))}
            </div>
          </div>
        </section>
        {showDevTools && renderActivityPanel()}
      </div>
    )
  }

  function renderStudies() {
    return (
      <section className="main-column study-page">
        {studyBoardMode === 'list' && (
          <div className="section-heading">
            <div>
              <span className="eyebrow">Study</span>
              <h2>스터디</h2>
            </div>
            <div className="row-actions">
              <button
                className="primary"
                type="button"
                onClick={openCreateStudyEditor}
              >
                <Plus size={16} />
                스터디 만들기
              </button>
            </div>
          </div>
        )}

        {studyBoardMode === 'list' && (
          <>
            <div className="study-scope-tabs" aria-label="스터디 목록">
              {studyListScopes.map((scope) => (
                <button
                  className={studyListScope === scope.id ? 'active' : ''}
                  key={scope.id}
                  type="button"
                  onClick={() => setStudyListScope(scope.id)}
                >
                  {scope.label}
                  <span>{studyScopeCount(scope.id)}</span>
                </button>
              ))}
            </div>

            <div className="study-card-grid">
              {visibleStudyItems.length === 0 ? (
                <EmptyState icon={BookOpen} text={studyScopeEmptyText(studyListScope)} />
              ) : (
                visibleStudyItems.map((study) => renderStudyCard(study))
              )}
            </div>
          </>
        )}

        {studyBoardMode === 'write' && (
          <article className="study-editor">
            <div className="section-heading compact">
              <div>
                <span className="eyebrow">{editingStudyId == null ? 'Create' : 'Edit'}</span>
                <h2>{editingStudyId == null ? '스터디 만들기' : '스터디 수정'}</h2>
              </div>
            </div>
            <div className="form-stack">
              <label>
                <span>제목</span>
                <input
                  aria-invalid={Boolean(studyFormErrors.title)}
                  aria-describedby={studyFormErrors.title ? 'study-title-error' : undefined}
                  maxLength={studyFormFieldMaxLengths.title}
                  value={studyForm.title}
                  onChange={(event) =>
                    updateStudyFormField('title', event.target.value)
                  }
                  placeholder="예: 매일 알고리즘 1문제"
                />
                {studyFormErrors.title && (
                  <p id="study-title-error" className="form-error">{studyFormErrors.title}</p>
                )}
              </label>
              <label>
                <span>진행 방식</span>
                <textarea
                  aria-invalid={Boolean(studyFormErrors.progressMethod)}
                  aria-describedby={
                    studyFormErrors.progressMethod ? 'study-progress-method-error' : undefined
                  }
                  maxLength={studyFormFieldMaxLengths.progressMethod}
                  value={studyForm.progressMethod}
                  onChange={(event) =>
                    updateStudyFormField('progressMethod', event.target.value)
                  }
                  placeholder="예: 매주 화/목 21시에 온라인으로 진행"
                />
                {studyFormErrors.progressMethod && (
                  <p id="study-progress-method-error" className="form-error">
                    {studyFormErrors.progressMethod}
                  </p>
                )}
              </label>
              <label>
                <span>모집 대상</span>
                <textarea
                  aria-invalid={Boolean(studyFormErrors.targetAudience)}
                  aria-describedby={
                    studyFormErrors.targetAudience ? 'study-target-audience-error' : undefined
                  }
                  maxLength={studyFormFieldMaxLengths.targetAudience}
                  value={studyForm.targetAudience}
                  onChange={(event) =>
                    updateStudyFormField('targetAudience', event.target.value)
                  }
                  placeholder="예: Java 기초를 끝내고 알고리즘을 시작하려는 사람"
                />
                {studyFormErrors.targetAudience && (
                  <p id="study-target-audience-error" className="form-error">
                    {studyFormErrors.targetAudience}
                  </p>
                )}
              </label>
              <div className="study-editor-grid">
                <label>
                  <span>정원</span>
                  <input
                    aria-invalid={Boolean(studyFormErrors.capacity)}
                    aria-describedby={studyFormErrors.capacity ? 'study-capacity-error' : undefined}
                    inputMode="numeric"
                    min={1}
                    step={1}
                    type="number"
                    value={studyForm.capacity}
                    onChange={(event) =>
                      updateStudyFormField('capacity', event.target.value)
                    }
                    placeholder="예: 6"
                  />
                  {studyFormErrors.capacity && (
                    <p id="study-capacity-error" className="form-error">
                      {studyFormErrors.capacity}
                    </p>
                  )}
                </label>
                <label>
                  <span>일정</span>
                  <input
                    aria-invalid={Boolean(studyFormErrors.schedule)}
                    aria-describedby={studyFormErrors.schedule ? 'study-schedule-error' : undefined}
                    maxLength={studyFormFieldMaxLengths.schedule}
                    value={studyForm.schedule}
                    onChange={(event) =>
                      updateStudyFormField('schedule', event.target.value)
                    }
                    placeholder="예: 매주 화요일 21:00"
                  />
                  {studyFormErrors.schedule && (
                    <p id="study-schedule-error" className="form-error">
                      {studyFormErrors.schedule}
                    </p>
                  )}
                </label>
              </div>
              <label>
                <span>규칙</span>
                <textarea
                  aria-invalid={Boolean(studyFormErrors.rules)}
                  aria-describedby={studyFormErrors.rules ? 'study-rules-error' : undefined}
                  maxLength={studyFormFieldMaxLengths.rules}
                  value={studyForm.rules}
                  onChange={(event) =>
                    updateStudyFormField('rules', event.target.value)
                  }
                  placeholder="예: 불참 시 전날 공유, 풀이 인증 필수"
                />
                {studyFormErrors.rules && (
                  <p id="study-rules-error" className="form-error">{studyFormErrors.rules}</p>
                )}
              </label>
              <div className="row-actions editor-actions">
                <button
                  type="button"
                  onClick={() => {
                    resetStudyEditor()
                    setStudyBoardMode('list')
                  }}
                >
                  취소
                </button>
                <button
                  className="primary"
                  type="button"
                  onClick={submitStudy}
                  disabled={!canConnect}
                >
                  <Plus size={16} />
                  {editingStudyId == null ? '생성' : '저장'}
                </button>
              </div>
            </div>
          </article>
        )}

        {showDevTools && renderActivityPanel()}
      </section>
    )
  }

  function studyScopeCount(scope: StudyListScope) {
    if (scope === 'active') return myStudyHistory.activeStudies.length
    return recruitingStudies.length
  }

  function studyScopeEmptyText(scope: StudyListScope) {
    if (scope === 'active') return '참여 중인 스터디가 없습니다.'
    return '아직 모집 중인 스터디가 없습니다.'
  }

  function renderStudyCard(study: StudyItem) {
    const detail = studyDetail(study)
    const isRecruiting = isStudyRecruiting(study.status)
    const isJoined = isStudyJoined(study.id)
    const isRequested = isStudyJoinRequested(study)
    const isEnded = isStudyEnded(study.status)

    return (
      <article className="study-card" key={study.id}>
        <button
          className="study-card-main"
          type="button"
          onClick={() => selectStudy(study.id)}
        >
          <div className="study-card-icon">
            {study.title.trim().slice(0, 1).toUpperCase() || 'S'}
          </div>
          <div>
            <div className="study-title-row">
              <strong>{study.title}</strong>
              <span className={`study-status-label ${studyStatusClassName(study.status)}`}>
                {studyStatusLabel(study.status)}
              </span>
            </div>
            <span className="study-owner-label">{studyOwnerLabel(study)}</span>
          </div>
        </button>
        <dl className="study-summary">
          <div>
            <dt>진행</dt>
            <dd>{detail.progressMethod}</dd>
          </div>
          <div>
            <dt>정원</dt>
            <dd>{detail.capacity}</dd>
          </div>
        </dl>
        <div className="study-card-actions">
          {!isJoined && isRecruiting && !isRequested && (
            <button
              className="primary"
              type="button"
              onClick={() => mutateStudy(study.id, 'join')}
              disabled={!canConnect}
            >
              <CheckCircle2 size={16} />
              참여 신청
            </button>
          )}
          {!isJoined && isRecruiting && isRequested && (
            <>
              <button type="button" disabled>
                신청됨
              </button>
              <button
                type="button"
                onClick={() => cancelJoinRequest(study.id)}
                disabled={!canConnect}
              >
                신청 취소
              </button>
            </>
          )}
          {!isJoined && !study.ownedByRequester && !isEnded && (
            <button
              type="button"
              onClick={() => openPrivateChatRoom(study.ownerMemberId)}
              disabled={!canConnect}
            >
              <MessageSquareText size={16} />
              스터디장 채팅
            </button>
          )}
          {isJoined && !isEnded && (
            <button
              className="primary"
              type="button"
              onClick={() => openStudyChatRoom(study.id)}
              disabled={!canConnect}
            >
              <MessageSquareText size={16} />
              채팅
            </button>
          )}
          {study.ownedByRequester && !isEnded && (
            <>
              <button type="button" onClick={() => openEditStudyEditor(study)}>
                수정
              </button>
              {isRecruiting && (
                <button
                  type="button"
                  onClick={() => mutateStudy(study.id, 'close')}
                  disabled={!canConnect}
                >
                  마감하기
                </button>
              )}
              <button
                type="button"
                onClick={() => mutateStudy(study.id, 'end')}
                disabled={!canConnect}
              >
                종료
              </button>
            </>
          )}
          {study.ownedByRequester && isEnded && !isStudyDeleted(study.status) && (
            <button
              className="danger-text-button"
              type="button"
              onClick={() => requestStudyMutation(study.id, 'delete')}
              disabled={!canConnect}
            >
              삭제
            </button>
          )}
          {isJoined && !study.ownedByRequester && !isEnded && (
            <button
              type="button"
              onClick={() => mutateStudy(study.id, 'leave')}
              disabled={!canConnect}
            >
              탈퇴
            </button>
          )}
          <button type="button" onClick={() => toggleStudyDetail(study.id)}>
            상세
          </button>
        </div>
      </article>
    )
  }

  function renderStudyDetailModal() {
    if (!selectedStudy || studyBoardMode !== 'list') return null

    const isJoined = isStudyJoined(selectedStudy.id)
    const isRecruiting = isStudyRecruiting(selectedStudy.status)
    const isRequested = isStudyJoinRequested(selectedStudy)
    const isEnded = isStudyEnded(selectedStudy.status)

    return (
      <div
        className="modal-backdrop"
        role="presentation"
        onMouseDown={() => setSelectedStudy(null)}
      >
        <section
          className="account-modal study-detail-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="study-detail-title"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="account-modal-header">
            <div>
              <span className="eyebrow">{studyStatusLabel(selectedStudy.status)}</span>
              <h2 id="study-detail-title">{selectedStudy.title}</h2>
            </div>
            <button
              className="icon-button"
              type="button"
              onClick={() => setSelectedStudy(null)}
              aria-label="스터디 상세 닫기"
              title="닫기"
            >
              <X size={16} />
            </button>
          </div>
          <div className="study-detail-modal-body">
            <dl className="study-detail-list">
              {renderStudyDetail('진행 방식', studyDetail(selectedStudy).progressMethod)}
              {renderStudyDetail('모집 대상', studyDetail(selectedStudy).targetAudience)}
              {renderStudyDetail('정원', studyDetail(selectedStudy).capacity)}
              {renderStudyDetail('일정', studyDetail(selectedStudy).schedule)}
              {renderStudyDetail('규칙', studyDetail(selectedStudy).rules)}
            </dl>
            <span className="row-meta">
              {studyOwnerLabel(selectedStudy)} · {formatTime(selectedStudy.createdAt)}
            </span>
            <div className="row-actions detail-actions">
              {!isJoined && isRecruiting && !isRequested && (
                <button
                  className="primary"
                  type="button"
                  onClick={() => mutateStudy(selectedStudy.id, 'join')}
                  disabled={!canConnect}
                >
                  <CheckCircle2 size={16} />
                  참여 신청
                </button>
              )}
              {!isJoined && isRecruiting && isRequested && (
                <>
                  <button type="button" disabled>
                    신청됨
                  </button>
                  <button
                    type="button"
                    onClick={() => cancelJoinRequest(selectedStudy.id)}
                    disabled={!canConnect}
                  >
                    신청 취소
                  </button>
                </>
              )}
              {!isJoined && !selectedStudy.ownedByRequester && !isEnded && (
                <button
                  type="button"
                  onClick={() => openPrivateChatRoom(selectedStudy.ownerMemberId)}
                  disabled={!canConnect}
                >
                  <MessageSquareText size={16} />
                  스터디장 채팅
                </button>
              )}
            </div>
            {(isJoined || selectedStudy.ownedByRequester) && (
              <div className="row-actions detail-actions">
                {isJoined && !isEnded && (
                  <button
                    className="primary"
                    type="button"
                    onClick={() => openStudyChatRoom(selectedStudy.id)}
                    disabled={!canConnect}
                  >
                    <MessageSquareText size={16} />
                    채팅방
                  </button>
                )}
                {selectedStudy.ownedByRequester && !isEnded && (
                  <>
                    <button type="button" onClick={() => openEditStudyEditor(selectedStudy)}>
                      수정
                    </button>
                    {isRecruiting && (
                      <button
                        type="button"
                        onClick={() => mutateStudy(selectedStudy.id, 'close')}
                        disabled={!canConnect}
                      >
                        마감하기
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => mutateStudy(selectedStudy.id, 'end')}
                      disabled={!canConnect}
                    >
                      종료
                    </button>
                  </>
                )}
                {selectedStudy.ownedByRequester && isEnded && !isStudyDeleted(selectedStudy.status) && (
                  <button
                    className="danger-text-button"
                    type="button"
                    onClick={() => requestStudyMutation(selectedStudy.id, 'delete')}
                    disabled={!canConnect}
                  >
                    삭제
                  </button>
                )}
                {isJoined && !selectedStudy.ownedByRequester && !isEnded && (
                  <button
                    type="button"
                    onClick={() => mutateStudy(selectedStudy.id, 'leave')}
                    disabled={!canConnect}
                  >
                    탈퇴
                  </button>
                )}
              </div>
            )}
            {selectedStudy.ownedByRequester && !isEnded && !isStudyDeleted(selectedStudy.status) && (
              <section className="join-request-panel" aria-label="참여 신청">
                <div className="section-heading compact">
                  <h3>참여 신청</h3>
                  <strong className="history-count">{studyJoinRequests.length}</strong>
                </div>
                {studyJoinRequests.length === 0 ? (
                  <p className="muted">대기 중인 신청이 없습니다.</p>
                ) : (
                  <div className="history-list">
                    {studyJoinRequests.map((request) => (
                      <article className="history-row" key={request.memberId}>
                        <button
                          className="history-row-main"
                          type="button"
                          onClick={() => openPrivateChatRoom(request.memberId)}
                        >
                          <div>
                            <strong>{request.nickname ?? `멤버 ${request.memberId}`}</strong>
                            <span>{formatTime(request.requestedAt)}</span>
                          </div>
                        </button>
                        <div className="history-row-actions">
                          <button type="button" onClick={() => openPrivateChatRoom(request.memberId)}>
                            1:1 채팅
                          </button>
                          <button
                            type="button"
                            onClick={() => rejectJoinRequest(selectedStudy.id, request.memberId)}
                          >
                            거절
                          </button>
                          <button
                            className="primary"
                            type="button"
                            onClick={() => approveJoinRequest(selectedStudy.id, request.memberId)}
                          >
                            승인
                          </button>
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>
        </section>
      </div>
    )
  }

  function renderMyPage() {
    return (
      <section className="main-column my-page">
        <div className="section-heading">
          <div>
            <span className="eyebrow">My page</span>
            <h2>마이페이지</h2>
          </div>
        </div>

        <section className="profile-summary-card" aria-label="내 정보">
          <img src={profileImageSrc} alt="" />
          <div className="profile-summary-main">
            <strong>{profile?.nickname ?? '내 프로필'}</strong>
            <span>{profile?.email ?? '계정 정보를 확인할 수 없습니다.'}</span>
          </div>
          <button
            className="icon-text-button profile-manage-button"
            type="button"
            onClick={openAccountManagementModal}
          >
            <Settings2 size={18} />
            계정 관리
          </button>
        </section>

        <div className="study-history-grid">
          <section className="history-section" aria-label="참여 중인 스터디">
            <div className="section-heading compact">
              <div>
                <span className="eyebrow">Active</span>
                <h2>참여 중인 스터디</h2>
              </div>
              <strong className="history-count">{myStudyHistory.activeStudies.length}</strong>
            </div>
            {renderStudyHistoryList(myStudyHistory.activeStudies, '참여 중인 스터디가 없습니다.', 'active')}
          </section>

          <section className="history-section" aria-label="지난 스터디">
            <div className="section-heading compact">
              <div>
                <span className="eyebrow">History</span>
                <h2>지난 스터디</h2>
              </div>
              <div className="history-heading-actions">
                {myStudyHistory.pastStudies.length > 0 && (
                  <button
                    className="history-clear-button"
                    type="button"
                    onClick={requestHideAllStudyHistory}
                  >
                    전체 삭제
                  </button>
                )}
              </div>
            </div>
            {renderStudyHistoryList(myStudyHistory.pastStudies, '지난 참여 이력이 없습니다.', 'past')}
          </section>
        </div>

        {showDevTools && renderActivityPanel()}
      </section>
    )
  }

  function renderAccountManagementModal() {
    return (
      <div
        className="modal-backdrop"
        role="presentation"
        onMouseDown={closeAccountManagementModal}
      >
        <section
          className="account-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="account-management-title"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="account-modal-header">
            <div>
              <span className="eyebrow">Account</span>
              <h2 id="account-management-title">계정 관리</h2>
            </div>
            <button
              className="icon-button"
              type="button"
              aria-label="계정 관리 닫기"
              onClick={closeAccountManagementModal}
            >
              <X size={18} />
            </button>
          </div>
          <div className="account-management-section" aria-label="계정 설정">
            <div className="account-setting-list">
              <div className="account-setting-row">
                <div className="account-setting-main">
                  <strong>이메일</strong>
                  <span>{profile?.email ?? '계정 정보를 확인할 수 없습니다.'}</span>
                </div>
              </div>
              <div className="account-setting-row">
                <div className="account-setting-main">
                  <strong>별명</strong>
                  <span>{profile?.nickname ?? '별명을 설정해 주세요.'}</span>
                </div>
                <div className="nickname-edit-form">
                  <input
                    value={nicknameDraft}
                    onChange={(event) => {
                      setNicknameDraft(event.target.value)
                      setNicknameError('')
                    }}
                    placeholder="별명"
                    aria-label="별명"
                  />
                  <button
                    type="button"
                    onClick={submitNickname}
                    disabled={isNicknameSaving || !nicknameDraft.trim()}
                  >
                    저장
                  </button>
                </div>
              </div>
              {nicknameError && <p className="form-error inline">{nicknameError}</p>}
              <div className="account-setting-row danger-zone">
                <div className="account-setting-main">
                  <strong>회원 탈퇴</strong>
                </div>
                <button
                  className="danger-text-button"
                  type="button"
                  onClick={() => setShowWithdrawalConfirm(true)}
                  disabled={isNicknameSaving}
                >
                  <Trash2 size={15} />
                  회원 탈퇴
                </button>
              </div>
              {showWithdrawalConfirm && (
                <div className="withdrawal-confirm-panel" role="alert">
                  <strong>회원 탈퇴를 진행할까요?</strong>
                  <span>탈퇴하면 현재 계정 정보가 삭제됩니다.</span>
                  <div className="withdrawal-confirm-actions">
                    <button
                      type="button"
                      onClick={() => setShowWithdrawalConfirm(false)}
                      disabled={isNicknameSaving}
                    >
                      취소
                    </button>
                    <button
                      className="danger-text-button"
                      type="button"
                      onClick={withdrawCurrentAccount}
                      disabled={isNicknameSaving}
                    >
                      탈퇴하기
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    )
  }

  function renderCommentDeleteConfirmModal() {
    if (!commentDeleteTarget) return null

    return (
      <div
        className="modal-backdrop"
        role="presentation"
        onMouseDown={() => setCommentDeleteTarget(null)}
      >
        <section
          className="account-modal confirm-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="comment-delete-title"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="account-modal-header">
            <div>
              <span className="eyebrow">Comment</span>
              <h2 id="comment-delete-title">댓글 삭제</h2>
            </div>
            <button
              className="icon-button"
              type="button"
              aria-label="댓글 삭제 창 닫기"
              onClick={() => setCommentDeleteTarget(null)}
            >
              <X size={18} />
            </button>
          </div>
          <div className="confirm-modal-body">
            <p>이 댓글을 삭제할까요?</p>
            <blockquote>{commentDeleteTarget.content}</blockquote>
            <div className="withdrawal-confirm-actions">
              <button type="button" onClick={() => setCommentDeleteTarget(null)}>
                취소
              </button>
              <button
                className="danger-text-button"
                type="button"
                onClick={() => removeComment(commentDeleteTarget.id)}
              >
                삭제
              </button>
            </div>
          </div>
        </section>
      </div>
    )
  }

  function renderStudyConfirmModal() {
    if (!studyConfirmAction) return null

    return (
      <div
        className="modal-backdrop"
        role="presentation"
        onMouseDown={() => setStudyConfirmAction(null)}
      >
        <section
          className="account-modal confirm-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="study-confirm-title"
          onMouseDown={(event) => event.stopPropagation()}
        >
          <div className="account-modal-header">
            <div>
              <span className="eyebrow">Study</span>
              <h2 id="study-confirm-title">{studyConfirmAction.title}</h2>
            </div>
            <button
              className="icon-button"
              type="button"
              aria-label="확인 창 닫기"
              onClick={() => setStudyConfirmAction(null)}
            >
              <X size={18} />
            </button>
          </div>
          <div className="confirm-modal-body">
            <p>{studyConfirmAction.message}</p>
            <div className="withdrawal-confirm-actions">
              <button type="button" onClick={() => setStudyConfirmAction(null)}>
                취소
              </button>
              <button
                className="danger-text-button"
                type="button"
                onClick={confirmStudyAction}
              >
                {studyConfirmAction.confirmLabel}
              </button>
            </div>
          </div>
        </section>
      </div>
    )
  }

  function renderStudyHistoryList(
    items: StudyItem[],
    emptyText: string,
    variant: 'active' | 'past',
  ) {
    if (items.length === 0) {
      return <EmptyState icon={BookOpen} text={emptyText} />
    }

    return (
      <div className="history-list">
        {items.map((study) => {
          const detail = studyDetail(study)
    const isRecruiting = isStudyRecruiting(study.status)
    const isJoined = study.joinedByRequester === true
    const isHistorical = variant === 'past'

          return (
            <article className="history-row" key={`${variant}-${study.id}`}>
              <button
                className="history-row-main"
                type="button"
                onClick={() => openStudyHistoryDetail(study)}
              >
                <div>
                  <div className="study-title-row">
                    <strong>{study.title}</strong>
                    <span className={`study-status-label ${studyStatusClassName(study.status)}`}>
                      {studyStatusLabel(study.status)}
                    </span>
                  </div>
                  <span>{studyOwnerLabel(study)} · {detail.progressMethod}</span>
                </div>
              </button>
              <div className="history-row-actions">
                {isJoined && !isHistorical && (
                  <button
                    className="primary"
                    type="button"
                    onClick={() => openStudyChatRoom(study.id)}
                    disabled={!canConnect}
                  >
                    <MessageSquareText size={15} />
                    채팅
                  </button>
                )}
                {study.ownedByRequester && isRecruiting && !isHistorical && (
                  <button type="button" onClick={() => mutateStudy(study.id, 'close')}>
                    마감하기
                  </button>
                )}
                {study.ownedByRequester && !isHistorical && !isStudyEnded(study.status) && (
                  <button type="button" onClick={() => mutateStudy(study.id, 'end')}>
                    종료
                  </button>
                )}
                {isHistorical && (
                  <button
                    className="history-remove-button"
                    type="button"
                    onClick={() => requestStudyMutation(study.id, 'hideHistory')}
                    aria-label={`${study.title} 지난 스터디 목록에서 삭제`}
                    title="목록에서 삭제"
                  >
                    <X size={15} />
                  </button>
                )}
                {isJoined && !study.ownedByRequester && !isHistorical && !isStudyEnded(study.status) && (
                  <button type="button" onClick={() => mutateStudy(study.id, 'leave')}>
                    탈퇴
                  </button>
                )}
              </div>
            </article>
          )
        })}
      </div>
    )
  }

  function renderPosts() {
    const selectedBoard = communityBoards.find((board) => board.id === selectedCommunityBoard)
    const selectedBoardLabel = selectedBoard?.label ?? '자유게시판'
    const canWriteSelectedBoard = selectedBoard?.boardType !== 'NOTICE' || isAdmin
    const canManageSelectedPost =
      selectedPost != null &&
      (selectedPost.ownedByRequester === true || (selectedPost.boardType === 'NOTICE' && isAdmin))
    const isWritingPost = postBoardMode === 'write'
    const isViewingPost = postBoardMode === 'detail'

    return (
      <section className="main-column board-page">
        <div className="community-topline">
          <div>
            <h2>커뮤니티</h2>
            <span>{selectedBoardLabel}</span>
          </div>
          {canWriteSelectedBoard && (
            <button className="primary" type="button" onClick={beginCreatePost}>
              <Plus size={16} />
              글쓰기
            </button>
          )}
        </div>

        <div className="community-board-tabs" aria-label="하위 게시판">
          {communityBoards.map((board) => (
            <button
              className={selectedCommunityBoard === board.id ? 'active' : ''}
              key={board.id}
              type="button"
              onClick={() => {
                setSelectedCommunityBoard(board.id)
                setPostBoardMode('list')
                setEditingPostId(null)
                setSelectedPost(null)
                setPostSearchKeyword('')
                pushCommunityRoute(board.id)
                void loadPosts(board.id, 0)
              }}
            >
              {board.label}
            </button>
          ))}
        </div>

        {postBoardMode === 'list' && (
          <div className="community-list-surface">
            <div className="board-toolbar">
              <label className="board-search">
                <Search size={16} />
                <input
                  value={postSearchKeyword}
                  onChange={(event) => setPostSearchKeyword(event.target.value)}
                  placeholder="검색"
                />
              </label>
              <span>{postPage + 1}페이지 · {filteredPosts.length}개</span>
            </div>

            <div className="board-list" aria-label="게시글 목록">
              <div className="board-list-head" aria-hidden="true">
                <span>제목</span>
                <span>작성자</span>
                <span>시간</span>
              </div>
              {filteredPosts.length === 0 ? (
                <EmptyState icon={Newspaper} text={posts.length === 0 ? '글이 없습니다.' : '검색 결과가 없습니다.'} />
              ) : (
                filteredPosts.map((post) => (
                  <button
                    className="board-row"
                    key={post.id}
                    type="button"
                    onClick={() => {
                      setEditingPostId(null)
                      setPostForm(emptyPostForm)
                      void selectPost(post.id)
                    }}
                  >
                    <span className="board-title-cell">
                      <strong>{post.title}</strong>
                      <small>{post.content}</small>
                    </span>
                    <span className="board-author">
                      <img src={authorAvatarSrc(post)} alt="" />
                      <span>{authorDisplayName(post)}</span>
                    </span>
                    <time>{formatTime(post.createdAt)}</time>
                  </button>
                ))
              )}
            </div>
            <div className="board-pagination" aria-label="게시글 페이지 이동">
              <button
                type="button"
                onClick={() => loadPosts(selectedCommunityBoard, Math.max(postPage - 1, 0))}
                disabled={postPage === 0}
              >
                이전
              </button>
              <span>{postPage + 1}</span>
              <button
                type="button"
                onClick={() => loadPosts(selectedCommunityBoard, postPage + 1)}
                disabled={!hasNextPostPage}
              >
                다음
              </button>
            </div>
          </div>
        )}

        {isWritingPost && (
          <article className="board-editor" aria-label={editingPostId ? '글 수정' : '글 작성'}>
            <div className="board-subpage-header editor-header">
              <div>
                <h2>{editingPostId ? '글 수정' : '글 작성'}</h2>
              </div>
            </div>
            <div className="form-stack">
              <label>
                <span>제목</span>
                <input
                  value={postForm.title}
                  onChange={(event) =>
                    setPostForm((current) => ({ ...current, title: event.target.value }))
                  }
                  placeholder="제목"
                />
              </label>
              <label>
                <textarea
                  className="post-editor-textarea"
                  value={postForm.content}
                  onChange={(event) =>
                    setPostForm((current) => ({ ...current, content: event.target.value }))
                  }
                  placeholder="내용을 입력하세요."
                />
              </label>
              <div className="row-actions editor-actions">
                <button
                  type="button"
                  onClick={() => {
                    setPostBoardMode(editingPostId && selectedPost ? 'detail' : 'list')
                    setEditingPostId(null)
                    setPostForm(emptyPostForm)
                    if (!editingPostId) pushCommunityRoute(selectedCommunityBoard)
                  }}
                >
                  취소
                </button>
                <button
                  className="primary"
                  type="button"
                  onClick={submitPost}
                  disabled={!postForm.title.trim() || !postForm.content.trim()}
                >
                  <Send size={16} />
                  저장
                </button>
              </div>
            </div>
          </article>
        )}

        {isViewingPost && (
          <article className="board-detail" aria-label="게시글 상세">
            {selectedPost ? (
              <>
                <div className="board-subpage-header">
                  <button
                    className="icon-text-button"
                    type="button"
                    onClick={() => {
                      setPostBoardMode('list')
                      setEditingPostId(null)
                      pushCommunityRoute(selectedCommunityBoard)
                    }}
                  >
                    <ArrowLeft size={16} />
                    목록
                  </button>
                </div>
                <header className="board-detail-header">
                  <h2>{selectedPost.title}</h2>
                  <div className="post-author-line board-detail-meta">
                    <img src={authorAvatarSrc(selectedPost)} alt="" />
                    <span>{authorDisplayName(selectedPost)}</span>
                    <time>{formatTime(selectedPost.createdAt)}</time>
                  </div>
                </header>
                <p className="post-body">{selectedPost.content}</p>
                {canManageSelectedPost && (
                  <div className="post-actions">
                    <button type="button" onClick={() => beginEditPost(selectedPost)}>
                      <PencilLine size={16} />
                      수정
                    </button>
                    <button type="button" onClick={removePost}>
                      <Trash2 size={16} />
                      삭제
                    </button>
                  </div>
                )}
                <section className="comments-section" aria-label="댓글">
                  <div className="section-heading compact">
                    <div>
                      <h2>댓글 {comments.length}</h2>
                    </div>
                  </div>
                  <div className="comment-composer">
                    <textarea
                      value={commentText}
                      onChange={(event) => setCommentText(event.target.value)}
                      placeholder="댓글을 입력하세요."
                    />
                    <button
                      className="primary"
                      type="button"
                      onClick={submitComment}
                      disabled={!commentText.trim()}
                    >
                      댓글 작성
                    </button>
                  </div>
                  <div className="comment-list">
                    {topLevelComments.length === 0 ? (
                      <p className="muted">첫 댓글을 남겨보세요.</p>
                    ) : (
                      topLevelComments.map((comment) => renderComment(comment))
                    )}
                  </div>
                </section>
              </>
            ) : (
              <EmptyState icon={Newspaper} text="목록에서 글을 선택하세요." />
            )}
          </article>
        )}
      </section>
    )
  }

  function renderComment(comment: CommentItem) {
    const replies = comments.filter((item) => item.parentCommentId === comment.id)
    return (
      <article className="comment-row" key={comment.id}>
        <div className="comment-header">
          <div className="comment-author">
            <img src={authorAvatarSrc(comment)} alt="" />
            <div>
              <strong>{authorDisplayName(comment)}</strong>
            </div>
          </div>
          <div className="comment-meta-actions">
            <time>{formatDateTime(comment.createdAt)}</time>
            {comment.ownedByRequester === true && (
              <div className="comment-action-row">
                <button type="button" onClick={() => beginEditComment(comment)}>
                  수정
                </button>
                <button type="button" onClick={() => setCommentDeleteTarget(comment)}>
                  삭제
                </button>
              </div>
            )}
          </div>
        </div>
        {renderCommentBody(comment)}
        <div className="reply-stack">
          {replies.map((reply) => (
            <div className="reply-row" key={reply.id}>
              <div className="comment-header">
                <div className="comment-author compact">
                  <img src={authorAvatarSrc(reply)} alt="" />
                  <div>
                    <strong>{authorDisplayName(reply)}</strong>
                  </div>
                </div>
                <div className="comment-meta-actions">
                  <time>{formatDateTime(reply.createdAt)}</time>
                  {reply.ownedByRequester === true && (
                    <div className="comment-action-row">
                      <button type="button" onClick={() => beginEditComment(reply)}>
                        수정
                      </button>
                      <button type="button" onClick={() => setCommentDeleteTarget(reply)}>
                        삭제
                      </button>
                    </div>
                  )}
                </div>
              </div>
              {renderCommentBody(reply)}
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
            <button
              type="button"
              onClick={() => submitReply(comment.id)}
              disabled={!canConnect || !(replyDrafts[comment.id] ?? '').trim()}
            >
              <Send size={15} />
            </button>
          </div>
        </div>
      </article>
    )
  }

  function renderCommentBody(comment: CommentItem) {
    if (editingCommentId !== comment.id) {
      return <p>{comment.content}</p>
    }

    return (
      <div className="comment-edit-box">
        <textarea
          value={commentEditText}
          onChange={(event) => setCommentEditText(event.target.value)}
          autoFocus
        />
        <div className="comment-edit-actions">
          <button type="button" onClick={cancelEditComment}>
            취소
          </button>
          <button
            className="primary"
            type="button"
            onClick={() => submitCommentEdit(comment.id)}
            disabled={!commentEditText.trim()}
          >
            저장
          </button>
        </div>
      </div>
    )
  }

  function renderChat() {
    return (
      <>
        {showDevTools && (
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
                onClick={() => connectRealtime()}
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
        )}

        <section className="main-column chat-workspace">
          <aside className="chat-room-column">
            <div className="section-heading compact">
              <div>
                <span className="eyebrow">Rooms</span>
                <h2>내 채팅방</h2>
              </div>
            </div>
            <div className="room-list">
              {chatRooms.length === 0 ? (
                <p className="muted">참여 중인 채팅방이 없습니다.</p>
              ) : (
                chatRooms.map((room) => (
                  <div
                    className={roomId === String(room.id) ? 'room-list-entry active' : 'room-list-entry'}
                    key={room.id}
                  >
                    <button
                      className="room-list-item"
                      type="button"
                      onClick={() => loadChatMessages(room.id)}
	                    >
	                      <strong>{chatRoomTitle(room, knownStudies)}</strong>
	                      <span>{chatRoomMeta(room, knownStudies)}</span>
	                    </button>
                    <button
                      className="room-delete-button"
                      type="button"
                      onClick={() => removeChatRoom(room)}
                      aria-label={`${chatRoomTitle(room, knownStudies)} 삭제`}
                      title="삭제"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))
              )}
            </div>
          </aside>

          <div className="chat-thread-column">
            <div className="chat-thread-header">
              <div>
                <span className="eyebrow">Chat</span>
                <h2>{activeRoomLabel}</h2>
              </div>
              <div className="row-actions">
                <div className="chat-members-menu">
                  <button
                    className="icon-text-button"
                    type="button"
                    onClick={() => setShowChatMembers((current) => !current)}
                    disabled={!roomId}
                  >
                    <Users size={16} />
                    참여자
                  </button>
                  {showChatMembers && (
                    <div className="chat-members-popover" role="dialog" aria-label="참여 멤버">
                      <strong>참여 멤버</strong>
                      {chatMembers.length === 0 ? (
                        <p className="muted">아직 표시할 멤버가 없습니다.</p>
                      ) : (
                        <ul>
                          {chatMembers.map((member) => (
                            <li key={member.memberId}>
                              <div className="avatar">
                                {memberAvatarLabel(member.nickname, member.memberId)}
                              </div>
                              <span>
                                {memberDisplayName(member.memberId, member.nickname, profile, activeProfileMemberId)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="chat-panel">
              {chatMessages.length === 0 ? (
                <EmptyState
                  icon={MessageSquareText}
                  text={
                    roomId
                      ? (isActiveRoomReadOnly ? '종료된 스터디 채팅방입니다.' : '아직 메시지가 없습니다.')
                      : '채팅방을 선택하세요.'
                  }
                />
              ) : (
                chatMessages.map((item, index) => (
                  <article className="message-row" key={`${item.id ?? 'local'}-${index}`}>
                    <div className="avatar">{String(item.senderMemberId).slice(-2)}</div>
                    <div>
                      <div className="message-meta">
                        <strong>
                          {memberDisplayName(
                            item.senderMemberId,
                            chatMembers.find((member) => member.memberId === item.senderMemberId)?.nickname,
                            profile,
                            activeProfileMemberId,
                          )}
                        </strong>
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
                placeholder={isActiveRoomReadOnly ? '종료된 스터디입니다' : (roomId ? '메시지를 입력하세요' : '채팅방을 먼저 선택하세요')}
                disabled={!roomId || isActiveRoomReadOnly}
              />
              <button type="button" onClick={submitMessage} disabled={!roomId || isActiveRoomReadOnly}>
                <Send size={18} />
              </button>
            </div>
          </div>
        </section>
        {showDevTools && renderActivityPanel()}
      </>
    )
  }

  function renderNotificationPopup() {
    const unreadCount = notifications.filter((item) => !item.read).length

    return (
      <div className="notification-popover" role="dialog" aria-label="알림">
        <div className="popover-header">
          <div>
            <h2>알림</h2>
            <span>{unreadCount > 0 ? `새 알림 ${unreadCount}개` : `${notifications.length}개`}</span>
          </div>
          <button
            className="notification-read-all-button"
            type="button"
            onClick={() => void markAllNotificationsRead()}
            disabled={unreadCount === 0}
          >
            모두 읽음
          </button>
        </div>
        <div className="notification-list">
          {notifications.length === 0 ? (
            <p className="muted">아직 수신한 알림이 없습니다.</p>
          ) : (
            notifications.map((item, index) => (
              <article
                className={item.read ? 'notice-row read' : 'notice-row'}
                key={`${item.id ?? 'notice'}-${index}`}
              >
                <button
                  className="notice-main"
                  type="button"
                  onClick={() => void openNotification(item)}
                >
                  <Bell size={17} />
                  <div>
                    <strong>{item.message}</strong>
                    <span>{notificationLabel(item)}</span>
                  </div>
                </button>
                {!item.read && (
                  <button
                    className="notice-read-button"
                    type="button"
                    onClick={() => void markNotificationReadLocally(item)}
                  >
                    읽음
                  </button>
                )}
                <button
                  className="notice-delete-button"
                  type="button"
                  onClick={() => void removeNotification(item)}
                  aria-label="알림 삭제"
                  title="삭제"
                >
                  <X size={14} />
                </button>
              </article>
            ))
          )}
        </div>
      </div>
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

  function renderToast() {
    const Icon = toast?.kind === 'success'
      ? CheckCircle2
      : toast?.kind === 'error'
        ? CircleAlert
        : Bell

    return (
      <div
        className={`toast ${toast?.kind ?? 'info'}`}
        role={toast?.kind === 'error' ? 'alert' : 'status'}
      >
        <Icon size={18} />
        <div>
          <strong>{toast?.title}</strong>
          {toast?.message && <span>{toast.message}</span>}
        </div>
        <button type="button" onClick={() => setToast(null)} aria-label="알림 닫기">
          <X size={14} />
        </button>
      </div>
    )
  }

  function pageTitle() {
    if (activeView === 'lobby') return '홈'
    if (activeView === 'studies') return '스터디'
    if (activeView === 'posts') return '커뮤니티'
    if (activeView === 'mypage') return '마이페이지'
    return '채팅'
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

function renderStudyDetail(label: string, value: string) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
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

function formatDateTime(value?: string | null) {
  if (!value) return '방금'
  return new Intl.DateTimeFormat('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value))
}

function actionLabel(action: StudyAction) {
  if (action === 'join') return '참여 신청'
  if (action === 'close') return '마감'
  if (action === 'end') return '종료'
  if (action === 'delete') return '삭제'
  if (action === 'hideHistory') return '목록 삭제'
  return '탈퇴'
}

function studyActionSuccessMessage(action: StudyAction) {
  if (action === 'join') return '스터디 참여를 신청했습니다.'
  if (action === 'close') return '스터디 모집을 마감했습니다.'
  if (action === 'end') return '스터디를 종료했습니다.'
  if (action === 'delete') return '스터디를 삭제했습니다.'
  if (action === 'hideHistory') return '지난 스터디 목록에서 삭제했습니다.'
  return '스터디에서 탈퇴했습니다.'
}

function studyActionFailureMessage(action: StudyAction) {
  if (action === 'join') return '스터디 참여를 신청하지 못했습니다.'
  if (action === 'close') return '스터디 모집을 마감하지 못했습니다.'
  if (action === 'end') return '스터디를 종료하지 못했습니다.'
  if (action === 'delete') return '스터디를 삭제하지 못했습니다.'
  if (action === 'hideHistory') return '지난 스터디 목록에서 삭제하지 못했습니다.'
  return '스터디에서 탈퇴하지 못했습니다.'
}

function isValidNickname(nickname: string) {
  return /^[가-힣A-Za-z0-9_]{2,20}$/.test(nickname)
}

function validateStudyForm(form: StudyForm) {
  const errors: StudyFormErrors = {}

  for (const field of studyFormFieldOrder) {
    if (!form[field].trim()) {
      errors[field] = studyFormRequiredMessage(field)
    }
  }

  const capacity = Number(form.capacity)
  if (form.capacity.trim() && (!Number.isInteger(capacity) || capacity < 1)) {
    errors.capacity = studyFormCapacityMessage()
  }

  for (const [field, maxLength] of Object.entries(studyFormFieldMaxLengths)) {
    const studyField = field as StudyFormField
    if (maxLength == null) continue
    if (form[studyField].trim().length > maxLength) {
      errors[studyField] = studyFormMaxLengthMessage(studyField, maxLength)
    }
  }

  return {
    errors,
    firstMessage: firstStudyFormErrorMessage(errors),
  }
}

function firstStudyFormErrorMessage(errors: StudyFormErrors) {
  for (const field of studyFormFieldOrder) {
    const message = errors[field]
    if (message) return studyFormToastMessage(field, message)
  }

  return '입력값을 다시 확인해 주세요.'
}

function studyFormToastMessage(field: StudyFormField, message: string) {
  return `${studyFormFieldLabels[field]}: ${message}`
}

function studyFormErrorsFromApiError(error: unknown): StudyFormErrors {
  if (!(error instanceof ApiClientError) || !Array.isArray(error.detail)) {
    return {}
  }

  return error.detail.reduce<StudyFormErrors>((errors, item) => {
    if (!isApiFieldError(item)) return errors
    if (item.field === 'hasRecruitmentInfo') {
      for (const field of studyFormFieldOrder) {
        if (field !== 'title') {
          errors[field] = studyFormRequiredMessage(field)
        }
      }
      return errors
    }

    const field = normalizeStudyFormField(item.field)
    if (!field) return errors

    errors[field] = friendlyStudyFieldError(field, item.message)
    return errors
  }, {})
}

function isApiFieldError(value: unknown): value is { field: string; message?: string } {
  return typeof value === 'object'
    && value != null
    && 'field' in value
    && typeof (value as { field?: unknown }).field === 'string'
}

function normalizeStudyFormField(field: string): StudyFormField | null {
  return studyFormFieldOrder.includes(field as StudyFormField) ? field as StudyFormField : null
}

function friendlyStudyFieldError(field: StudyFormField, message?: string) {
  if (!message) return `입력값 확인 · 예: ${studyFormFieldExamples[field]}`
  if (message.includes('공백') || message.includes('blank') || message.includes('참')) {
    return studyFormRequiredMessage(field)
  }
  if (message.includes('크기') || message.includes('size') || message.includes('length')) {
    const maxLength = studyFormFieldMaxLengths[field]
    return maxLength ? studyFormMaxLengthMessage(field, maxLength) : `길이 확인 · 예: ${studyFormFieldExamples[field]}`
  }
  if (field === 'capacity' && (message.includes('1') || message.includes('최솟값') || message.includes('greater'))) {
    return studyFormCapacityMessage()
  }
  return message
}

function studyFormRequiredMessage(field: StudyFormField) {
  return `필수 입력 · 예: ${studyFormFieldExamples[field]}`
}

function studyFormMaxLengthMessage(field: StudyFormField, maxLength: number) {
  return `${maxLength}자 이하 · 예: ${studyFormFieldExamples[field]}`
}

function studyFormCapacityMessage() {
  return `1 이상의 숫자 · 예: ${studyFormFieldExamples.capacity}`
}

function isInvalidInputError(error: unknown) {
  return error instanceof ApiClientError
    && (error.code === 'GLOBAL-400' || error.message.includes('입력값'))
}

function isSignupRequired(profile: AuthProfile) {
  return profile.signupRequired === true
    || profile.nicknameRequired === true
    || profile.termsAgreementRequired === true
}

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message
  return fallback
}

function isSessionExpired(error: unknown) {
  return error instanceof ApiClientError && error.status === 401
}

function isStudyRecruiting(status: string) {
  return recruitingStudyStatuses.has(status.toUpperCase())
}

function isStudyEnded(status: string) {
  return status.toUpperCase() === 'ENDED'
}

function isStudyDeleted(status: string) {
  return status.toUpperCase() === 'DELETED'
}

function studyStatusLabel(status: string) {
  const normalized = status.toUpperCase()
  if (normalized === 'ENDED') return '종료'
  if (normalized === 'DELETED') return '삭제됨'
  return isStudyRecruiting(status) ? '모집중' : '모집마감'
}

function studyStatusClassName(status: string) {
  const normalized = status.toUpperCase()
  if (normalized === 'ENDED') return 'ended'
  if (normalized === 'DELETED') return 'deleted'
  return isStudyRecruiting(status) ? '' : 'closed'
}

function studyOwnerLabel(study: StudyItem) {
  return study.ownerNickname ? `스터디장 ${study.ownerNickname}` : '스터디장'
}

function authorDisplayName(item: PostItem | CommentItem) {
  return item.authorNickname?.trim() || `멤버 ${item.authorMemberId}`
}

function authorAvatarSrc(item: PostItem | CommentItem) {
  return item.authorProfileImageUrl || avatarDataUrl(authorDisplayName(item))
}

function memberDisplayName(
  memberId: number,
  nickname: string | null | undefined,
  profile: AuthProfile | null,
  activeProfileMemberId: number | null,
) {
  if (activeProfileMemberId === memberId) {
    return profile?.nickname ?? nickname ?? profile?.email ?? '나'
  }
  return nickname ?? `멤버 ${memberId}`
}

function memberAvatarLabel(nickname: string | null | undefined, memberId: number) {
  return (nickname?.trim().slice(0, 1) || String(memberId).slice(-2)).toUpperCase()
}

function parseStudyDescription(description: string) {
  const fallback = description.trim() || '등록된 내용이 없습니다.'
  const lines = description.split('\n')
  const detail = {
    method: '',
    target: '',
    rules: '',
  }

  for (const line of lines) {
    const [label, ...rest] = line.split(':')
    const value = rest.join(':').trim()
    if (label.trim() === '진행 방식') detail.method = value
    if (label.trim() === '모집 대상') detail.target = value
    if (label.trim() === '규칙') detail.rules = value
  }

  return {
    progressMethod: detail.method || fallback,
    targetAudience: detail.target || '제한 없음',
    rules: detail.rules || '자율 운영',
  }
}

function studyDetail(study: StudyItem) {
  const legacy = parseStudyDescription(study.description)
  return {
    progressMethod: study.progressMethod?.trim() || legacy.progressMethod,
    targetAudience: study.targetAudience?.trim() || legacy.targetAudience,
    rules: study.rules?.trim() || legacy.rules,
    capacity: study.capacity != null ? `${study.capacity}명` : '협의',
    schedule: study.schedule?.trim() || '협의',
  }
}

function chatRoomTitle(room: ChatRoom, studies: StudyItem[]) {
  if (room.title) return room.title
  if (room.type === 'STUDY' && room.studyId) {
    return studies.find((study) => study.id === room.studyId)?.title ?? '스터디 채팅'
  }

  return '1:1 채팅'
}

function chatRoomMeta(room: ChatRoom, studies: StudyItem[]) {
  if (room.type === 'PRIVATE') return '1:1'
  if (room.type === 'STUDY' && room.studyId) {
    const study = studies.find((item) => item.id === room.studyId)
    if (study && (isStudyEnded(study.status) || isStudyDeleted(study.status))) {
      return '스터디 · 종료'
    }
    return '스터디'
  }
  return '채팅'
}

function notificationLabel(item: NotificationItem) {
  if (item.targetType === 'STUDY') return '스터디'
  if (item.targetType === 'COMMENT') return '커뮤니티'
  if (item.targetType === 'CHAT_ROOM') return '채팅'
  return '알림'
}

function avatarDataUrl(value: string) {
  const label = (value.trim().slice(0, 1) || 'S').toUpperCase()
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80"><rect width="80" height="80" rx="40" fill="#24272d"/><text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" fill="white" font-family="Arial, sans-serif" font-size="34" font-weight="700">${label}</text></svg>`
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`
}

export default App
