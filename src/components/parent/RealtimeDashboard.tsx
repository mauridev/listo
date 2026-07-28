'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function RealtimeDashboard({ familyId }: { familyId: string }) {
  const router = useRouter()

  useEffect(() => {
    const supabase = createClient()

    // Listen for new task completions in real-time
    const channel = supabase
      .channel(`family-${familyId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'task_completions',
        },
        () => {
          // Refresh server components to show updated progress
          router.refresh()
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [familyId, router])

  return null
}
