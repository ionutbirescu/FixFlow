/** The JWT claims the client reads. The signature is S1's and S2's business; the browser never checks it. */
export interface JwtClaims {
  /** The username (`tech1`), per the example token in openapi.yaml */
  sub?: string
  /** Expiry, in seconds since the epoch */
  exp?: number
}

/** Reads a JWT's payload without verifying it. Returns `null` when the token is not a well-formed JWT. */
export function decodeJwt(token: string): JwtClaims | null {
  const payload = token.split('.')[1]
  if (!payload) return null
  try {
    const base64 = payload.replace(/-/g, '+').replace(/_/g, '/')
    const bytes = Uint8Array.from(atob(base64), (char) => char.charCodeAt(0))
    const claims: unknown = JSON.parse(new TextDecoder().decode(bytes))
    if (typeof claims !== 'object' || claims === null) return null
    const { sub, exp } = claims as Record<string, unknown>
    return {
      sub: typeof sub === 'string' ? sub : undefined,
      exp: typeof exp === 'number' ? exp : undefined,
    }
  } catch {
    return null
  }
}
