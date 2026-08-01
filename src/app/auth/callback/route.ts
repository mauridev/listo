import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextRequest, NextResponse } from 'next/server'
import { generatePin } from '@/lib/pin'
import { safeNext } from '@/lib/safe-redirect'

const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  ''

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')
  const next = safeNext(searchParams.get('next'))

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=no_code', request.url))
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    supabaseKey,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user }, error } = await supabase.auth.exchangeCodeForSession(code)

  if (error || !user) {
    return NextResponse.redirect(new URL('/login?error=auth_failed', request.url))
  }

  // Crear la familia si todavía no existe. PIN con CSPRNG (spec 0008 H3).
  const { data: existing } = await supabase
    .from('families')
    .select('id')
    .eq('parent_id', user.id)
    .maybeSingle()

  if (!existing) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const { error: familyError } = await supabase
        .from('families')
        .insert({ parent_id: user.id, family_pin: generatePin() })
      if (!familyError) break
      if (familyError.code !== '23505') {
        console.error('[auth] no se pudo crear la familia:', familyError.message)
        break
      }
    }
  }

  return NextResponse.redirect(new URL(next, request.url))
}
