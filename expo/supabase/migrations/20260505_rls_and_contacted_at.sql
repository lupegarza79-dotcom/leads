-- Migration: RLS hardening + contacted_at automation
-- Date: 2026-05-05
--
-- Goals:
--   1. Recursion-safe RLS on mg_users (no self-referential subqueries inside its
--      own policies). We use SECURITY DEFINER helper functions so role lookups
--      bypass RLS and can't trigger infinite recursion (Postgres 42P17).
--   2. managers / orchestrators can read everything.
--   3. producers can only read/update their own leads.
--   4. Authenticated-only writes; anon has no access.
--   5. service_role (edge functions) keeps full access via BYPASSRLS.
--   6. Auto-maintain mg_leads.contacted_at when a follow-up activity is logged.

-- =========================================================================
-- 0. Extensions / safety
-- =========================================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================================================================
-- 1. contacted_at column on mg_leads (idempotent)
-- =========================================================================
ALTER TABLE public.mg_leads
  ADD COLUMN IF NOT EXISTS contacted_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_mg_leads_contacted_at
  ON public.mg_leads (contacted_at);

-- =========================================================================
-- 2. SECURITY DEFINER helpers (recursion-safe)
--
-- These functions run with the definer's privileges and we explicitly mark
-- them STABLE + SECURITY DEFINER. Because they are called from RLS policies
-- on mg_users itself, they MUST NOT be subject to RLS — SECURITY DEFINER
-- combined with the function owner being the table owner ensures the inner
-- SELECT against mg_users does not re-trigger policy evaluation.
--
-- We also pin search_path to avoid schema-injection inside SECURITY DEFINER.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT role
  FROM public.mg_users
  WHERE id = auth.uid()
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_manager_or_orchestrator()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.mg_users
    WHERE id = auth.uid()
      AND role IN ('manager', 'orchestrator')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_producer()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.mg_users
    WHERE id = auth.uid()
      AND role = 'producer'
  );
$$;

-- Lock down EXECUTE: anon should not call these.
REVOKE ALL ON FUNCTION public.current_user_role()           FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_manager_or_orchestrator()  FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_producer()                 FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_user_role()           TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_manager_or_orchestrator()  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_producer()                 TO authenticated, service_role;

-- =========================================================================
-- 2b. Drop ALL legacy policies on the 5 target tables (dynamic, by pg_policies)
--
-- We don't trust that legacy policy names match what we expect, so we drop
-- every policy that currently exists on these tables before recreating the
-- official set below. mg_follow_up_tasks is included only if it exists.
-- =========================================================================
DO $legacy$
DECLARE
  r record;
  target_tables text[] := ARRAY[
    'mg_leads',
    'mg_activity_log',
    'mg_follow_up_tasks',
    'mg_users',
    'mg_escalation_log'
  ];
  t text;
BEGIN
  FOREACH t IN ARRAY target_tables LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = 'public' AND c.relname = t AND c.relkind = 'r'
    ) THEN
      RAISE NOTICE 'Skipping legacy-policy drop: table public.% does not exist', t;
      CONTINUE;
    END IF;

    FOR r IN
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = t
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, t);
    END LOOP;
  END LOOP;
END
$legacy$;

-- =========================================================================
-- 3. RLS: mg_users
--
-- Recursion-safe: policies only reference auth.uid() directly OR call the
-- SECURITY DEFINER helpers above. They never run a plain subquery against
-- mg_users from within an mg_users policy.
-- =========================================================================
ALTER TABLE public.mg_users ENABLE ROW LEVEL SECURITY;

-- Each authenticated user can read their own row (no recursion: only auth.uid()).
CREATE POLICY "mg_users_select_self"
  ON public.mg_users
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

-- Managers + orchestrators can read every row (helper bypasses RLS).
CREATE POLICY "mg_users_select_managers"
  ON public.mg_users
  FOR SELECT
  TO authenticated
  USING (public.is_manager_or_orchestrator());

-- A user can update their own row (no recursion).
CREATE POLICY "mg_users_update_self"
  ON public.mg_users
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Managers can insert/delete users.
CREATE POLICY "mg_users_insert_managers"
  ON public.mg_users
  FOR INSERT
  TO authenticated
  WITH CHECK (public.is_manager_or_orchestrator());

CREATE POLICY "mg_users_delete_managers"
  ON public.mg_users
  FOR DELETE
  TO authenticated
  USING (public.is_manager_or_orchestrator());

-- =========================================================================
-- 4. RLS: mg_leads
-- (Legacy policies already cleared in section 2b.)
-- =========================================================================
ALTER TABLE public.mg_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mg_leads_select_managers"
  ON public.mg_leads
  FOR SELECT
  TO authenticated
  USING (public.is_manager_or_orchestrator());

