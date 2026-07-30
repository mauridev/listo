import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { TaskManager } from '@/components/parent/TaskManager'

export const dynamic = 'force-dynamic'

export default async function HijoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const today = new Date().toISOString().split('T')[0]

  const [{ data: child }, { data: catalogData }, { data: redemptionsData }, { data: balanceData }] = await Promise.all([
    supabase
      .from('children')
      .select(`*, families!inner(parent_id), tasks(*, task_completions(id, date, completed_at))`)
      .eq('id', id)
      .eq('families.parent_id', user.id)
      .single(),
    supabase.from('rewards_catalog').select('*').eq('child_id', id).eq('active', true).order('cost_points'),
    supabase.from('reward_redemptions').select('*, rewards_catalog(*)').eq('child_id', id).order('created_at', { ascending: false }).limit(20),
    supabase.rpc('get_child_balance', { p_child_id: id }),
  ])

  if (!child) notFound()

  const tasks = (child.tasks ?? []).map((t: any) => ({
    ...t,
    completed_today: t.task_completions?.some((c: any) => c.date === today) ?? false,
  }))

  return (
    <TaskManager
      child={{
        ...child,
        tasks,
        balance: balanceData ?? 0,
        catalog: catalogData ?? [],
        redemptions: redemptionsData ?? [],
      }}
    />
  )
}
