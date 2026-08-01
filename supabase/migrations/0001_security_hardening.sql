-- =====================================================================
-- LISTO — Migración 0001: hardening de seguridad
-- Spec: products/listo/specs/0008-seguridad-listo.md (cerebro Latente)
-- =====================================================================
--
-- QUÉ ARREGLA
--   C1  anon_insert_points WITH CHECK (true) + delta del cliente
--       => cualquiera acuñaba puntos infinitos para cualquier hijo
--   C2  anon_read_points/catalog/redemptions USING (true)
--       => el ledger de TODAS las familias era legible sin auth
--   H1  identidad del hijo desde sessionStorage sin verificación
--   H2  canje auto-aprobable + saldo validado solo en el cliente
--   H3  PINs con Math.random() (se rotan acá abajo)
--   H4  sin rate limiting en el lookup de PIN
--   M4  SECURITY DEFINER sin SET search_path
--   M5  débito de canje no idempotente y con costo del cliente
--
-- MODELO NUEVO
--   El rol `anon` pierde TODO acceso a las tablas del flujo del hijo.
--   El hijo no tiene cuenta, así que su acceso pasa por RPCs
--   SECURITY DEFINER llamadas SOLO desde el servidor de Next.js con la
--   secret key. Eso obliga a que todo el tráfico del hijo pase por
--   nuestra capa (donde conocemos la IP y podemos limitar), en lugar de
--   poder pegarle directo al REST de Postgres con la publishable key.
--
-- CÓMO CORRERLA
--   Supabase Dashboard → SQL Editor → pegar todo → Run.
--   Es idempotente: se puede correr más de una vez sin romper nada.
--   Mirá la salida de NOTICE al final: lista las políticas permisivas
--   que encontró y borró (eso también confirma qué había realmente en
--   producción, que el repo no reflejaba).
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 0. Nivelar el schema con producción (hallazgo M3: el repo derivó)
-- ---------------------------------------------------------------------

alter table public.children add column if not exists child_pin varchar(6);

create unique index if not exists children_child_pin_key
  on public.children (child_pin)
  where child_pin is not null;

-- ---------------------------------------------------------------------
-- 1. Generador de PIN criptográfico (H3)
-- ---------------------------------------------------------------------
-- gen_random_uuid() es core en PG13+ (no depende de pgcrypto) y usa un
-- CSPRNG. Tomamos los primeros 6 bytes, que en UUIDv4 son 100% aleatorios
-- (los bits fijos de versión/variante caen en los bytes 6 y 8).
-- 256 es múltiplo de 32, así que `& 31` es uniforme: sin sesgo de módulo.
-- Alfabeto sin I/O/0/1 para que un chico no confunda caracteres.

create or replace function public.gen_pin()
returns varchar(6)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  hexes    text;
  out_pin  text := '';
  byte_val int;
begin
  hexes := pg_catalog.replace(pg_catalog.gen_random_uuid()::text, '-', '');
  for i in 1..6 loop
    byte_val := ('x' || pg_catalog.substr(hexes, i * 2 - 1, 2))::bit(8)::int;
    out_pin := out_pin || pg_catalog.substr(alphabet, (byte_val & 31) + 1, 1);
  end loop;
  return out_pin;
end;
$$;

revoke all on function public.gen_pin() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 2. Borrar TODA política permisiva (C1, C2, H2)
-- ---------------------------------------------------------------------
-- No borramos por nombre: el schema del repo no coincide con producción,
-- así que puede haber políticas que no conocemos (ej. un SELECT anónimo
-- sobre `tasks`, que el flujo del hijo necesitaba y el repo no tiene).
-- Criterio preciso: cualquier política cuya condición sea literalmente
-- `true` permite algo sin restricción y se va. Las `parent_own_*` tienen
-- expresión real (auth.uid()) y por eso sobreviven.

do $$
declare
  pol record;
  dropped int := 0;
begin
  for pol in
    select tablename, policyname, cmd, qual, with_check
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'families', 'children', 'tasks', 'task_completions',
        'point_transactions', 'rewards_catalog', 'reward_redemptions'
      )
      and (qual = 'true' or with_check = 'true')
  loop
    execute format('drop policy %I on public.%I', pol.policyname, pol.tablename);
    dropped := dropped + 1;
    raise notice 'BORRADA política permisiva: %.% (cmd=%, using=%, check=%)',
      pol.tablename, pol.policyname, pol.cmd,
      coalesce(pol.qual, '-'), coalesce(pol.with_check, '-');
  end loop;
  raise notice '--- Total de políticas permisivas borradas: % ---', dropped;
end;
$$;

