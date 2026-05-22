import type { AccessTokenResponse } from './types'

export function consumeOAuthCallback(): AccessTokenResponse | null {
  const fragment = window.location.hash.startsWith('#')
    ? window.location.hash.slice(1)
    : ''
  if (!fragment) return null

  const params = new URLSearchParams(fragment)
  const accessToken = params.get('accessToken')
  const accessTokenExpiresAt = params.get('accessTokenExpiresAt')
  const tokenType = params.get('tokenType')
  if (!accessToken || !accessTokenExpiresAt || tokenType !== 'Bearer') {
    return null
  }

  window.history.replaceState(null, '', window.location.pathname || '/')
  return {
    accessToken,
    accessTokenExpiresAt,
    tokenType,
  }
}
