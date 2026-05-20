-- ============================================================
-- Inovimmo — Migration v14
-- Fix infinite RLS recursion between wohnungen ↔ mietverhaeltnisse
-- ============================================================

-- ── SECURITY DEFINER helper functions (break recursion) ──────
-- These functions run as definer (superuser) and bypass RLS,
-- so subqueries don't trigger the other table's RLS policies.

CREATE OR REPLACE FUNCTION public.is_wohnung_verwalter(wohnung_uuid uuid, verwalter_uuid uuid)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.wohnungen w
    JOIN public.liegenschaften l ON l.id = w.liegenschaft_id
    WHERE w.id = wohnung_uuid AND l.verwalter_id = verwalter_uuid
  );
$$;

CREATE OR REPLACE FUNCTION public.is_mieter_for_wohnung(wohnung_uuid uuid, check_email text)
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.mietverhaeltnisse mv
    JOIN public.mieter m ON m.id = mv.mieter_id
    WHERE mv.wohnung_id = wohnung_uuid
      AND (mv.mietende IS NULL OR mv.mietende > now())
      AND lower(m.email) = lower(check_email)
  );
$$;

-- ── WOHNUNGEN RLS ────────────────────────────────────────────
DROP POLICY IF EXISTS "wohnungen_owner" ON public.wohnungen;
DROP POLICY IF EXISTS "wohnungen_mieter_read" ON public.wohnungen;
DROP POLICY IF EXISTS "wohnungen_admin" ON public.wohnungen;

-- Verwalter via liegenschaften + admin (no recursion)
CREATE POLICY "wohnungen_owner" ON public.wohnungen
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.liegenschaften l WHERE l.id = wohnungen.liegenschaft_id AND l.verwalter_id = auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Mieter read via SECURITY DEFINER function (breaks recursion)
CREATE POLICY "wohnungen_mieter_read" ON public.wohnungen
  FOR SELECT USING (
    public.is_mieter_for_wohnung(wohnungen.id, auth.jwt() ->> 'email')
  );

-- Admin
CREATE POLICY "wohnungen_admin" ON public.wohnungen
  FOR ALL USING (public.is_admin());

-- ── MIETVERHAELTNISSE RLS ───────────────────────────────────
DROP POLICY IF EXISTS "mv_owner" ON public.mietverhaeltnisse;
DROP POLICY IF EXISTS "mietverhaeltnisse_owner" ON public.mietverhaeltnisse;
DROP POLICY IF EXISTS "mv_mieter_read" ON public.mietverhaeltnisse;
DROP POLICY IF EXISTS "mietverhaeltnisse_admin" ON public.mietverhaeltnisse;

-- Verwalter via SECURITY DEFINER function (breaks recursion) + admin
CREATE POLICY "mietverhaeltnisse_owner" ON public.mietverhaeltnisse
  FOR ALL USING (
    public.is_wohnung_verwalter(mietverhaeltnisse.wohnung_id, auth.uid())
    OR EXISTS (SELECT 1 FROM profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
  );

-- Mieter self-read (only references mieter table, no recursion)
CREATE POLICY "mv_mieter_read" ON public.mietverhaeltnisse
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.mieter m WHERE m.id = mietverhaeltnisse.mieter_id AND lower(m.email) = lower(auth.jwt() ->> 'email'))
  );

-- Admin
CREATE POLICY "mietverhaeltnisse_admin" ON public.mietverhaeltnisse
  FOR ALL USING (public.is_admin());