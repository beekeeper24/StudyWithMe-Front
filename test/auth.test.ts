import assert from 'node:assert/strict'
import { test } from 'node:test'

import {
  authActionLoginNotice,
  sessionExpiredLoginNotice,
  shouldSavePostLoginRedirectPath,
} from '../src/auth.ts'

test('protected deep links are saved for post-login redirect', () => {
  assert.equal(shouldSavePostLoginRedirectPath('/studies/42?tab=requests'), true)
  assert.equal(shouldSavePostLoginRedirectPath('/community/free/17'), true)
  assert.equal(shouldSavePostLoginRedirectPath('/chat/8'), true)
})

test('root and oauth callback paths are not saved for post-login redirect', () => {
  assert.equal(shouldSavePostLoginRedirectPath('/'), false)
  assert.equal(shouldSavePostLoginRedirectPath('/auth/callback'), false)
  assert.equal(shouldSavePostLoginRedirectPath('https://evil.example/studies'), false)
})

test('auth action guard messages name the blocked action', () => {
  assert.equal(
    authActionLoginNotice('댓글 작성'),
    '댓글 작성은 로그인 후 사용할 수 있습니다. 로그인하면 이 화면으로 돌아옵니다.',
  )
})

test('expired sessions tell users the current screen will be restored after login', () => {
  assert.equal(
    sessionExpiredLoginNotice(),
    '세션이 만료되었습니다. 다시 로그인하면 이 화면으로 돌아옵니다.',
  )
})
