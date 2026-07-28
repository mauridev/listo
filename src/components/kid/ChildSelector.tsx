'use client'

import { useRouter } from 'next/navigation'

type KidChild = { id: string; name: string; avatar_color: string }

export function ChildSelector({
  familyId,
  children,
  pin,
}: {
  familyId: string
  children: KidChild[]
  pin: string
}) {
  const router = useRouter()

  function selectChild(child: KidChild) {
    // Store child info in sessionStorage (no server-side kid auth)
    sessionStorage.setItem('listo_child', JSON.stringify({ ...child, familyId, pin }))
    router.push(`/c/${pin}/checkin`)
  }

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: 'var(--bg)' }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2 mb-12">
        <div className="w-3 h-3 rounded-full" style={{ background: 'var(--ac)', boxShadow: '0 0 12px var(--ac-glow)' }} />
        <span className="text-xl font-bold tracking-tight">Listo</span>
      </div>

      <h1 className="text-2xl font-bold mb-2 text-center">¿Quién sos?</h1>
      <p className="text-sm text-center mb-10" style={{ color: 'var(--t2)' }}>
        Elegí tu perfil para empezar
      </p>

      <div className="flex flex-wrap justify-center gap-4 max-w-xs">
        {children.map(child => (
          <button
            key={child.id}
            onClick={() => selectChild(child)}
            className="flex flex-col items-center gap-3 p-4 rounded-2xl transition-all hover:scale-105 active:scale-95"
            style={{ background: 'var(--surf)', border: '1px solid var(--bdr)', minWidth: 100 }}
          >
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold"
              style={{ background: child.avatar_color, color: '#fff' }}
            >
              {child.name[0].toUpperCase()}
            </div>
            <span className="font-semibold text-sm">{child.name}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
