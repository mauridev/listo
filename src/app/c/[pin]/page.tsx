import { notFound } from 'next/navigation'
import { KidHome } from '@/components/kid/KidHome'
import { resolvePin, loadKidState } from '@/lib/kid-data'
import { localDateStr } from '@/lib/recurrence'

export const dynamic = 'force-dynamic'

/**
 * Entrada del hijo por PIN.
 *
 * Spec 0008: todo se resuelve del lado servidor con la secret key. El rol
 * `anon` ya no puede leer `tasks` ni nada del flujo del hijo, así que no hay
 * forma de sacar esta data sin pasar por acá (donde contamos intentos por IP).
 */
export default async function KidPinPage({
  params,
}: {
  params: Promise<{ pin: string }>
}) {
  const { pin } = await params
  const result = await resolvePin(pin)

  if (result.status === 'rate_limited') {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center p-6 text-center gap-3"
        style={{ background: 'var(--bg)' }}
      >
        <p className="text-4xl">⏳</p>
        <h1 className="text-xl font-bold">Demasiados intentos</h1>
        <p className="text-sm max-w-xs" style={{ color: 'var(--t2)' }}>
          Esperá unos minutos y volvé a probar. Si no te acordás tu código,
          pedíselo a tu papá o mamá.
        </p>
      </div>
    )
  }

  if (result.status !== 'ok') notFound()

  const { child } = result
  const today = localDateStr()
  const state = await loadKidState(child.id, today)

  return (
    <KidHome
      child={{
        id: child.id,
        name: child.name,
        avatar_color: child.avatar_color,
        reward_text: child.reward_text,
        familyId: child.family_id,
        pin: pin.toUpperCase(),
      }}
      tasks={state.tasks}
    />
  )
}
