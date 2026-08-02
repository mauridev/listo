'use client'

import { useState, useRef, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import GoogleButton from '@/components/ui/GoogleButton'

const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  no_code: 'No se pudo completar el login con Google. Probá de nuevo.',
  auth_failed: 'No se pudo verificar la cuenta de Google. Probá de nuevo o entrá con tu contraseña.',
}

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [googleLoading, setGoogleLoading] = useState(false)

  // Kid PIN flow
  const [showPin, setShowPin] = useState(false)
  const [pin, setPin] = useState('')
  const pinRef = useRef<HTMLInputElement>(null)

  // Errores que vuelven redirigidos desde /auth/callback (spec 0012 R3)
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('error')
    if (code && OAUTH_ERROR_MESSAGES[code]) setError(OAUTH_ERROR_MESSAGES[code])
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/dashboard')
    router.refresh()
  }

  async function handleGoogle() {
    setError('')
    setGoogleLoading(true)
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback?next=/dashboard` },
    })
    if (error) { setError(error.message); setGoogleLoading(false) }
  }

  function handlePinSubmit(e: React.FormEvent) {
    e.preventDefault()
    const clean = pin.trim().toUpperCase()
    if (clean.length === 6) router.push(`/c/${clean}`)
  }

  function openPin() {
    setShowPin(true)
    setTimeout(() => pinRef.current?.focus(), 50)
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex items-center gap-2 justify-center mb-10">
          <div className="w-3 h-3 rounded-full" style={{ background: 'var(--ac)', boxShadow: '0 0 12px var(--ac-glow)' }} />
          <span className="text-xl font-bold tracking-tight">Listo</span>
        </div>

        {/* ── Kid PIN mode ── */}
        {showPin ? (
          <div>
            <button onClick={() => { setShowPin(false); setPin('') }} className="text-sm mb-6 block" style={{ color: 'var(--t3)' }}>
              ← Volver
            </button>
            <h1 className="text-2xl font-bold text-center mb-1">Soy hijo</h1>
            <p className="text-center text-sm mb-8" style={{ color: 'var(--t2)' }}>
              Ingresá tu código personal
            </p>
            <form onSubmit={handlePinSubmit} className="space-y-4">
              <input
                ref={pinRef}
                type="text"
                value={pin}
                onChange={e => setPin(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                className="w-full rounded-xl px-4 py-4 text-center text-3xl font-bold tracking-[0.4em] outline-none uppercase"
                style={{ background: 'var(--surf)', border: `1px solid ${pin.length === 6 ? 'var(--ac)' : 'var(--bdr2)'}`, color: 'var(--ac)', letterSpacing: '0.4em' }}
                placeholder="——————"
                maxLength={6}
                autoComplete="off"
              />
              <button
                type="submit"
                disabled={pin.length !== 6}
                className="w-full py-3.5 rounded-xl font-bold text-sm disabled:opacity-30 transition-opacity"
                style={{ background: 'var(--ac)', color: '#fff' }}
              >
                Entrar →
              </button>
            </form>
          </div>
        ) : (
          /* ── Parent login mode ── */
          <>
            <h1 className="text-2xl font-bold text-center mb-1">Bienvenido de vuelta</h1>
            <p className="text-center text-sm mb-8" style={{ color: 'var(--t2)' }}>Panel de familia</p>

            <GoogleButton onClick={handleGoogle} loading={googleLoading} />

            <div className="flex items-center gap-3 my-5">
              <div className="flex-1 h-px" style={{ background: 'var(--bdr)' }} />
              <span className="text-xs" style={{ color: 'var(--t3)' }}>o con tu email</span>
              <div className="flex-1 h-px" style={{ background: 'var(--bdr)' }} />
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--t2)' }}>Email</label>
                <input
                  type="email" required value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                  style={{ background: 'var(--surf)', border: '1px solid var(--bdr2)', color: 'var(--t1)' }}
                  placeholder="tu@email.com"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--t2)' }}>Contraseña</label>
                <input
                  type="password" required value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full rounded-xl px-4 py-3 text-sm outline-none"
                  style={{ background: 'var(--surf)', border: '1px solid var(--bdr2)', color: 'var(--t1)' }}
                  placeholder="••••••••"
                />
              </div>
              {error && <p className="text-sm text-red-400 text-center">{error}</p>}
              <button
                type="submit" disabled={loading}
                className="w-full py-3 rounded-xl font-semibold text-sm disabled:opacity-50"
                style={{ background: 'var(--ac)', color: '#fff' }}
              >
                {loading ? 'Entrando…' : 'Entrar'}
              </button>
            </form>

            <p className="text-center text-sm mt-6" style={{ color: 'var(--t3)' }}>
              ¿Primera vez?{' '}
              <Link href="/registro" className="font-medium" style={{ color: 'var(--ac)' }}>Creá tu cuenta</Link>
            </p>

            {/* Kid entry */}
            <div className="mt-8 pt-6" style={{ borderTop: '1px solid var(--bdr)' }}>
              <button
                onClick={openPin}
                className="w-full py-3 rounded-xl text-sm font-semibold transition-opacity hover:opacity-70"
                style={{ background: 'var(--surf)', border: '1px solid var(--bdr2)', color: 'var(--t2)' }}
              >
                Soy hijo — ingresar con mi código
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
