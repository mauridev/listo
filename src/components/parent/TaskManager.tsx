'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

type Task = {
  id: string
  title: string
  recurrence: string
  active: boolean
  completed_today: boolean
}

type Child = {
  id: string
  name: string
  avatar_color: string
  tasks: Task[]
}

export function TaskManager({ child }: { child: Child }) {
  const router = useRouter()
  const [tasks, setTasks] = useState<Task[]>(child.tasks)
  const [newTitle, setNewTitle] = useState('')
  const [adding, setAdding] = useState(false)
  const [showForm, setShowForm] = useState(false)

  const activeTasks = tasks.filter(t => t.active)
  const completed = activeTasks.filter(t => t.completed_today).length

  async function addTask(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim()) return
    setAdding(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('tasks')
      .insert({ child_id: child.id, title: newTitle.trim(), recurrence: 'daily' })
      .select()
      .single()
    if (!error && data) {
      setTasks(prev => [...prev, { ...data, completed_today: false }])
      setNewTitle('')
      setShowForm(false)
    }
    setAdding(false)
  }

  async function toggleTask(taskId: string, active: boolean) {
    const supabase = createClient()
    await supabase.from('tasks').update({ active: !active }).eq('id', taskId)
    setTasks(prev => prev.map(t => t.id === taskId ? { ...t, active: !t.active } : t))
  }

  async function deleteTask(taskId: string) {
    const supabase = createClient()
    await supabase.from('tasks').delete().eq('id', taskId)
    setTasks(prev => prev.filter(t => t.id !== taskId))
  }

  return (
    <div className="max-w-sm mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/dashboard" className="text-sm" style={{ color: 'var(--t3)' }}>←</Link>
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-sm"
          style={{ background: child.avatar_color }}
        >
          {child.name[0].toUpperCase()}
        </div>
        <div>
          <h1 className="font-bold">{child.name}</h1>
          <p className="text-xs" style={{ color: 'var(--t3)' }}>{completed}/{activeTasks.length} hoy</p>
        </div>
      </div>

      {/* Progress */}
      {activeTasks.length > 0 && (
        <div className="h-1.5 rounded-full overflow-hidden mb-6" style={{ background: 'var(--surf2)' }}>
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${activeTasks.length ? (completed / activeTasks.length) * 100 : 0}%`, background: 'var(--ac)' }}
          />
        </div>
      )}

      {/* Tasks */}
      <div className="space-y-2 mb-6">
        {tasks.length === 0 && (
          <p className="text-sm text-center py-6" style={{ color: 'var(--t3)' }}>
            No hay tareas. Agregá la primera.
          </p>
        )}
        {tasks.map(task => (
          <div
            key={task.id}
            className="flex items-center gap-3 rounded-xl px-4 py-3"
            style={{
              background: 'var(--surf)',
              border: '1px solid var(--bdr)',
              opacity: task.active ? 1 : 0.4,
            }}
          >
            {/* Completion indicator */}
            <div
              className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0"
              style={{
                background: task.completed_today ? 'rgba(34,197,94,0.15)' : 'var(--surf2)',
                border: `1px solid ${task.completed_today ? '#22c55e' : 'var(--bdr2)'}`,
              }}
            >
              {task.completed_today && (
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <polyline points="1.5 5 4 7.5 8.5 2.5" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </div>

            <span className="flex-1 text-sm">{task.title}</span>

            {/* Toggle active */}
            <button
              onClick={() => toggleTask(task.id, task.active)}
              className="text-xs px-2 py-0.5 rounded"
              style={{ color: 'var(--t3)', border: '1px solid var(--bdr)' }}
            >
              {task.active ? 'Pausar' : 'Activar'}
            </button>

            {/* Delete */}
            <button
              onClick={() => deleteTask(task.id)}
              className="text-red-400/60 hover:text-red-400 transition-colors text-xs ml-1"
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Add task form */}
      {showForm ? (
        <form onSubmit={addTask} className="space-y-3">
          <input
            type="text" value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            className="w-full rounded-xl px-4 py-3 text-sm outline-none"
            style={{ background: 'var(--surf)', border: '1px solid var(--ac)', color: 'var(--t1)' }}
            placeholder="Nombre de la tarea"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              type="submit" disabled={adding || !newTitle.trim()}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40"
              style={{ background: 'var(--ac)', color: '#fff' }}
            >
              {adding ? 'Guardando…' : 'Guardar'}
            </button>
            <button
              type="button" onClick={() => { setShowForm(false); setNewTitle('') }}
              className="px-4 py-2.5 rounded-xl text-sm"
              style={{ background: 'var(--surf2)', color: 'var(--t2)' }}
            >
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-3 rounded-xl text-sm font-medium"
          style={{ background: 'var(--surf)', border: '1px dashed var(--bdr2)', color: 'var(--ac)' }}
        >
          + Agregar tarea
        </button>
      )}
    </div>
  )
}
