import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { CheckinExperience } from '@/components/kid/CheckinExperience'
import { createAdminClient } from '@/lib/supabase/admin'
import { loadKidState } from '@/lib/kid-data'
import { KID_COOKIE, verifyKidSession } from '@/lib/kid-session'
import { localDateStr } from '@/lib/recurrence'

export const dynamic = 'force-dynamic'

/**
 * Check-in del hijo.
 *
 * Spec 0008 (H1): antes esto era un componente cliente que leía la identidad
 * del hijo de `sessionStorage` y le creía. Ahora la identidad sale de la cookie
 * firmada, del lado servidor, y además se valida que el PIN de la URL sea el
 * mismo con el que se abrió la sesión (si no, redirige a empezar de nuevo).
 */
export default async function CheckinPage({
  params,
}: {
  params: Promise<{ pin: string }>
}) {
  const { pin } = await params
  const store = await cookies()
  const session = verifyKidSession(store.get(KID_COOKIE)?.value)

  // Sin sesión válida, o el PIN de la URL no es el de la sesión → volver a entrar
  if (!session || session.pin !== pin.toUpperCase()) {
    redirect(`/c/${pin.toUpperCase()}`)
  }

  const today = localDateStr()
  const state = await loadKidState(session.cid, today)

  // El nombre/color salen de la DB por el child_id verificado, no del cliente
  const supabase = createAdminClient()
  const { data: child } = await supabase
    .from('children')
    .select('id, name, avatar_color, reward_text')
    .eq('id', session.cid)
    .single()

  if (!child) redirect(`/c/${pin.toUpperCase()}`)

  return (
    <CheckinExperience
      child={{
        id: child.id as string,
        name: child.name as string,
        avatar_color: child.avatar_color as string,
        reward_text: (child.reward_text ?? null) as string | null,
        pin: session.pin,
      }}
      initialTasks={state.tasks}
      initialBalance={state.balance}
      initialCatalog={state.catalog}
      initialRedemptions={state.redemptions}
    />
  )
}
