import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { ChildSelector } from '@/components/kid/ChildSelector'

export const dynamic = 'force-dynamic'

export default async function PinPage({ params }: { params: Promise<{ pin: string }> }) {
  const { pin } = await params
  const supabase = await createClient()

  // Lookup family by PIN using our helper function
  const { data, error } = await supabase.rpc('get_family_by_pin', { pin: pin.toUpperCase() })

  if (error || !data || data.length === 0) notFound()

  // Group by family
  const familyId = data[0].family_id
  const children = data.map((row: any) => ({
    id: row.child_id,
    name: row.child_name,
    avatar_color: row.avatar_color,
  }))

  return <ChildSelector familyId={familyId} children={children} pin={pin.toUpperCase()} />
}
