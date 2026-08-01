'use server'

import { createClient } from '@/lib/supabase/server'
import { generatePin } from '@/lib/pin'

/**
 * Crea la fila `families` del padre recién registrado, con family_pin de un
 * CSPRNG (spec 0008 H3). Antes esto corría en el cliente con Math.random().
 *
 * Idempotente: si la familia ya existe no hace nada, así da lo mismo si entra
 * por acá (registro sin confirmación de email) o por /auth/callback (con
 * confirmación).
 */
export async function ensureFamily(): Promise<{ ok: boolean; message?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, message: 'Sesión no encontrada' }

  const { data: existing } = await supabase
    .from('families')
    .select('id')
    .eq('parent_id', user.id)
    .maybeSingle()

  if (existing) return { ok: true }

  for (let attempt = 0; attempt < 5; attempt++) {
    const { error } = await supabase
      .from('families')
      .insert({ parent_id: user.id, family_pin: generatePin() })

    if (!error) return { ok: true }
    if (error.code !== '23505') {
      console.error('[auth] no se pudo crear la familia:', error.message)
      return { ok: false, message: error.message }
    }
  }

  return { ok: false, message: 'No se pudo generar un PIN único' }
}
