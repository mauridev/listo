'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function RealtimeDashboard({
  familyId,
  childIds,
}: {
  familyId: string
  childIds: string[]
}) {
  const router = useRouter()
  const childKey = childIds.join(',')

  useEffect(() => {
    const supabase = createClient()
    const ids = childKey ? childKey.split(',') : []
    if (ids.length === 0) return

    // Spec 0008 (L2): antes esto se suscribía a TODOS los task_completions y
    // dependía 100% del RLS para no ver los de otras familias. Filtramos
    // explícitamente por los hijos de esta familia: si mañana alguien agrega una
    // política de lectura amplia, esto no se convierte en un feed cross-tenant.
    const channel = supabase
      .channel(`family-${familyId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'task_completions',
          filter: `child_id=in.(${ids.join(',')})`,
        },
        () => {
          // Refresh server components to show updated progress
          router.refresh()
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [familyId, childKey, router])

  return null
}
