# StudyWithMe Front

StudyWithMe 프론트엔드입니다. 백엔드와 같은 부모 폴더에 sibling 프로젝트로 둡니다.

```text
/home/beekeeper24/projects/
  StudyWithMe/
  StudyWithMe-Front/
```

## Stack

- Vite
- React
- TypeScript
- STOMP over WebSocket

## Local Setup

```bash
npm install
cp .env.example .env.local
npm run dev
```

기본값:

- backend API: `http://localhost:8081`
- websocket: `ws://localhost:8081/ws`
- frontend dev server: `http://localhost:5173`

## Backend Integration

현재 화면은 로그인한 사용자가 스터디, 커뮤니티, 채팅, 알림을 이용하는 MVP 앱입니다.
로그인 전에는 OAuth 로그인 화면만 노출하며, 사이트 기능 API는 백엔드에서도 JWT 인증이 필요합니다.

- `GET /api/v1/auth/me`
- `GET /api/v1/studies`
- `POST /api/v1/studies`
- `POST /api/v1/studies/{studyId}/join`
- `POST /api/v1/studies/{studyId}/leave`
- `POST /api/v1/studies/{studyId}/close`
- `GET /api/v1/posts`
- `GET /api/v1/posts/{postId}`
- `POST /api/v1/posts`
- `PUT /api/v1/posts/{postId}`
- `DELETE /api/v1/posts/{postId}`
- `GET /api/v1/posts/{postId}/comments`
- `POST /api/v1/posts/{postId}/comments`
- `POST /api/v1/comments/{commentId}/replies`
- `GET /api/v1/notifications`
- STOMP `CONNECT /ws`
- `SUBSCRIBE /topic/chat.rooms.{roomId}`
- `SEND /app/chat.rooms.{roomId}.messages`
- `SUBSCRIBE /user/queue/notifications`

OAuth 로그인 흐름:

1. 프론트에서 Google/Kakao 버튼을 누르면 백엔드 OAuth2 authorization endpoint로 이동합니다.
2. 백엔드 OAuth 성공 핸들러가 refresh token을 HttpOnly cookie로 설정합니다.
3. 백엔드는 access token을 URL fragment에 담아 프론트 callback으로 redirect합니다.
4. 프론트는 fragment를 메모리 state로 옮긴 뒤 URL에서 제거합니다.
5. 새로고침 이후에는 `POST /api/v1/auth/refresh`로 access token을 다시 받습니다.

프론트는 시작 시 refresh token cookie로 세션 복구를 자동 시도합니다. 성공하면 access token을 메모리 state로 복구하고 내 정보, 알림, 채팅방 목록을 동기화합니다.

일반 화면에서는 access token과 backend URL 같은 내부 값을 노출하지 않습니다.

백엔드 OAuth 성공 redirect 기본값은 `http://localhost:5173/auth/callback`입니다. Vite가 `5174`로 떠 있으면 백엔드를 아래처럼 실행하세요.

```bash
OAUTH_SUCCESS_FRONTEND_REDIRECT_URI=http://localhost:5174/auth/callback ./gradlew bootRun
```

REST와 STOMP 연결은 OAuth 로그인 후 발급된 access token으로 자동 처리합니다.

## Production Deployment

Vercel 같은 호스팅 환경에서는 `.env.production.example`을 기준으로 운영 환경변수를 설정합니다.

```bash
VITE_API_BASE_URL=https://api.example.com
VITE_WS_URL=wss://api.example.com/ws
```

- `VITE_API_BASE_URL`은 백엔드 API origin입니다. 끝에 `/api/v1`을 붙이지 않습니다.
- `VITE_WS_URL`은 백엔드 STOMP WebSocket endpoint입니다. 운영 HTTPS 배포에서는 `wss://`를 사용합니다.
- 프론트 API client는 refresh token cookie를 보낼 수 있도록 모든 `fetch` 요청에 `credentials: 'include'`를 사용합니다.
- 백엔드 `APP_CORS_ALLOWED_ORIGINS`에는 실제 프론트 origin을 정확히 넣어야 합니다.
- 프론트와 백엔드가 cross-site이면 백엔드 refresh cookie 설정에 `REFRESH_TOKEN_COOKIE_SAME_SITE=None`과 `REFRESH_TOKEN_COOKIE_SECURE=true`가 필요합니다.