-- RLS activo en todo (por si alguna tabla quedó sin habilitar)
alter table public.families           enable row level security;
alter table public.children           enable row level security;
alter table public.tasks              enable row level security;
alter table public.task_completions   enable row level security;
alter table public.point_transactions enable row level security;
alter table public.rewards_catalog    enable row level security;
alter table public.reward_redemptions enable row level security;

-- ---------------------------------------------------------------------
-- 3. Quitarle al rol anónimo todo acceso directo a las tablas
-- ---------------------------------------------------------------------
-- Cinturón y tirantes: aunque mañana alguien recree una política
-- permisiva por error, sin GRANT el rol anon no llega a la tabla.
-- `authenticated` conserva sus grants: ahí manda el RLS parent_own_*.

revoke all on public.families           from anon;
revoke all on public.children           from anon;
revoke all on public.tasks              from anon;
revoke all on public.task_completions   from anon;
revoke all on public.point_transactions from anon;
revoke all on public.rewards_catalog    from anon;
revoke all on public.reward_redemptions from anon;

-- ---------------------------------------------------------------------
-- 4. Falta de política de escritura para el padre (bug latente)
-- ---------------------------------------------------------------------
-- `parent_read_completions` es solo FOR SELECT y el INSERT anónimo que
-- lo acompañaba se acaba de borrar. Sin esto, el padre no podría escribir
-- completions nunca. Lo dejamos explícito y scopeado.

