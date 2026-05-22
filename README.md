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

현재 화면은 백엔드 실시간 기능 검증용 MVP입니다.

- `GET /api/v1/auth/me`
- `GET /api/v1/notifications`
- STOMP `CONNECT /ws`
- `SUBSCRIBE /topic/chat.rooms.{roomId}`
- `SEND /app/chat.rooms.{roomId}.messages`
- `SUBSCRIBE /user/queue/notifications`

OAuth 로그인 이후 받은 access token을 화면에 입력하면 REST와 STOMP 연결을 확인할 수 있습니다.
