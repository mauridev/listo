import 'server-only'
import { headers } from 'next/headers'
import { createAdminClient } from '@/lib/supabase/admin'
import { taskAppliesOn } from '@/lib/recurrence'

/**
 * Lecturas del flujo del hijo, siempre del lado servidor.
 *
 * Spec 0008 (C2): el rol `anon` ya no puede leer estas tablas. Todo pasa por
 * acá con la secret key, y SIEMPRE filtrado por el `child_id` que salió de una
 * fuente confiable (la cookie firmada o el resultado de kid_resolve_pin).
 * Nunca por un id que mandó el cliente.
 */

export async function clientIp(): Promise<string> {
  const h = await headers()
  const fwd = h.get('x-forwarded-for')
  if (fwd) return fwd.split(',')[0].trim()
  return h.get('x-real-ip') ?? 'unknown'
}

export type ResolvedChild = {
  id: string
  name: string
  avatar_color: string
  reward_text: string | null
  family_id: string
}

export type ResolveResult =
  | { status: 'ok'; child: ResolvedChild }
  | { status: 'not_found' }
  | { status: 'rate_limited'; retry_after_seconds: number }

/** Resuelve un PIN. Cuenta el intento para el rate limiting por IP (H4). */
export async function resolvePin(pin: string): Promise<ResolveResult> {
  const supabase = createAdminClient()
  const { data, error } = await supabase.rpc('kid_resolve_pin', {
    p_pin: pin.toUpperCase(),
    p_ip: await clientIp(),
  })

  if (error) {
    console.error('[kid] kid_resolve_pin falló:', error.message)
    return { status: 'not_found' }
  }
  return data as ResolveResult
}

export type KidTask = {
  id: string
  title: string
  recurrence: string
  days: number[] | null
  points: number
  completed_today: boolean
  completion_dates: string[]
}

export type KidCatalogItem = { id: string; title: string; cost_points: number }

export type KidRedemption = {
  id: string
  status: 'pending' | 'approved' | 'rejected'
  rewards_catalog?: { title: string; cost_points: number } | null
}

export type KidState = {
  tasks: KidTask[]
  balance: number
  catalog: KidCatalogItem[]
  redemptions: KidRedemption[]
}

/** Carga todo lo que necesita la pantalla del hijo, scopeado a un child_id. */
export async function loadKidState(childId: string, today: string): Promise<KidState> {
  const supabase = createAdminClient()
  const dayOfWeek = new Date(`${today}T00:00:00`).getDay()

  const [tasksRes, balanceRes, catalogRes, redemptionsRes] = await Promise.all([
    supabase
      .from('tasks')
      .select('id, title, recurrence, days, points, task_completions(id, date)')
      .eq('child_id', childId)
      .eq('active', true),
    supabase.rpc('get_child_balance', { p_child_id: childId }),
    supabase
      .from('rewards_catalog')
      .select('id, title, cost_points')
      .eq('child_id', childId)
      .eq('active', true)
      .order('cost_points'),
    supabase
      .from('reward_redemptions')
      .select('id, status, rewards_catalog(title, cost_points)')
      .eq('child_id', childId)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const tasks: KidTask[] = (tasksRes.data ?? [])
    .filter(t => taskAppliesOn(t as never, dayOfWeek))
    .map(t => {
      const completions = (t.task_completions ?? []) as { date: string }[]
      return {
        id: t.id as string,
        title: t.title as string,
        recurrence: t.recurrence as string,
        days: (t.days ?? null) as number[] | null,
        points: (t.points ?? 10) as number,
        completed_today: completions.some(c => c.date === today),
        completion_dates: completions.map(c => c.date),
      }
    })

  return {
    tasks,
    balance: (balanceRes.data as number | null) ?? 0,
    catalog: (catalogRes.data ?? []) as KidCatalogItem[],
    redemptions: (redemptionsRes.data ?? []) as unknown as KidRedemption[],
  }
}
