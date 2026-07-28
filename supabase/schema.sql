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
  created_at   timestamptz DEFAULT now()
);

-- Tasks: template tasks assigned to a child
CREATE TABLE tasks (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  child_id    uuid REFERENCES children(id) ON DELETE CASCADE NOT NULL,
  title       text NOT NULL,
  recurrence  text NOT NULL DEFAULT 'daily' CHECK (recurrence IN ('daily', 'weekdays', 'weekend')),
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
  avatar_color text
)
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT
    f.id    AS family_id,
    f.family_pin,
    c.id    AS child_id,
    c.name  AS child_name,
    c.avatar_color
  FROM families f
  JOIN children c ON c.family_id = f.id
  WHERE f.family_pin = UPPER(pin);
$$;

-- ===================================================
-- REALTIME — enable on task_completions for parent dashboard
-- ===================================================

ALTER PUBLICATION supabase_realtime ADD TABLE task_completions;