drop policy if exists "parent_write_completions" on public.task_completions;
create policy "parent_write_completions" on public.task_completions
  for all
  using (
    child_id in (
      select c.id from public.children c
      join public.families f on c.family_id = f.id
      where f.parent_id = auth.uid()
    )
  )
  with check (
    child_id in (
      select c.id from public.children c
      join public.families f on c.family_id = f.id
      where f.parent_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------
-- 5. Borrar las funciones viejas e inseguras
-- ---------------------------------------------------------------------
-- Se borran todos los overloads: en producción existe `get_child_by_pin`
-- (que el repo no tenía) con firma que no conocemos con certeza.

do $$
declare fn record;
begin
  for fn in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('get_family_by_pin', 'get_child_by_pin')
  loop
    execute format('drop function %s', fn.sig);
    raise notice 'BORRADA función insegura: %', fn.sig;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------
-- 6. Rate limiting del lookup de PIN (H4)
-- ---------------------------------------------------------------------

create table if not exists public.pin_attempts (
  id           bigserial primary key,
  ip           text        not null,
  succeeded    boolean     not null,
  attempted_at timestamptz not null default now()
);

create index if not exists pin_attempts_ip_time_idx
  on public.pin_attempts (ip, attempted_at desc);

alter table public.pin_attempts enable row level security;
revoke all on public.pin_attempts from anon, authenticated;
revoke all on sequence public.pin_attempts_id_seq from anon, authenticated;

-- ---------------------------------------------------------------------
-- 7. RPC: resolver PIN (único punto de entrada del hijo)
-- ---------------------------------------------------------------------
-- Devuelve jsonb con status: ok | not_found | rate_limited.
-- Nunca revela si un PIN existe cuando está limitado.

create or replace function public.kid_resolve_pin(p_pin text, p_ip text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  max_fails  constant int      := 10;
  window_len constant interval := interval '15 minutes';
  fails   int;
  v_child record;
begin
  if p_pin is null or pg_catalog.length(p_pin) <> 6 then
    return jsonb_build_object('status', 'not_found');
  end if;

  select count(*) into fails
  from public.pin_attempts a
  where a.ip = coalesce(p_ip, 'unknown')
    and a.succeeded = false
    and a.attempted_at > now() - window_len;

  if fails >= max_fails then
    return jsonb_build_object(
      'status', 'rate_limited',
      'retry_after_seconds', 900
    );
  end if;

  select c.id, c.name, c.avatar_color, c.reward_text, c.family_id
    into v_child
  from public.children c
  where c.child_pin = pg_catalog.upper(p_pin)
  limit 1;

  insert into public.pin_attempts (ip, succeeded)
  values (coalesce(p_ip, 'unknown'), v_child.id is not null);

  -- Limpieza oportunista para que la tabla no crezca sin control
  delete from public.pin_attempts
  where attempted_at < now() - interval '24 hours';

  if v_child.id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  return jsonb_build_object(
    'status', 'ok',
    'child', jsonb_build_object(
      'id',           v_child.id,
      'name',         v_child.name,
      'avatar_color', v_child.avatar_color,
      'reward_text',  v_child.reward_text,
      'family_id',    v_child.family_id
    )
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 8. RPC: completar tarea (C1 — el delta lo decide el servidor)
-- ---------------------------------------------------------------------

create or replace function public.kid_complete_task(
  p_child_id uuid,
  p_task_id  uuid,
  p_date     date
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_task    record;
  v_dow     int;
  v_rows    int;
  v_balance int;
begin
  -- La tarea tiene que ser de ESTE chico y estar activa
  select t.id, t.title, t.points, t.recurrence, t.days
    into v_task
  from public.tasks t
  where t.id = p_task_id
    and t.child_id = p_child_id
    and t.active = true;

  if v_task.id is null then
    return jsonb_build_object('status', 'invalid_task');
  end if;

  -- Ventana de fechas: ±1 día de UTC cubre cualquier huso horario.
  -- Sin esto se podían backfillear 365 días y farmear puntos.
  if p_date < current_date - 1 or p_date > current_date + 1 then
    return jsonb_build_object('status', 'invalid_date');
  end if;

  -- La tarea tiene que aplicar realmente a esa fecha
  v_dow := extract(dow from p_date)::int;
  if not (
       v_task.recurrence = 'daily'
    or (v_task.recurrence = 'weekdays' and v_dow between 1 and 5)
    or (v_task.recurrence = 'weekend'  and v_dow in (0, 6))
    or (v_task.recurrence = 'custom'   and v_task.days is not null and v_dow = any(v_task.days))
  ) then
    return jsonb_build_object('status', 'not_scheduled');
  end if;

  -- UNIQUE(task_id, date) hace de candado: si ya estaba, no se premia dos veces
  insert into public.task_completions (task_id, child_id, date)
  values (p_task_id, p_child_id, p_date)
  on conflict (task_id, date) do nothing;

  get diagnostics v_rows = row_count;

  -- Los puntos salen de tasks.points leído de la DB, nunca del cliente
  if v_rows > 0 then
    insert into public.point_transactions (child_id, delta, reason)
    values (p_child_id, v_task.points, v_task.title);
  end if;

  select coalesce(sum(pt.delta), 0)::int into v_balance
  from public.point_transactions pt
  where pt.child_id = p_child_id;

  return jsonb_build_object(
    'status',  case when v_rows > 0 then 'ok' else 'already_done' end,
    'awarded', case when v_rows > 0 then v_task.points else 0 end,
    'balance', v_balance
  );
end;
$$;

-- ---------------------------------------------------------------------
-- 9. RPC: pedir canje (H2 — saldo validado en el servidor, siempre pending)
-- ---------------------------------------------------------------------

create or replace function public.kid_request_redemption(
  p_child_id  uuid,
  p_reward_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_reward  record;
  v_balance int;
  v_dupe    uuid;
begin
  select r.id, r.title, r.cost_points
    into v_reward
  from public.rewards_catalog r
  where r.id = p_reward_id
    and r.child_id = p_child_id
    and r.active = true;

  if v_reward.id is null then
    return jsonb_build_object('status', 'invalid_reward');
  end if;

  -- Idempotencia: un solo pedido pendiente por recompensa
  select rr.id into v_dupe
  from public.reward_redemptions rr
  where rr.child_id = p_child_id
    and rr.reward_id = p_reward_id
    and rr.status = 'pending'
  limit 1;

  if v_dupe is not null then
    return jsonb_build_object('status', 'already_requested');
  end if;

  select coalesce(sum(pt.delta), 0)::int into v_balance
  from public.point_transactions pt
  where pt.child_id = p_child_id;

  if v_balance < v_reward.cost_points then
    return jsonb_build_object(
      'status',  'insufficient_points',
      'balance', v_balance,
      'needed',  v_reward.cost_points
    );
  end if;

  -- status forzado a 'pending': el hijo no puede auto-aprobarse
  insert into public.reward_redemptions (child_id, reward_id, status)
  values (p_child_id, p_reward_id, 'pending');

  return jsonb_build_object('status', 'ok', 'balance', v_balance);
end;
$$;

-- ---------------------------------------------------------------------
-- 10. RPC: resolver canje del lado padre (M5 — idempotente, costo de la DB)
-- ---------------------------------------------------------------------

create or replace function public.parent_resolve_redemption(
  p_redemption_id uuid,
  p_approve       boolean
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_row     record;
  v_balance int;
  v_rows    int;
begin
  -- Solo el padre dueño del chico. auth.uid() viene del JWT del request.
  select rr.id, rr.child_id, rr.status, rc.title, rc.cost_points
    into v_row
  from public.reward_redemptions rr
  join public.rewards_catalog rc on rc.id = rr.reward_id
  join public.children c         on c.id = rr.child_id
  join public.families f         on f.id = c.family_id
  where rr.id = p_redemption_id
    and f.parent_id = auth.uid();

  if v_row.id is null then
    return jsonb_build_object('status', 'not_found');
  end if;

  -- Idempotente: doble click no descuenta dos veces
  if v_row.status <> 'pending' then
    return jsonb_build_object('status', 'already_resolved', 'current', v_row.status);
  end if;

  if not p_approve then
    update public.reward_redemptions
    set status = 'rejected'
    where id = p_redemption_id and status = 'pending';
    return jsonb_build_object('status', 'ok', 'resolution', 'rejected');
  end if;

  select coalesce(sum(pt.delta), 0)::int into v_balance
  from public.point_transactions pt
  where pt.child_id = v_row.child_id;

  if v_balance < v_row.cost_points then
    return jsonb_build_object(
      'status',  'insufficient_points',
      'balance', v_balance,
      'needed',  v_row.cost_points
    );
  end if;

  update public.reward_redemptions
  set status = 'approved'
  where id = p_redemption_id and status = 'pending';

  get diagnostics v_rows = row_count;
  if v_rows = 0 then
    -- Otra sesión lo resolvió entre el select y el update
    return jsonb_build_object('status', 'already_resolved');
  end if;

  -- El costo se lee de la DB, no del cliente
  insert into public.point_transactions (child_id, delta, reason)
  values (v_row.child_id, -v_row.cost_points, 'Canje: ' || v_row.title);

  return jsonb_build_object('status', 'ok', 'resolution', 'approved');
end;
$$;

-- ---------------------------------------------------------------------
-- 11. Balance (M4: search_path fijo; ya no es callable por anon)
-- ---------------------------------------------------------------------

create or replace function public.get_child_balance(p_child_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(pt.delta), 0)::int
  from public.point_transactions pt
  where pt.child_id = p_child_id;
$$;

-- ---------------------------------------------------------------------
-- 12. Permisos de ejecución (el candado que hace funcionar todo)
-- ---------------------------------------------------------------------
-- Las funciones del hijo son SOLO para service_role (la secret key del
-- servidor). Si quedaran ejecutables por anon, el rate limiting sería
-- esquivable pegándole directo al REST con la publishable key.

revoke all on function public.kid_resolve_pin(text, text)             from public, anon, authenticated;
revoke all on function public.kid_complete_task(uuid, uuid, date)     from public, anon, authenticated;
revoke all on function public.kid_request_redemption(uuid, uuid)      from public, anon, authenticated;
revoke all on function public.parent_resolve_redemption(uuid, boolean) from public, anon, authenticated;
revoke all on function public.get_child_balance(uuid)                 from public, anon, authenticated;

grant execute on function public.kid_resolve_pin(text, text)         to service_role;
grant execute on function public.kid_complete_task(uuid, uuid, date) to service_role;
grant execute on function public.kid_request_redemption(uuid, uuid)  to service_role;

-- El padre autenticado sí resuelve canjes y lee saldo desde el browser
grant execute on function public.parent_resolve_redemption(uuid, boolean) to authenticated, service_role;
grant execute on function public.get_child_balance(uuid)                  to authenticated, service_role;

-- ---------------------------------------------------------------------
-- 13. Rotar los PINs generados con Math.random() (H3)
-- ---------------------------------------------------------------------
-- Hoy es gratis: no hay familias reales usando el producto. Después no.
-- Los PINs nuevos quedan visibles para el padre en el dashboard.

-- Se rotan TODOS sin filtro: cualquier PIN existente salió de Math.random(),
-- así que no hay ninguno que valga la pena conservar.
update public.children set child_pin  = public.gen_pin();
update public.families set family_pin = public.gen_pin();

-- ---------------------------------------------------------------------
-- 14. Verificación — no debería devolver ninguna fila
-- ---------------------------------------------------------------------

do $$
declare leftover int;
begin
  select count(*) into leftover
  from pg_policies
  where schemaname = 'public'
    and (qual = 'true' or with_check = 'true');

  if leftover > 0 then
    raise exception 'Quedaron % políticas permisivas — revisar antes de deployar', leftover;
  end if;

  raise notice '=== OK: no quedan políticas con USING/WITH CHECK = true ===';
end;
$$;

commit;

-- =====================================================================
-- DESPUÉS DE CORRER ESTO
--   1. Anotá los PINs nuevos: aparecen en el dashboard del padre.
--   2. Agregá en Vercel las 2 env vars nuevas (ver .env.local.example):
--        SUPABASE_SECRET_KEY   (sb_secret_... — NUNCA con prefijo NEXT_PUBLIC)
--        KID_SESSION_SECRET    (openssl rand -base64 32)
--   3. Deployá el código de esta branch. El código viejo deja de andar
--      a propósito: ya no existe el acceso anónimo del que dependía.
-- =====================================================================
