'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
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
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: 'var(--bg)' }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex items-center gap-2 justify-center mb-10">
          <div className="w-3 h-3 rounded-full" style={{ background: 'var(--ac)', boxShadow: '0 0 12px var(--ac-glow)' }} />
          <span className="text-xl font-bold tracking-tight">Listo</span>
        </div>

        <h1 className="text-2xl font-bold text-center mb-1">Bienvenido de vuelta</h1>
        <p className="text-center text-sm mb-8" style={{ color: 'var(--t2)' }}>
          Panel de familia
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--t2)' }}>
              Email
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm outline-none transition-colors"
              style={{
                background: 'var(--surf)',
                border: '1px solid var(--bdr2)',
                color: 'var(--t1)',
              }}
              placeholder="tu@email.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--t2)' }}>
              Contraseña
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full rounded-xl px-4 py-3 text-sm outline-none"
              style={{
                background: 'var(--surf)',
                border: '1px solid var(--bdr2)',
                color: 'var(--t1)',
              }}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 text-center">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl font-semibold text-sm transition-opacity disabled:opacity-50"
            style={{ background: 'var(--ac)', color: '#fff' }}
          >
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-sm mt-6" style={{ color: 'var(--t3)' }}>
          ¿Primera vez?{' '}
          <Link href="/registro" className="font-medium" style={{ color: 'var(--ac)' }}>
            Creá tu cuenta
          </Link>
        </p>
      </div>
    </div>
  )
}
