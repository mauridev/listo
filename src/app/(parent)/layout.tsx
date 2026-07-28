import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg)' }}>
      {/* Header */}
      <header className="border-b sticky top-0 z-10 backdrop-blur-sm" style={{ borderColor: 'var(--bdr)', background: 'rgba(10,10,10,0.85)' }}>
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: 'var(--ac)', boxShadow: '0 0 8px var(--ac-glow)' }} />
            <span className="font-bold text-base tracking-tight">Listo</span>
          </Link>
          <form action="/api/auth/logout" method="post">
            <button type="submit" className="text-xs px-3 py-1.5 rounded-lg transition-colors hover:opacity-70" style={{ color: 'var(--t3)', border: '1px solid var(--bdr)' }}>
              Salir
            </button>
          </form>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  )
}
