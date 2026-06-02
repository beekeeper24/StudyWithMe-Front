import type { AccessTokenResponse } from './types'

export type OAuthCallbackResult = {
  token: AccessTokenResponse | null
  errorMessage?: string
}

const oauthCallbackFailureMessage = '로그인 정보를 확인하지 못했습니다. 다시 로그인해 주세요.'

function clearCallbackUrl() {
  window.history.replaceState(null, '', window.location.pathname || '/')
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
