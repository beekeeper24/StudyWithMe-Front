import type { AccessTokenResponse } from './types'

export type OAuthCallbackResult = {
  token: AccessTokenResponse | null
  errorMessage?: string
}

const oauthCallbackFailureMessage = '로그인 정보를 확인하지 못했습니다. 다시 로그인해 주세요.'
const postLoginRedirectStorageKey = 'studywithme.postLoginRedirectPath'

function clearCallbackUrl() {
  window.history.replaceState(null, '', window.location.pathname || '/')
}

function normalizeRedirectPath(path: string) {
  try {
    const url = new URL(path, window.location.origin)
    if (url.origin !== window.location.origin) return null
    if (url.pathname === '/auth/callback') return null
    return `${url.pathname}${url.search}` || '/'
  } catch {
    return null
  }
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
