import { randomBytes } from 'node:crypto'

/**
 * Spec 0008 (H3): antes los PINs salían de `Math.random()` (CWE-338), y el PIN
 * es la ÚNICA credencial de acceso del hijo. Ahora salen de un CSPRNG.
 *
 * Alfabeto de 32 símbolos sin I/O/0/1 para que un chico de 6 años no confunda
 * caracteres. 256 es múltiplo de 32, así que `& 31` es uniforme: sin sesgo de
 * módulo (el clásico `% alphabet.length` sí lo tendría con otro alfabeto).
 */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const PIN_LENGTH = 6

export function generatePin(): string {
  const bytes = randomBytes(PIN_LENGTH)
  let pin = ''
  for (let i = 0; i < PIN_LENGTH; i++) {
    pin += ALPHABET[bytes[i] & 31]
  }
  return pin
}

export function isValidPinFormat(pin: string): boolean {
  return new RegExp(`^[${ALPHABET}]{${PIN_LENGTH}}$`).test(pin)
}
