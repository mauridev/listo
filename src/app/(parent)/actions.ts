'use server'

import { createClient } from '@/lib/supabase/server'
import { generatePin } from '@/lib/pin'
import { revalidatePath } from 'next/cache'

/**
 * Acciones del lado padre. Usan el cliente con la sesión del padre (no la
 * secret key), así que el RLS `parent_own_*` sigue siendo la red de seguridad.
 */

const COLOR_RE = /^#[0-9A-Fa-f]{6}$/

export type CreateChildResult =
  | { status: 'ok'; childId: string }
  | { status: 'error'; message: string }

/**
 * Crea un hijo con un PIN de un CSPRNG (spec 0008 H3 — antes Math.random()).
 * El PIN se genera en el servidor: el cliente no elige ni ve cómo se produce.
 */
export async function createChild(
  name: string,
  avatarColor: string
): Promise<CreateChildResult> {
  const cleanName = (name ?? '').trim()
  if (!cleanName) return { status: 'error', message: 'El nombre es obligatorio' }
  if (cleanName.length > 40) return { status: 'error', message: 'Nombre demasiado largo' }
  if (!COLOR_RE.test(avatarColor ?? '')) {
    return { status: 'error', message: 'Color inválido' }
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { status: 'error', message: 'Sesión expirada' }

  const { data: family } = await supabase
    .from('families')
    .select('id')
    .eq('parent_id', user.id)
    .single()

  if (!family) return { status: 'error', message: 'Error cargando la familia' }

  // Reintentos por colisión de PIN (unique index en children.child_pin)
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: child, error } = await supabase
      .from('children')
      .insert({
        family_id: family.id,
        name: cleanName,
        avatar_color: avatarColor,
        child_pin: generatePin(),
      })
      .select('id')
      .single()

    if (!error && child) {
      revalidatePath('/dashboard')
      return { status: 'ok', childId: child.id as string }
    }
    // 23505 = unique_violation → reintentar con otro PIN
    if (error && error.code !== '23505') {
      return { status: 'error', message: error.message }
    }
  }

  return { status: 'error', message: 'No se pudo generar un PIN único, probá de nuevo' }
}

export type ResolveRedemptionResult =
  | { status: 'ok'; resolution: 'approved' | 'rejected' }
  | { status: 'insufficient_points'; balance: number; needed: number }
  | { status: 'not_found' | 'already_resolved' | 'error' }

/**
 * Aprueba o rechaza un canje. El descuento lo hace la RPC leyendo el costo de
 * la DB y solo si estaba 'pending' — así doble click no descuenta dos veces (M5).
 */
export async function resolveRedemption(
  redemptionId: string,
  approve: boolean
): Promise<ResolveRedemptionResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { status: 'error' }

  const { data, error } = await supabase.rpc('parent_resolve_redemption', {
    p_redemption_id: redemptionId,
    p_approve: approve,
  })

  if (error) {
    console.error('[parent] parent_resolve_redemption falló:', error.message)
    return { status: 'error' }
  }

  revalidatePath('/dashboard')
  return data as ResolveRedemptionResult
}
