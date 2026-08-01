import 'server-only'
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

/**
 * Sesión del hijo — cookie httpOnly firmada.
 *
 * Spec 0008 (H1): antes la identidad del hijo vivía en `sessionStorage` y el
 * servidor le creía el `child_id`. Cualquiera podía editarlo y operar sobre el
 * perfil de otro chico. Ahora el `child_id` sale de una cookie firmada por
 * nosotros: el cliente puede borrarla, no falsificarla.
 *
 * No usamos JWT ni una librería: es un payload chico y un HMAC alcanza.
 */

export const KID_COOKIE = 'listo_kid'
const MAX_AGE_SECONDS = 60 * 60 * 8 // 8 horas: una tarde de tareas

export type KidSession = {
  /** child_id */
  cid: string
  /** family_id */
  fid: string
  /** el PIN con el que entró, para validar que coincide con la URL */
  pin: string
  /** epoch en segundos */
  exp: number
}

function secret(): string {
  const s = process.env.KID_SESSION_SECRET
  if (!s || s.length < 32) {
    throw new Error(
      'KID_SESSION_SECRET falta o es muy corta (mínimo 32 chars). ' +
      'Generar con: openssl rand -base64 32'
    )
  }
  return s
}

function sign(payloadB64: string): string {
  return createHmac('sha256', secret()).update(payloadB64).digest('base64url')
}

export function createKidSession(data: Omit<KidSession, 'exp'>): {
  value: string
  maxAge: number
} {
  const session: KidSession = {
    ...data,
    exp: Math.floor(Date.now() / 1000) + MAX_AGE_SECONDS,
  }
  const payload = Buffer.from(JSON.stringify(session)).toString('base64url')
  return { value: `${payload}.${sign(payload)}`, maxAge: MAX_AGE_SECONDS }
}

/** Devuelve la sesión solo si la firma es válida y no expiró. */
export function verifyKidSession(raw: string | undefined): KidSession | null {
  if (!raw) return null

  const dot = raw.lastIndexOf('.')
  if (dot <= 0) return null

  const payload = raw.slice(0, dot)
  const provided = raw.slice(dot + 1)

  let expected: string
  try {
    expected = sign(payload)
  } catch {
    return null
  }

  // Comparación en tiempo constante
  const a = Buffer.from(provided)
  const b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null

  try {
    const session = JSON.parse(
      Buffer.from(payload, 'base64url').toString('utf8')
    ) as KidSession

    if (!session.cid || !session.fid || !session.pin) return null
    if (typeof session.exp !== 'number') return null
    if (session.exp < Math.floor(Date.now() / 1000)) return null

    return session
  } catch {
    return null
  }
}

/** Para tests/rotación: genera un secreto válido. */
export function generateSessionSecret(): string {
  return randomBytes(32).toString('base64')
}
