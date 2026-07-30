import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { KidHome } from '@/components/kid/KidHome'

export const dynamic = 'force-dynamic'

function taskAppliesToday(t: { recurrence: string; days: number[] | null }): boolean {
  const day = new Date().getDay()
  if (t.recurrence === 'daily') return true
  if (t.recurrence === 'weekdays') return day >= 1 && day <= 5
  if (t.recurrence === 'weekend') return day === 0 || day === 6
  if (t.recurrence === 'custom') return (t.days ?? []).includes(day)
  return true
}

export default async function KidPinPage({ params }: { params: Promise<{ pin: string }> }) {
  const { pin } = await params
  const supabase = await createClient()

  const { data, error } = await supabase.rpc('get_child_by_pin', { pin: pin.toUpperCase() })
  if (error || !data || data.length === 0) notFound()

  const row = data[0]
  const today = new Date().toISOString().split('T')[0]

  const { data: tasksData } = await supabase
    .from('tasks')
    .select('*, task_completions(id, date)')
    .eq('child_id', row.child_id)
    .eq('active', true)

  const tasks = (tasksData ?? [])
    .filter((t: any) => taskAppliesToday(t))
    .map((t: any) => ({
      id: t.id,
      title: t.title,
      recurrence: t.recurrence,
      days: t.days ?? null,
      points: t.points ?? 10,
      completed_today: t.task_completions?.some((tc: any) => tc.date === today) ?? false,
      completion_dates: (t.task_completions ?? []).map((tc: any) => tc.date as string),
    }))

  return (
    <KidHome
      child={{
        id: row.child_id,
        name: row.child_name,
        avatar_color: row.avatar_color,
        reward_text: row.reward_text ?? null,
        familyId: row.family_id,
        pin: pin.toUpperCase(),
      }}
      tasks={tasks}
    />
  )
}