CREATE POLICY "mg_leads_select_producers"
  ON public.mg_leads
  FOR SELECT
  TO authenticated
  USING (public.is_producer() AND owner_id = auth.uid());

CREATE POLICY "mg_leads_insert_auth"
  ON public.mg_leads
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "mg_leads_update_managers"
  ON public.mg_leads
  FOR UPDATE
  TO authenticated
  USING (public.is_manager_or_orchestrator())
  WITH CHECK (public.is_manager_or_orchestrator());

CREATE POLICY "mg_leads_update_producers"
  ON public.mg_leads
  FOR UPDATE
  TO authenticated
  USING (public.is_producer() AND owner_id = auth.uid())
  WITH CHECK (public.is_producer() AND owner_id = auth.uid());

CREATE POLICY "mg_leads_delete_managers"
  ON public.mg_leads
  FOR DELETE
  TO authenticated
  USING (public.is_manager_or_orchestrator());

-- =========================================================================
-- 5. RLS: mg_activity_log
-- (Legacy policies already cleared in section 2b.)
-- =========================================================================
ALTER TABLE public.mg_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "mg_activity_select_managers"
  ON public.mg_activity_log
  FOR SELECT
  TO authenticated
  USING (public.is_manager_or_orchestrator());

CREATE POLICY "mg_activity_select_producers"
  ON public.mg_activity_log
  FOR SELECT
  TO authenticated
  USING (
    public.is_producer()
    AND EXISTS (
      SELECT 1 FROM public.mg_leads l
      WHERE l.id = mg_activity_log.lead_id
        AND l.owner_id = auth.uid()
    )
  );

CREATE POLICY "mg_activity_insert_auth"
  ON public.mg_activity_log
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- =========================================================================
-- 6. RLS: mg_escalation_log (edge functions only; UI never touches it)
-- =========================================================================
ALTER TABLE public.mg_escalation_log ENABLE ROW LEVEL SECURITY;
-- (Legacy policies already cleared in section 2b.)

CREATE POLICY "mg_escalation_select_managers"
  ON public.mg_escalation_log
  FOR SELECT
  TO authenticated
  USING (public.is_manager_or_orchestrator());

-- service_role has BYPASSRLS by default, so no explicit policy needed for
-- the edge function. We deliberately do NOT add an authenticated INSERT
-- policy here — only edge functions write escalations.

-- =========================================================================
-- 7. contacted_at trigger
--
-- When a follow-up activity is inserted into mg_activity_log, stamp the
-- parent lead's contacted_at (only on first contact, so escalation logic
-- doesn't get reset by every subsequent note).
--
-- Follow-up rule (must match edge function hasFollowUp):
--   call, whatsapp, email, follow_up           -> always count
--   note                                       -> ONLY if note ILIKE '[FOLLOW-UP]%'
-- Generic notes (e.g. "Lead created", "Lead edited") MUST NOT stamp
-- contacted_at, otherwise escalation logic is silently bypassed.
-- =========================================================================

CREATE OR REPLACE FUNCTION public.mg_set_contacted_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $
DECLARE
  is_followup boolean;
BEGIN
  is_followup := (
    NEW.type IN ('call', 'whatsapp', 'email', 'follow_up')
    OR (NEW.type = 'note' AND NEW.note ILIKE '[FOLLOW-UP]%')
  );

  IF is_followup THEN
    UPDATE public.mg_leads
    SET contacted_at = COALESCE(contacted_at, NEW.created_at, now())
    WHERE id = NEW.lead_id
      AND contacted_at IS NULL;
  END IF;
  RETURN NEW;
END;
$;

DROP TRIGGER IF EXISTS trg_mg_activity_set_contacted_at ON public.mg_activity_log;
CREATE TRIGGER trg_mg_activity_set_contacted_at
  AFTER INSERT ON public.mg_activity_log
  FOR EACH ROW
  EXECUTE FUNCTION public.mg_set_contacted_at();

-- =========================================================================
-- 8. Grants (RLS still applies; this just ensures the role can attempt access)
-- =========================================================================
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mg_users          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.mg_leads          TO authenticated;
GRANT SELECT, INSERT                 ON public.mg_activity_log   TO authenticated;
GRANT SELECT                         ON public.mg_escalation_log TO authenticated;

-- anon gets nothing.
REVOKE ALL ON public.mg_users          FROM anon;
REVOKE ALL ON public.mg_leads          FROM anon;
REVOKE ALL ON public.mg_activity_log   FROM anon;
REVOKE ALL ON public.mg_escalation_log FROM anon;
