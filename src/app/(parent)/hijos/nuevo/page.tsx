'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

const COLORS = ['#7C3AED', '#2563EB', '#16A34A', '#DC2626', '#D97706', '#0891B2', '#BE185D']

export default function NuevoHijoPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [color, setColor] = useState('#7C3AED')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function generatePin(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
    return Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setLoading(true)

    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const { data: family } = await supabase
      .from('families')
      .select('id')
      .eq('parent_id', user.id)
      .single()

    if (!family) { setError('Error cargando la familia'); setLoading(false); return }

    const { data: child, error: childError } = await supabase
      .from('children')
      .insert({ family_id: family.id, name: name.trim(), avatar_color: color, child_pin: generatePin() })
      .select()
      .single()

    if (childError || !child) { setError(childError?.message ?? 'Error'); setLoading(false); return }

    router.push(`/hijos/${child.id}`)
  }

  return (
    <div className="max-w-sm mx-auto">
      <div className="flex items-center gap-3 mb-8">
        <Link href="/dashboard" className="text-sm" style={{ color: 'var(--t3)' }}>← Volver</Link>
        <h1 className="text-xl font-bold">Nuevo hijo</h1>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Preview avatar */}
        <div className="flex justify-center">
          <div
            className="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold"
            style={{ background: color, color: '#fff' }}
          >
            {name ? name[0].toUpperCase() : '?'}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--t2)' }}>Nombre</label>
          <input
            type="text" required value={name}
            onChange={e => setName(e.target.value)}
            className="w-full rounded-xl px-4 py-3 text-sm outline-none"
            style={{ background: 'var(--surf)', border: '1px solid var(--bdr2)', color: 'var(--t1)' }}
            placeholder="Nombre del hijo"
            autoFocus
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-3" style={{ color: 'var(--t2)' }}>Color del avatar</label>
          <div className="flex gap-3 flex-wrap">
            {COLORS.map(c => (
              <button
                key={c} type="button"
                onClick={() => setColor(c)}
                className="w-8 h-8 rounded-full transition-transform"
                style={{
                  background: c,
                  transform: color === c ? 'scale(1.25)' : 'scale(1)',
                  outline: color === c ? `2px solid ${c}` : 'none',
                  outlineOffset: '2px',
                }}
              />
            ))}
          </div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          type="submit" disabled={loading || !name.trim()}
          className="w-full py-3 rounded-xl font-semibold text-sm disabled:opacity-40"
          style={{ background: 'var(--ac)', color: '#fff' }}
        >
          {loading ? 'Creando…' : 'Crear perfil'}
        </button>
      </form>
    </div>
  )
}
