-- ===================================================
-- LISTO — Database Schema
-- Run this in Supabase SQL Editor
-- ===================================================

-- Families: one per parent account
CREATE TABLE families (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id  uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  family_pin varchar(6) UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Children: belong to a family
CREATE TABLE children (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  family_id    uuid REFERENCES families(id) ON DELETE CASCADE NOT NULL,
  name         text NOT NULL,
  avatar_color text NOT NULL DEFAULT '#7C3AED',
  reward_text  text DEFAULT NULL,
  created_at   timestamptz DEFAULT now()
);

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

-- ===================================================
-- ROW LEVEL SECURITY
-- ===================================================

ALTER TABLE families         ENABLE ROW LEVEL SECURITY;
ALTER TABLE children         ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks             ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_completions ENABLE ROW LEVEL SECURITY;

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

-- Task completions: parent can read/write; anonymous can insert via kid PIN flow
CREATE POLICY "parent_read_completions" ON task_completions
  FOR SELECT USING (
    child_id IN (
      SELECT c.id FROM children c
      JOIN families f ON c.family_id = f.id
      WHERE f.parent_id = auth.uid()
    )
  );

-- Kids insert completions anonymously (validated at API level by PIN)
CREATE POLICY "anon_insert_completion" ON task_completions
  FOR INSERT WITH CHECK (true);

-- ===================================================
-- HELPER FUNCTION — lookup family by PIN (public)
-- ===================================================

CREATE OR REPLACE FUNCTION get_family_by_pin(pin text)
RETURNS TABLE(
  family_id    uuid,
  family_pin   varchar,
  child_id     uuid,
  child_name   text,
  avatar_color text,
  reward_text  text
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    f.id    AS family_id,
    f.family_pin,
    c.id    AS child_id,
    c.name  AS child_name,
    c.avatar_color,
    c.reward_text
  FROM families f
  JOIN children c ON c.family_id = f.id
  WHERE f.family_pin = UPPER(pin);
$$;

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

ALTER TABLE point_transactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE rewards_catalog     ENABLE ROW LEVEL SECURITY;
ALTER TABLE reward_redemptions  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "parent_own_points"      ON point_transactions FOR ALL USING (child_id IN (SELECT c.id FROM children c JOIN families f ON c.family_id = f.id WHERE f.parent_id = auth.uid()));
CREATE POLICY "parent_own_catalog"     ON rewards_catalog    FOR ALL USING (child_id IN (SELECT c.id FROM children c JOIN families f ON c.family_id = f.id WHERE f.parent_id = auth.uid()));
CREATE POLICY "parent_own_redemptions" ON reward_redemptions FOR ALL USING (child_id IN (SELECT c.id FROM children c JOIN families f ON c.family_id = f.id WHERE f.parent_id = auth.uid()));

CREATE POLICY "anon_read_points"       ON point_transactions FOR SELECT USING (true);
CREATE POLICY "anon_insert_points"     ON point_transactions FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_read_catalog"      ON rewards_catalog    FOR SELECT USING (true);
CREATE POLICY "anon_read_redemptions"  ON reward_redemptions FOR SELECT USING (true);
CREATE POLICY "anon_insert_redemption" ON reward_redemptions FOR INSERT WITH CHECK (true);

CREATE OR REPLACE FUNCTION get_child_balance(p_child_id uuid)
RETURNS integer LANGUAGE sql SECURITY DEFINER AS $$
  SELECT COALESCE(SUM(delta), 0)::integer FROM point_transactions WHERE child_id = p_child_id;
$$;

-- ===================================================
-- REALTIME
-- ===================================================

ALTER PUBLICATION supabase_realtime ADD TABLE task_completions;
ALTER PUBLICATION supabase_realtime ADD TABLE point_transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE reward_redemptions;
