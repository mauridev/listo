'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { requestRedemption } from '@/app/c/actions'

/**
 * La tienda del hijo, con un solo dueño (spec 0011 R5).
 *
 * Antes vivía adentro de `CheckinExperience` y solo se llegaba terminando el
 * check-in. Ahora también se entra directo por `/c/[pin]/tienda` — sobre todo
 * los días sin tareas, donde el check-in no tiene nada que preguntar y la
 * pantalla del hijo quedaba sin salida.
 *
 * El estado vive en `useKidStore` para que quien la monte lo tenga arriba: en
 * el check-in eso hace que el "✓ Pedido" sobreviva ir y volver entre `done` y
 * `store`.
 */

export type CatalogItem = { id: string; title: string; cost_points: number }

export type Redemption = {
  id: string
  status: 'pending' | 'approved' | 'rejected'
  rewards_catalog?: { title: string; cost_points: number } | null
}

export function useKidStore({
  pin,
  initialBalance,
  initialRedemptions,
}: {
  pin: string
  initialBalance: number
  initialRedemptions: Redemption[]
}) {
  const router = useRouter()
  const [balance, setBalance] = useState(initialBalance)
  const [redemptions, setRedemptions] = useState<Redemption[]>(initialRedemptions)
  const [requesting, setRequesting] = useState<string | null>(null)
  const [requestedIds, setRequestedIds] = useState<Set<string>>(new Set())
  const [error, setError] = useState('')

  async function request(item: CatalogItem) {
    if (requesting || requestedIds.has(item.id)) return
    setRequesting(item.id)

    // Spec 0008 (H2): el saldo lo valida el servidor y el canje nace 'pending'.
    // El chequeo de `canAfford` de la UI es solo UX.
    const result = await requestRedemption(item.id)

    if (result.status === 'ok' || result.status === 'already_requested') {
      setRedemptions(prev => [
        ...prev,
        { id: `pending-${item.id}`, status: 'pending', rewards_catalog: { title: item.title, cost_points: item.cost_points } },
      ])
      setRequestedIds(prev => new Set([...prev, item.id]))
    } else if (result.status === 'insufficient_points') {
      setBalance(result.balance)
      setError('Te faltan puntos para ese premio.')
    } else if (result.status === 'no_session') {
      router.push(`/c/${pin}`)
      return
    } else {
      setError('No pudimos pedir el premio. Probá de nuevo.')
    }

    setRequesting(null)
  }

  return { balance, setBalance, redemptions, requesting, requestedIds, error, request }
}

export type KidStoreState = ReturnType<typeof useKidStore>

export function KidStore({
  store,
  catalog,
  onBack,
}: {
  store: KidStoreState
  catalog: CatalogItem[]
  onBack: () => void
}) {
  const { balance, redemptions, requesting, requestedIds, error } = store

  return (
    <div className="flex flex-col w-full flex-1 p-6 gap-5">
      <div className="flex items-center gap-3">
        {/* Entrando directo (spec 0011) esta flecha es la única salida, y la
            aprieta un chico de 6 años: tiene que ser un botón de verdad, no un
            carácter de 14px. */}
        <button
          onClick={onBack}
          aria-label="Volver"
          className="w-9 h-9 -ml-1 rounded-full flex items-center justify-center text-lg flex-shrink-0"
          style={{ background: 'var(--surf2)', color: 'var(--t2)' }}
        >
          ←
        </button>
        <h1 className="flex-1 text-xl font-bold">Tienda</h1>
        <span className="text-sm font-semibold px-3 py-1 rounded-full" style={{ background: 'rgba(124,58,237,0.12)', color: 'var(--ac)' }}>⭐ {balance} pts</span>
      </div>

      {catalog.length === 0 ? (
        <p className="text-sm text-center py-8" style={{ color: 'var(--t3)' }}>La tienda está vacía por ahora.</p>
      ) : (
        <div className="space-y-3">
          {catalog.map(item => {
            const canAfford = balance >= item.cost_points
            const requested = requestedIds.has(item.id)
            return (
              <div key={item.id} className="flex items-center gap-4 rounded-2xl p-4" style={{ background: 'var(--surf)', border: `1px solid ${requested ? 'rgba(124,58,237,0.4)' : 'var(--bdr)'}`, opacity: !canAfford && !requested ? 0.55 : 1 }}>
                <div className="flex-1">
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="text-xs font-semibold mt-0.5" style={{ color: 'var(--ac)' }}>{item.cost_points} pts</p>
                </div>
                <button
                  onClick={() => store.request(item)}
                  disabled={!canAfford || requested || requesting === item.id}
                  className="px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50"
                  style={{ background: requested ? 'rgba(34,197,94,0.15)' : canAfford ? 'var(--ac)' : 'var(--surf2)', color: requested ? '#22c55e' : canAfford ? '#fff' : 'var(--t3)', border: requested ? '1px solid rgba(34,197,94,0.3)' : 'none' }}
                >
                  {requested ? '✓ Pedido' : requesting === item.id ? '…' : canAfford ? 'Pedir' : 'Faltan pts'}
                </button>
              </div>
            )
          })}
        </div>
      )}

      {redemptions.filter(r => r.status === 'approved').length > 0 && (
        <div className="mt-2">
          <p className="text-xs font-semibold uppercase tracking-widest mb-3" style={{ color: 'var(--t3)' }}>Canjes aprobados</p>
          <div className="space-y-2">
            {redemptions.filter(r => r.status === 'approved').map(r => (
              <div key={r.id} className="flex items-center gap-3 rounded-xl px-4 py-3" style={{ background: 'rgba(34,197,94,0.07)', border: '1px solid rgba(34,197,94,0.2)' }}>
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="8" fill="rgba(34,197,94,0.2)"/><polyline points="4 8 7 11 12 5" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                <p className="text-sm flex-1">{r.rewards_catalog?.title}</p>
                <p className="text-xs font-semibold" style={{ color: '#22c55e' }}>Aprobado</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-center" style={{ color: '#ef4444' }}>{error}</p>
      )}

      <p className="text-xs text-center" style={{ color: 'var(--t3)' }}>Tu papá/mamá aprueba los canjes</p>
    </div>
  )
}

/**
 * La tienda como pantalla propia (`/c/[pin]/tienda`).
 *
 * Mismo contenedor que `CheckinExperience` para que se vea igual, y el ← vuelve
 * a la pantalla principal del hijo en vez de a un check-in vacío (spec 0011 R3).
 */
export function KidStoreScreen({
  pin,
  initialBalance,
  initialCatalog,
  initialRedemptions,
}: {
  pin: string
  initialBalance: number
  initialCatalog: CatalogItem[]
  initialRedemptions: Redemption[]
}) {
  const router = useRouter()
  const store = useKidStore({ pin, initialBalance, initialRedemptions })

  return (
    <div className="min-h-screen flex flex-col items-center" style={{ background: 'var(--bg)', maxWidth: 400, margin: '0 auto' }}>
      <KidStore store={store} catalog={initialCatalog} onBack={() => router.push(`/c/${pin}`)} />
    </div>
  )
}
