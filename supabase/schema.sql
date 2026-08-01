-- ===================================================
-- LISTO — Database Schema (estado deseado)
-- ===================================================
--
-- ⚠️ ORDEN DE APLICACIÓN
--   Proyecto nuevo:  correr este archivo y listo.
--   Proyecto actual: este archivo describe el estado FINAL. Lo que hay que
--                    correr sobre la base existente es
--                    supabase/migrations/0001_security_hardening.sql
--
-- Hallazgo M3 de la spec 0008: este archivo había quedado desactualizado
-- respecto de producción (le faltaba children.child_pin, tenía
-- get_family_by_pin en lugar de get_child_by_pin, y no tenía las políticas
-- anónimas que el flujo del hijo usaba de verdad). Esa deriva es la razón por la
-- que los dos hallazgos críticos pasaron desapercibidos: no se puede auditar un
-- RLS que no está versionado. Mantener este archivo sincronizado no es
-- prolijidad, es un control de seguridad.

-- ===================================================
-- TABLAS
-- ===================================================

-- Families: one per parent account
CREATE TABLE families (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id  uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  family_pin varchar(6) UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Children: belong to a family. `child_pin` es la credencial de acceso del hijo.
CREATE TABLE children (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id    uuid REFERENCES families(id) ON DELETE CASCADE NOT NULL,
  name         text NOT NULL,
  avatar_color text NOT NULL DEFAULT '#7C3AED',
  reward_text  text DEFAULT NULL,
  child_pin    varchar(6),
  created_at   timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX children_child_pin_key
  ON children (child_pin) WHERE child_pin IS NOT NULL;

-- Tasks: template tasks assigned to a child (points = reward per completion)
CREATE TABLE tasks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id    uuid REFERENCES children(id) ON DELETE CASCADE NOT NULL,
  title       text NOT NULL,
  recurrence  text NOT NULL DEFAULT 'daily' CHECK (recurrence IN ('daily', 'weekdays', 'weekend', 'custom')),
  days        smallint[] DEFAULT NULL,
  points      smallint NOT NULL DEFAULT 10,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

-- Task completions: one per task per day
CREATE TABLE task_completions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id      uuid REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
  child_id     uuid REFERENCES children(id) ON DELETE CASCADE NOT NULL,
  date         date NOT NULL DEFAULT CURRENT_DATE,
  completed_at timestamptz DEFAULT now(),
  created_at   timestamptz DEFAULT now(),
  UNIQUE(task_id, date)
);

-- Points ledger
CREATE TABLE point_transactions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id   uuid REFERENCES children(id) ON DELETE CASCADE NOT NULL,
  delta      integer NOT NULL,
  reason     text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Rewards catalog (parent defines, kid redeems)
CREATE TABLE rewards_catalog (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id    uuid REFERENCES children(id) ON DELETE CASCADE NOT NULL,
  title       text NOT NULL,
  cost_points integer NOT NULL DEFAULT 50,
  active      boolean NOT NULL DEFAULT true,
  created_at  timestamptz DEFAULT now()
);

-- Redemption requests (kid requests, parent approves)
CREATE TABLE reward_redemptions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id   uuid REFERENCES children(id) ON DELETE CASCADE NOT NULL,
  reward_id  uuid REFERENCES rewards_catalog(id) NOT NULL,
  status     text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at timestamptz DEFAULT now()
);

-- Rate limiting del lookup de PIN (spec 0008 H4)
CREATE TABLE pin_attempts (
  id           bigserial PRIMARY KEY,
  ip           text        NOT NULL,
  succeeded    boolean     NOT NULL,
  attempted_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX pin_attempts_ip_time_idx ON pin_attempts (ip, attempted_at DESC);

-- ===================================================
-- ROW LEVEL SECURITY
-- ===================================================
--
-- REGLA: no existe NINGUNA política con USING (true) o WITH CHECK (true).
-- El hijo no tiene cuenta y por lo tanto NO accede por RLS: accede por las
-- funciones kid_* de más abajo, que solo puede ejecutar `service_role` (la
-- secret key, del lado servidor). El rol `anon` no tiene acceso a nada.

ALTER TABLE families           ENABLE ROW LEVEL SECURITY;
ALTER TABLE children           ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks              ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_completions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE point_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewards_catalog    ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE pin_attempts       ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON families, children, tasks, task_completions,
              point_transactions, rewards_catalog, reward_redemptions,
              pin_attempts
       FROM anon;

-- Families: parents manage their own family
CREATE POLICY "parent_own_family" ON families
  FOR ALL USING (parent_id = auth.uid());

-- Children: accessible to the parent of their family
CREATE POLICY "parent_own_children" ON children
  FOR ALL USING (
    family_id IN (SELECT id FROM families WHERE parent_id = auth.uid())
  );

-- Tasks: accessible to the parent of the child
CREATE POLICY "parent_own_tasks" ON tasks
  FOR ALL USING (
    child_id IN (
      SELECT c.id FROM children c
      JOIN families f ON c.family_id = f.id
      WHERE f.parent_id = auth.uid()
    )
  );

-- Task completions: el padre lee Y escribe lo de sus hijos
CREATE POLICY "parent_read_completions" ON task_completions
  FOR SELECT USING (
    child_id IN (
      SELECT c.id FROM children c
      JOIN families f ON c.family_id = f.id
      WHERE f.parent_id = auth.uid()
    )
  );

CREATE POLICY "parent_write_completions" ON task_completions
  FOR ALL
  USING (
    child_id IN (
      SELECT c.id FROM children c
      JOIN families f ON c.family_id = f.id
      WHERE f.parent_id = auth.uid()
    )
  )
  WITH CHECK (
    child_id IN (
      SELECT c.id FROM children c
      JOIN families f ON c.family_id = f.id
      WHERE f.parent_id = auth.uid()
    )
  );

CREATE POLICY "parent_own_points" ON point_transactions
  FOR ALL USING (child_id IN (SELECT c.id FROM children c JOIN families f ON c.family_id = f.id WHERE f.parent_id = auth.uid()));

CREATE POLICY "parent_own_catalog" ON rewards_catalog
  FOR ALL USING (child_id IN (SELECT c.id FROM children c JOIN families f ON c.family_id = f.id WHERE f.parent_id = auth.uid()));

CREATE POLICY "parent_own_redemptions" ON reward_redemptions
  FOR ALL USING (child_id IN (SELECT c.id FROM children c JOIN families f ON c.family_id = f.id WHERE f.parent_id = auth.uid()));

-- ===================================================
-- FUNCIONES
-- ===================================================
-- Todas con SET search_path = '' (lint 0011_function_search_path_mutable).
-- El cuerpo de cada una vive en migrations/0001_security_hardening.sql, para que
-- la migración sea auto-contenida y este archivo no duplique lógica que después
-- divergiría (que es exactamente el problema M3 que estamos arreglando).
--
--   gen_pin()                                         → PIN con CSPRNG
--   kid_resolve_pin(pin, ip)                          → service_role
--   kid_complete_task(child_id, task_id, date)        → service_role
--   kid_request_redemption(child_id, reward_id)       → service_role
--   parent_resolve_redemption(redemption_id, approve) → authenticated
--   get_child_balance(child_id)                       → authenticated
--
-- NO existen más get_family_by_pin ni get_child_by_pin: devolvían datos del
-- hijo a cualquiera que llamara la RPC, sin límite de intentos.

-- ===================================================
-- REALTIME
-- ===================================================

ALTER PUBLICATION supabase_realtime ADD TABLE task_completions;
ALTER PUBLICATION supabase_realtime ADD TABLE point_transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE reward_redemptions;
