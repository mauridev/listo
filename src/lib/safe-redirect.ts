/**
 * Spec 0008 (M1): `/auth/callback?next=` iba sin validar a
 * `new URL(next, request.url)`. Por spec de WHATWG URL, una URL absoluta en el
 * primer argumento descarta la base por completo, y `//host` adopta el esquema
 * de la base pero reemplaza el host. Las dos cosas son un open redirect.
 *
 * El ataque real: un link de confirmación con `next=//sitio-falso/login` manda
 * al usuario a un login falso DESPUÉS de un login legítimo — justo el momento en
 * que más confía en lo que ve.
 *
 * Solo aceptamos paths internos. Ante cualquier duda, `/dashboard`.
 */
export const DEFAULT_REDIRECT = '/dashboard'

// Los control chars (incluidos \t \n \r) se strippean antes de parsear la URL,
// así que "/\t/otro-host" puede terminar resolviendo como "//otro-host".
const CONTROL_CHARS = /[\u0000-\u001f\u007f]/

export function safeNext(raw: string | null | undefined): string {
  if (!raw) return DEFAULT_REDIRECT

  // Tiene que ser un path relativo a la raíz
  if (!raw.startsWith('/')) return DEFAULT_REDIRECT

  // "//host" resuelve a otro host manteniendo el esquema
  if (raw.startsWith('//')) return DEFAULT_REDIRECT

  // Un backslash en cualquier posición puede normalizarse a "/"
  if (raw.includes('\\')) return DEFAULT_REDIRECT

  if (CONTROL_CHARS.test(raw)) return DEFAULT_REDIRECT

  return raw
}
