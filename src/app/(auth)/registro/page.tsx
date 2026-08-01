'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ensureFamily } from '@/app/(auth)/actions'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function RegistroPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const supabase = createClient()

    const { data: { user, session }, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (signUpError || !user) {
      setError(signUpError?.message ?? 'Error al crear la cuenta')
      setLoading(false)
      return
    }

    if (session) {
      // Sin confirmación de email: la sesión ya está activa. La familia (y su
      // PIN con CSPRNG) la crea el servidor — spec 0008 H3.
      const result = await ensureFamily()
      if (!result.ok) {
        setError(result.message ?? 'No se pudo crear la familia')
        setLoading(false)
        return
      }
      router.push('/dashboard')
      router.refresh()
    } else {
      // Email confirmation enabled — family is created in /auth/callback
      setLoading(false)
      setError('¡Cuenta creada! Revisá tu email y hacé click en el link de confirmación para entrar.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-2 justify-center mb-10">
          <div className="w-3 h-3 rounded-full" style={{ background: 'var(--ac)', boxShadow: '0 0 12px var(--ac-glow)' }} />
          <span className="text-xl font-bold tracking-tight">Listo</span>
        </div>

        <h1 className="text-2xl font-bold text-center mb-1">Creá tu familia</h1>
        <p className="text-center text-sm mb-8" style={{ color: 'var(--t2)' }}>
          Tu cuenta de padre/madre
        </p>

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
              type="password" required minLength={8} value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm outline-none"
              style={{ background: 'var(--surf)', border: '1px solid var(--bdr2)', color: 'var(--t1)' }}
              placeholder="Mínimo 8 caracteres"
            />
          </div>

          {error && <p className="text-sm text-red-400 text-center">{error}</p>}

          <button
            type="submit" disabled={loading}
            className="w-full py-3 rounded-xl font-semibold text-sm transition-opacity disabled:opacity-50"
            style={{ background: 'var(--ac)', color: '#fff' }}
          >
            {loading ? 'Creando cuenta…' : 'Crear cuenta'}
          </button>
        </form>

        <p className="text-center text-sm mt-6" style={{ color: 'var(--t3)' }}>
          ¿Ya tenés cuenta?{' '}
          <Link href="/login" className="font-medium" style={{ color: 'var(--ac)' }}>
            Entrá acá
          </Link>
        </p>
      </div>
    </div>
  )
}
