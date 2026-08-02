import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { KidStoreScreen } from '@/components/kid/KidStore'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadKidState } from '@/lib/kid-data'
import { KID_COOKIE, verifyKidSession } from '@/lib/kid-session'
import { localDateStr } from '@/lib/recurrence'

export const dynamic = 'force-dynamic'

/**
 * La tienda del hijo, sin pasar por el check-in (spec 0011 R2).
 *
 * Existe porque los días sin tareas la pantalla del hijo quedaba sin salida: el
 * único camino a sus puntos era terminar un check-in que no tenía nada que
 * preguntar.
 *
 * El guardián es el mismo que el del check-in, a propósito: identidad de la
 * cookie firmada, PIN de la URL igual al de la sesión, y PIN sin rotar.
 */
export default async function KidStorePage({
  params,
}: {
  params: Promise<{ pin: string }>
}) {
  const { pin } = await params
  const store = await cookies()
  const session = verifyKidSession(store.get(KID_COOKIE)?.value)

  if (!session || session.pin !== pin.toUpperCase()) {
    redirect(`/c/${pin.toUpperCase()}`)
  }

  const supabase = createAdminClient()
  const { data: child } = await supabase
    .from('children')
    .select('id, child_pin')
    .eq('id', session.cid)
    .maybeSingle()

  // El PIN pudo haberse rotado después de emitir la cookie
  if (!child || child.child_pin !== session.pin) {
    redirect(`/c/${pin.toUpperCase()}`)
  }

  // De acá la tienda usa saldo, catálogo y canjes. La fecha solo le importa a
  // las tareas, que esta pantalla no muestra.
  const state = await loadKidState(session.cid, localDateStr())

  return (
    <KidStoreScreen
      pin={session.pin}
      initialBalance={state.balance}
      initialCatalog={state.catalog}
      initialRedemptions={state.redemptions}
    />
  )
}
