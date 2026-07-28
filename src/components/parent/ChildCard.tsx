'use client'

import Link from 'next/link'
import type { ChildWithProgress } from '@/types'

export function ChildCard({ child }: { child: ChildWithProgress }) {
  const pct = child.total_tasks > 0
    ? Math.round((child.completed_tasks / child.total_tasks) * 100)
    : 0

  return (
    <Link
      href={`/hijos/${child.id}`}
      className="block rounded-2xl p-4 transition-colors hover:border-purple-500/30"
      style={{ background: 'var(--surf)', border: '1px solid var(--bdr)' }}
    >
      <div className="flex items-center gap-3 mb-3">
        {/* Avatar */}
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-base font-bold flex-shrink-0"
          style={{ background: child.avatar_color, color: '#fff' }}
        >
          {child.name[0].toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold">{child.name}</span>
            {child.all_done && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e' }}>
                ¡Listo!
              </span>
            )}
            {!child.all_done && child.completed_tasks > 0 && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: 'rgba(234,179,8,0.15)', color: '#eab308' }}>
                En proceso
              </span>
            )}
          </div>
          <p className="text-xs mt-0.5" style={{ color: 'var(--t3)' }}>
            {child.completed_tasks} / {child.total_tasks} tareas
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--surf2)' }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${pct}%`,
            background: child.all_done ? '#22c55e' : 'var(--ac)',
          }}
        />
      </div>

      {/* Tasks list */}
      {child.tasks.length > 0 && (
        <div className="mt-3 space-y-1.5">
          {child.tasks.map(task => (
            <div key={task.id} className="flex items-center gap-2 text-sm">
              <div
                className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0"
                style={{
                  background: task.completed_today ? 'rgba(34,197,94,0.15)' : 'var(--surf2)',
                  border: `1px solid ${task.completed_today ? '#22c55e' : 'var(--bdr2)'}`,
                }}
              >
                {task.completed_today && (
                  <svg width="8" height="8" viewBox="0 0 10 10" fill="none">
                    <polyline points="1.5 5 4 7.5 8.5 2.5" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <span style={{ color: task.completed_today ? 'var(--t2)' : 'var(--t1)' }}>
                {task.title}
              </span>
            </div>
          ))}
        </div>
      )}
    </Link>
  )
}
