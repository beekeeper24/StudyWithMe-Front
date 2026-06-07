import type { AccessTokenResponse } from './types'

export type OAuthCallbackResult = {
  token: AccessTokenResponse | null
  errorMessage?: string
}

const oauthCallbackFailureMessage = '로그인 정보를 확인하지 못했습니다. 다시 로그인해 주세요.'
const postLoginRedirectStorageKey = 'studywithme.postLoginRedirectPath'
const sessionExpiredNotice = '세션이 만료되었습니다. 다시 로그인하면 이 화면으로 돌아옵니다.'

function clearCallbackUrl() {
  window.history.replaceState(null, '', window.location.pathname || '/')
}

function currentOrigin() {
  return typeof window === 'undefined' ? 'http://localhost' : window.location.origin
}

function normalizeRedirectPath(path: string) {
  try {
    const origin = currentOrigin()
    const url = new URL(path, origin)
    if (url.origin !== origin) return null
    if (url.pathname === '/auth/callback') return null
    return `${url.pathname}${url.search}` || '/'
  } catch {
    return null
  }
}

export function shouldSavePostLoginRedirectPath(path: string) {
  const normalized = normalizeRedirectPath(path)
  return normalized != null && normalized !== '/'
}

export function authActionLoginNotice(actionName: string) {
  return `${actionName}은 로그인 후 사용할 수 있습니다. 로그인하면 이 화면으로 돌아옵니다.`
}

export function sessionExpiredLoginNotice() {
  return sessionExpiredNotice
}

export function savePostLoginRedirectPath(path = `${window.location.pathname}${window.location.search}`) {
  const normalized = normalizeRedirectPath(path)
  if (!normalized || normalized === '/') {
    window.sessionStorage.removeItem(postLoginRedirectStorageKey)
    return
  }
  window.sessionStorage.setItem(postLoginRedirectStorageKey, normalized)
}

export function consumePostLoginRedirectPath() {
  const path = window.sessionStorage.getItem(postLoginRedirectStorageKey)
  window.sessionStorage.removeItem(postLoginRedirectStorageKey)
  if (!path) return null
  return normalizeRedirectPath(path)
}

export function consumeOAuthCallback(): OAuthCallbackResult {
  const fragment = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : ''
  if (!fragment) return { token: null }

  const params = new URLSearchParams(fragment)
  const accessToken = params.get('accessToken')
  const accessTokenExpiresAt = params.get('accessTokenExpiresAt')
  const tokenType = params.get('tokenType')
  if (!accessToken || !accessTokenExpiresAt || tokenType !== 'Bearer') {
    clearCallbackUrl()
    return {
      token: null,
      errorMessage: oauthCallbackFailureMessage,
    }
  }

  clearCallbackUrl()
  return {
    token: {
      accessToken,
      accessTokenExpiresAt,
      tokenType,
    },
  }
}
