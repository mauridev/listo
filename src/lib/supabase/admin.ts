import 'server-only'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'

/**
 * Cliente con la SECRET KEY de Supabase. Bypassea RLS por completo.
 *
 * Spec 0008: el hijo no tiene cuenta, así que su acceso no puede depender del
 * rol `anon` (cualquiera tiene esa key: está en el bundle del browser). Todo el
 * flujo del hijo pasa por acá, del lado servidor, donde conocemos la IP y
 * podemos rate-limitear. Las RPC `kid_*` solo tienen GRANT para `service_role`.
 *
 * NUNCA importar esto desde un componente cliente. `server-only` hace que el
 * build falle si alguien lo intenta, en lugar de filtrar la key en silencio.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const secretKey = process.env.SUPABASE_SECRET_KEY

  if (!url) throw new Error('NEXT_PUBLIC_SUPABASE_URL no está configurada')
  if (!secretKey) {
    throw new Error(
      'SUPABASE_SECRET_KEY no está configurada. El flujo del hijo la necesita ' +
      '(ver supabase/migrations/0001_security_hardening.sql).'
    )
  }

  return createSupabaseClient(url, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  })
}
