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

  const { data: child } = await supabase
    .from('children')
    .select(`
      *,
      families!inner(parent_id),
      tasks (
        *,
        task_completions(id, date, completed_at)
      )
    `)
    .eq('id', id)
    .eq('families.parent_id', user.id)
    .single()

  if (!child) notFound()

  const tasks = (child.tasks ?? []).map((t: any) => ({
    ...t,
    completed_today: t.task_completions?.some((c: any) => c.date === today) ?? false,
  }))

  return <TaskManager child={{ ...child, tasks }} />
}
