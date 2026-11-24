// Tokens for the mock API. They look like S1's JWTs (header.payload.signature, `sub` = username, `exp`),
// so the client decodes them the same way, but the signature is fake and only the mocks accept them.
import type { Role } from '../api/types'

export const TOKEN_TTL_SECONDS = 8 * 60 * 60

export interface MockClaims {
  sub: string
  uid: string
  role: Role
  iat: number
  exp: number
}

export function createMockToken(
  user: { id: string; username: string; role: Role },
  { ttlSeconds = TOKEN_TTL_SECONDS, now = Date.now() } = {},
): string {
  const iat = Math.floor(now / 1000)
  const claims: MockClaims = { sub: user.username, uid: user.id, role: user.role, iat, exp: iat + ttlSeconds }
  return `${base64Url({ alg: 'HS256', typ: 'JWT' })}.${base64Url(claims)}.mock-signature`
}

/** The claims of a token made by `createMockToken`, or `null` if it is malformed or expired. */
export function readMockToken(token: string, now = Date.now()): MockClaims | null {
  const [, payload, signature] = token.split('.')
  if (!payload || signature !== 'mock-signature') return null
  try {
    const claims = JSON.parse(fromBase64Url(payload)) as MockClaims
    return typeof claims.uid === 'string' && claims.exp * 1000 > now ? claims : null
  } catch {
    return null
  }
}

function base64Url(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value))
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function fromBase64Url(text: string): string {
  const bytes = Uint8Array.from(atob(text.replace(/-/g, '+').replace(/_/g, '/')), (char) => char.charCodeAt(0))
  return new TextDecoder().decode(bytes)
}
