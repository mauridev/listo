'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { resolveRedemption } from '@/app/(parent)/actions'
import type { RewardCatalogItem, RewardRedemption } from '@/types'

export function RewardsCatalog({
  childId,
  initialCatalog,
  initialRedemptions,
}: {
  childId: string
  initialCatalog: RewardCatalogItem[]
  initialRedemptions: RewardRedemption[]
}) {
  const [catalog, setCatalog] = useState(initialCatalog)
  const [redemptions, setRedemptions] = useState(initialRedemptions)
  const [showForm, setShowForm] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newCost, setNewCost] = useState(50)
  const [saving, setSaving] = useState(false)
  const [resolving, setResolving] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function addReward(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim()) return
    setSaving(true)
    const supabase = createClient()
    const { data, error } = await supabase
      .from('rewards_catalog')
      .insert({ child_id: childId, title: newTitle.trim(), cost_points: newCost })
      .select().single()
    if (!error && data) {
      setCatalog(prev => [...prev, data])
      setNewTitle('')
      setNewCost(50)
      setShowForm(false)
    }
    setSaving(false)
  }

  async function deleteReward(id: string) {
    const supabase = createClient()
    await supabase.from('rewards_catalog').delete().eq('id', id)
    setCatalog(prev => prev.filter(r => r.id !== id))
  }

  /**
   * Spec 0008 (M5): antes esto hacía el UPDATE y el descuento desde el cliente,
   * con el costo tomado del estado local — así que un doble click descontaba dos
   * veces. Ahora lo resuelve una RPC que solo actúa si el canje estaba
   * 'pending' y lee el costo de la DB.
   */
  async function resolve(id: string, approve: boolean) {
    if (resolving) return
    setResolving(id)
    setError('')

    const result = await resolveRedemption(id, approve)

    if (result.status === 'ok') {
      const status = result.resolution
      setRedemptions(prev => prev.map(r => (r.id === id ? { ...r, status } : r)))
    } else if (result.status === 'already_resolved') {
      // Otra pestaña lo resolvió: sacarlo de pendientes sin inventar el estado
      setRedemptions(prev => prev.filter(r => r.id !== id))
    } else if (result.status === 'insufficient_points') {
      setError(`No alcanzan los puntos: tiene ${result.balance}, necesita ${result.needed}.`)
    } else {
      setError('No se pudo resolver el canje. Probá de nuevo.')
    }

    setResolving(null)
  }

  const pending = redemptions.filter(r => r.status === 'pending')

  return (
    <div className="mt-8">
      {/* Pending redemptions */}
      {pending.length > 0 && (
        <div className="mb-6">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--ac)' }}>
            🔔 Canjes pendientes
          </p>
          {error && <p className="text-sm mb-2" style={{ color: '#ef4444' }}>{error}</p>}
          <div className="space-y-2">
            {pending.map(r => (
              <div key={r.id} className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.25)' }}>
                <div className="flex-1">
                  <p className="text-sm font-medium">{r.rewards_catalog?.title}</p>
                  <p className="text-xs" style={{ color: 'var(--t3)' }}>{r.rewards_catalog?.cost_points} pts</p>
                </div>
                <button onClick={() => resolve(r.id, true)} disabled={resolving === r.id} className="text-xs px-3 py-1.5 rounded-lg font-semibold disabled:opacity-40" style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}>
                  {resolving === r.id ? '…' : '✓ Dar'}
                </button>
                <button onClick={() => resolve(r.id, false)} disabled={resolving === r.id} className="text-xs px-3 py-1.5 rounded-lg disabled:opacity-40" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
                  ✕
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Catalog */}
      <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--t3)' }}>
        🏆 Tienda de recompensas
      </p>

      <div className="space-y-2 mb-4">
        {catalog.length === 0 && (
          <p className="text-sm text-center py-4" style={{ color: 'var(--t3)' }}>Sin recompensas. El hijo verá la tienda vacía.</p>
        )}
        {catalog.map(r => (
          <div key={r.id} className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: 'var(--surf)', border: '1px solid var(--bdr)' }}>
            <div className="flex-1">
              <p className="text-sm">{r.title}</p>
              <p className="text-xs font-semibold" style={{ color: 'var(--ac)' }}>{r.cost_points} pts</p>
            </div>
            <button onClick={() => deleteReward(r.id)} className="text-red-400/60 hover:text-red-400 text-xs">✕</button>
          </div>
        ))}
      </div>

      {showForm ? (
        <form onSubmit={addReward} className="space-y-2">
          <input
            value={newTitle} onChange={e => setNewTitle(e.target.value)}
            className="w-full rounded-xl px-4 py-3 text-sm outline-none"
            style={{ background: 'var(--surf)', border: '1px solid var(--ac)', color: 'var(--t1)' }}
            placeholder="Ej: Elegís la cena del viernes"
            autoFocus
          />
          <div className="flex items-center gap-2">
            <label className="text-xs" style={{ color: 'var(--t2)' }}>Costo en puntos:</label>
            <input
              type="number" min={1} value={newCost} onChange={e => setNewCost(Number(e.target.value))}
              className="w-20 rounded-lg px-3 py-2 text-sm outline-none text-center"
              style={{ background: 'var(--surf)', border: '1px solid var(--bdr2)', color: 'var(--t1)' }}
            />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving || !newTitle.trim()} className="flex-1 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40" style={{ background: 'var(--ac)', color: '#fff' }}>
              {saving ? 'Guardando…' : 'Agregar'}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setNewTitle('') }} className="px-4 py-2.5 rounded-xl text-sm" style={{ background: 'var(--surf2)', color: 'var(--t2)' }}>
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <button onClick={() => setShowForm(true)} className="w-full py-3 rounded-xl text-sm font-medium" style={{ background: 'var(--surf)', border: '1px dashed var(--bdr2)', color: 'var(--ac)' }}>
          + Agregar recompensa
        </button>
      )}
    </div>
  )
}
