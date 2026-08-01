/**
 * Una sola definición de "¿esta tarea aplica a esta fecha?".
 *
 * Antes esta lógica estaba duplicada en 4 lugares (page del hijo,
 * CheckinExperience, dashboard, y ahora la RPC). Si divergen, el hijo ve una
 * tarea que el servidor rechaza — o peor, al revés.
 *
 * `kid_complete_task` valida lo mismo del lado Postgres: esto es UX, el
 * servidor es la autoridad.
 */
export type Recurrence = 'daily' | 'weekdays' | 'weekend' | 'custom'

export function taskAppliesOn(
  task: { recurrence: string; days: number[] | null },
  dayOfWeek: number
): boolean {
  switch (task.recurrence) {
    case 'daily':
      return true
    case 'weekdays':
      return dayOfWeek >= 1 && dayOfWeek <= 5
    case 'weekend':
      return dayOfWeek === 0 || dayOfWeek === 6
    case 'custom':
      return (task.days ?? []).includes(dayOfWeek)
    default:
      return true
  }
}

/** Fecha local del navegador/servidor en YYYY-MM-DD (no UTC — ver commit 4079b6d). */
export function localDateStr(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Valida que un string sea YYYY-MM-DD y a lo sumo ±1 día de hoy (igual que la RPC). */
export function isPlausibleLocalDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const parsed = Date.parse(`${value}T00:00:00Z`)
  if (Number.isNaN(parsed)) return false
  const todayUtc = Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`)
  const dayMs = 86_400_000
  return Math.abs(parsed - todayUtc) <= dayMs
}
