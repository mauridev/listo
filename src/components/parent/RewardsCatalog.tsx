'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
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

  async function approveRedemption(id: string) {
    const redemption = redemptions.find(r => r.id === id)
    const supabase = createClient()
    await supabase.from('reward_redemptions').update({ status: 'approved' }).eq('id', id)
    if (redemption?.rewards_catalog) {
      await supabase.from('point_transactions').insert({
        child_id: redemption.child_id,
        delta: -redemption.rewards_catalog.cost_points,
        reason: `Canje: ${redemption.rewards_catalog.title}`,
      })
    }
    setRedemptions(prev => prev.map(r => r.id === id ? { ...r, status: 'approved' as const } : r))
  }

  async function rejectRedemption(id: string) {
    const supabase = createClient()
    await supabase.from('reward_redemptions').update({ status: 'rejected' }).eq('id', id)
    setRedemptions(prev => prev.map(r => r.id === id ? { ...r, status: 'rejected' as const } : r))
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
          <div className="space-y-2">
            {pending.map(r => (
              <div key={r.id} className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.25)' }}>
                <div className="flex-1">
                  <p className="text-sm font-medium">{r.rewards_catalog?.title}</p>
                  <p className="text-xs" style={{ color: 'var(--t3)' }}>{r.rewards_catalog?.cost_points} pts</p>
                </div>
                <button onClick={() => approveRedemption(r.id)} className="text-xs px-3 py-1.5 rounded-lg font-semibold" style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}>
                  ✓ Dar
                </button>
                <button onClick={() => rejectRedemption(r.id)} className="text-xs px-3 py-1.5 rounded-lg" style={{ background: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)' }}>
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
