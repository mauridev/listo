'use server'

import { cookies } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { resolvePin } from '@/lib/kid-data'
import { KID_COOKIE, createKidSession, verifyKidSession } from '@/lib/kid-session'
import { isPlausibleLocalDate } from '@/lib/recurrence'
import { isValidPinFormat } from '@/lib/pin'

/**
 * Server actions del flujo del hijo (spec 0008, R1/R3/R4).
 *
 * Regla: el `child_id` NUNCA viene de un argumento. Sale de la cookie firmada.
 * Todo lo que el cliente puede mandar es qué tarea/recompensa quiere tocar, y
 * la RPC valida que le pertenezca.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

async function currentSession() {
  const store = await cookies()
  return verifyKidSession(store.get(KID_COOKIE)?.value)
}

export type StartResult =
  | { status: 'ok' }
  | { status: 'not_found' }
  | { status: 'rate_limited'; retryAfterSeconds: number }

/** Valida el PIN y abre la sesión del hijo en una cookie httpOnly firmada. */
export async function startKidSession(pin: string): Promise<StartResult> {
  const clean = (pin ?? '').trim().toUpperCase()
  if (!isValidPinFormat(clean)) return { status: 'not_found' }

  const result = await resolvePin(clean)

  if (result.status === 'rate_limited') {
    return { status: 'rate_limited', retryAfterSeconds: result.retry_after_seconds }
  }
  if (result.status !== 'ok') return { status: 'not_found' }

  const { value, maxAge } = createKidSession({
    cid: result.child.id,
    fid: result.child.family_id,
    pin: clean,
  })

  const store = await cookies()
  store.set(KID_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge,
  })

  return { status: 'ok' }
}

export async function endKidSession(): Promise<void> {
  const store = await cookies()
  store.delete(KID_COOKIE)
}

export type CompleteResult =
  | { status: 'ok'; awarded: number; balance: number }
  | { status: 'already_done'; awarded: 0; balance: number }
  | { status: 'no_session' | 'invalid_task' | 'invalid_date' | 'not_scheduled' | 'error' }

/**
 * Marca una tarea como hecha. Los puntos los decide el servidor leyendo
 * `tasks.points` — el cliente no manda ningún delta (C1).
 */
export async function completeTask(
  taskId: string,
  localDate: string
): Promise<CompleteResult> {
  const session = await currentSession()
  if (!session) return { status: 'no_session' }

  if (!UUID_RE.test(taskId ?? '')) return { status: 'invalid_task' }
  if (!isPlausibleLocalDate(localDate ?? '')) return { status: 'invalid_date' }

  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc('kid_complete_task', {
    p_child_id: session.cid,
    p_task_id: taskId,
    p_date: localDate,
  })

  if (error) {
    console.error('[kid] kid_complete_task falló:', error.message)
    return { status: 'error' }
  }
  return data as CompleteResult
}

export type RedemptionResult =
  | { status: 'ok'; balance: number }
  | { status: 'insufficient_points'; balance: number; needed: number }
  | { status: 'no_session' | 'invalid_reward' | 'already_requested' | 'error' }

/** Pide un canje. El saldo se valida en el servidor y el status queda 'pending' (H2). */
export async function requestRedemption(rewardId: string): Promise<RedemptionResult> {
  const session = await currentSession()
  if (!session) return { status: 'no_session' }
  if (!UUID_RE.test(rewardId ?? '')) return { status: 'invalid_reward' }

  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc('kid_request_redemption', {
    p_child_id: session.cid,
    p_reward_id: rewardId,
  })

  if (error) {
    console.error('[kid] kid_request_redemption falló:', error.message)
    return { status: 'error' }
  }
  return data as RedemptionResult
}
