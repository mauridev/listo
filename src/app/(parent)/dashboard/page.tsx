import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChildCard } from '@/components/parent/ChildCard'
import { RealtimeDashboard } from '@/components/parent/RealtimeDashboard'
import type { ChildWithProgress } from '@/types'

export const dynamic = 'force-dynamic'

async function getFamily(userId: string) {
  const supabase = await createClient()

  const { data: family } = await supabase
    .from('families')
    .select('*')
    .eq('parent_id', userId)
    .single()

  if (!family) return null

  const today = new Date().toISOString().split('T')[0]
  const dayOfWeek = new Date().getDay()

  function appliesToday(recurrence: string, days: number[] | null): boolean {
    if (recurrence === 'daily') return true
    if (recurrence === 'weekdays') return dayOfWeek >= 1 && dayOfWeek <= 5
    if (recurrence === 'weekend') return dayOfWeek === 0 || dayOfWeek === 6
    if (recurrence === 'custom') return (days ?? []).includes(dayOfWeek)
    return true
  }

  const { data: children } = await supabase
    .from('children')
    .select(`
      *,
      tasks (
        *,
        task_completions (id, date, completed_at)
      )
    `)
    .eq('family_id', family.id)
    .order('created_at', { ascending: true })

  const enriched: ChildWithProgress[] = (children ?? []).map(child => {
    const tasks = (child.tasks ?? [])
      .filter((t: any) => t.active && appliesToday(t.recurrence, t.days))
      .map((t: any) => {
        const completedToday = t.task_completions?.some((c: any) => c.date === today) ?? false
        return { ...t, completed_today: completedToday }
      })
    const completed = tasks.filter((t: any) => t.completed_today).length
    return {
      ...child,
      tasks,
      total_tasks: tasks.length,
      completed_tasks: completed,
      all_done: tasks.length > 0 && completed === tasks.length,
    }
  })

  return { family, children: enriched }
}

export default async function DashboardPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const data = await getFamily(user.id)

  if (!data) {
    return (
      <div className="text-center py-20">
        <p style={{ color: 'var(--t3)' }}>Error cargando la familia.</p>
      </div>
    )
  }

  const { family, children } = data

  return (
    <div className="space-y-6">
      {/* Per-child access links */}
      {children.length > 0 && (
        <div className="rounded-2xl p-4" style={{ background: 'var(--surf)', border: '1px solid var(--bdr)' }}>
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--t3)' }}>Acceso de hijos</p>
          <div className="space-y-2">
            {children.map(child => (
              <div key={child.id} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ background: child.avatar_color, color: '#fff' }}>
                  {child.name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium" style={{ color: 'var(--t1)' }}>{child.name}</p>
                  <p className="text-xs truncate" style={{ color: 'var(--t3)' }}>
                    {(process.env.NEXT_PUBLIC_APP_URL || 'listo-lemon-ten.vercel.app')}/c/{(child as any).child_pin?.toLowerCase()}
                  </p>
                </div>
                <span className="text-xs font-bold tracking-widest px-2 py-1 rounded-lg flex-shrink-0" style={{ background: 'var(--surf2)', color: 'var(--ac)' }}>
                  {(child as any).child_pin}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Children */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Hoy</h2>
          <Link
            href="/hijos/nuevo"
            className="text-sm font-medium px-3 py-1.5 rounded-lg"
            style={{ background: 'var(--ac-dim)', color: 'var(--ac)', border: '1px solid rgba(124,58,237,0.25)' }}
          >
            + Hijo
          </Link>
        </div>

        {children.length === 0 ? (
          <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--surf)', border: '1px solid var(--bdr)' }}>
            <p className="text-4xl mb-3">👨‍👩‍👧</p>
            <p className="font-semibold mb-1">Agregá tu primer hijo</p>
            <p className="text-sm mb-4" style={{ color: 'var(--t2)' }}>Creá el perfil y configurá sus tareas diarias</p>
            <Link
              href="/hijos/nuevo"
              className="inline-block px-5 py-2.5 rounded-xl font-semibold text-sm"
              style={{ background: 'var(--ac)', color: '#fff' }}
            >
              Agregar hijo
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {children.map(child => (
              <ChildCard key={child.id} child={child} />
            ))}
          </div>
        )}
      </div>

      {/* Real-time updater (client component) */}
      <RealtimeDashboard familyId={family.id} childIds={children.map(c => c.id)} />
    </div>
  )
}
