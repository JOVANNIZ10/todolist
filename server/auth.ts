import {
  createHash,
  randomBytes,
  randomInt,
  scrypt,
  timingSafeEqual,
} from 'node:crypto'

export const SESSION_COOKIE = 'dialista_session'
export const PASSWORD_KEY_LENGTH = 64
const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password,
      salt,
      PASSWORD_KEY_LENGTH,
      { N: 16_384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 },
      (error, key) => {
        if (error) reject(error)
        else resolve(key)
      },
    )
  })
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await deriveKey(password, salt)
  return `scrypt:${salt.toString('hex')}:${key.toString('hex')}`
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [scheme, saltHex, hashHex] = stored.split(':')
  if (scheme !== 'scrypt' || !saltHex || !hashHex) return false

  try {
    const salt = Buffer.from(saltHex, 'hex')
    const expected = Buffer.from(hashHex, 'hex')
    if (salt.length === 0 || expected.length !== PASSWORD_KEY_LENGTH) {
      return false
    }

    const actual = await deriveKey(password, salt)
    return timingSafeEqual(actual, expected)
  } catch {
    return false
  }
}

export function createSessionToken(): string {
  return randomBytes(32).toString('base64url')
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export function createInviteCode(): string {
  let code = ''
  for (let index = 0; index < 8; index += 1) {
    code += INVITE_ALPHABET[randomInt(INVITE_ALPHABET.length)]
  }
  return code
}

export function parseCookies(header: string | undefined): Map<string, string> {
  const cookies = new Map<string, string>()
  if (!header) return cookies

  for (const part of header.split(';')) {
    const separator = part.indexOf('=')
    if (separator === -1) continue
    const name = part.slice(0, separator).trim()
    const value = part.slice(separator + 1).trim()
    if (!name) continue
    cookies.set(name, decodeURIComponent(value))
  }

  return cookies
}

export function serializeSessionCookie(
  token: string,
  maxAgeSeconds: number,
  secure: boolean,
): string {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.max(0, Math.floor(maxAgeSeconds))}`,
  ]
  if (secure) parts.push('Secure')
  return parts.join('; ')
}

export function clearSessionCookie(secure: boolean): string {
  return serializeSessionCookie('', 0, secure)
}

export interface RateLimitResult {
  allowed: boolean
  retryAfterSeconds: number
}

/** Límite deslizante en memoria; suficiente para una instancia única. */
export class RateLimiter {
  private readonly hits = new Map<string, number[]>()
  private readonly limit: number
  private readonly windowMs: number

  constructor(limit: number, windowMs: number) {
    this.limit = limit
    this.windowMs = windowMs
  }

  take(key: string, now: number = Date.now()): RateLimitResult {
    const cutoff = now - this.windowMs
    const previous = this.hits.get(key) ?? []
    const recent = previous.filter((timestamp) => timestamp > cutoff)

    if (recent.length >= this.limit) {
      const oldest = recent[0] ?? now
      this.hits.set(key, recent)
      return {
        allowed: false,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((oldest + this.windowMs - now) / 1000),
        ),
      }
    }

    recent.push(now)
    this.hits.set(key, recent)

    if (this.hits.size > 2000) {
      for (const [storedKey, timestamps] of this.hits) {
        const kept = timestamps.filter((timestamp) => timestamp > cutoff)
        if (kept.length === 0) this.hits.delete(storedKey)
        else this.hits.set(storedKey, kept)
      }
    }

    return { allowed: true, retryAfterSeconds: 0 }
  }
}
