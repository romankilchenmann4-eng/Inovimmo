-- ============================================================
-- Inovimmo — Migration v4
-- Mieterspiegel-PDF-Import + Externe Mieter (ohne Login)
-- ============================================================

-- ── ERWEITERUNG WOHNUNGEN ───────────────────────────────────
-- Neue Spalten für Mieterspiegel-Import

alter table public.wohnungen
  add column if not exists wohnungstyp text not null default 'wohnung' check (wohnungstyp in (
    'wohnung', 'bastelraum', 'parkplatz_aussen', 'einstellgarage',
    'gewerbe', 'lager', 'sonstiges'
  )),
  add column if not exists beheizt boolean not null default true,
  add column if not exists position text,
  add column if not exists externe_referenz text;

create index if not exists idx_wohnungen_typ on public.wohnungen(wohnungstyp);

-- ── EXTERNE MIETER (ohne Login) ─────────────────────────────
-- Mieter, die per PDF-Import angelegt wurden und (noch) keinen Inovimmo-Account haben
create table public.externe_mieter (
  id                  uuid primary key default uuid_generate_v4(),
  wohnung_id          uuid not null references public.wohnungen(id) on delete cascade,

  -- Personendaten
  full_name           text not null,
  ist_vertragspartner boolean not null default true,

  -- Kontakt
  strasse             text,
  plz                 text,
  ort                 text,
  telefon_festnetz    text,
  telefon_mobil       text,
  email               text,

  -- Tracking
  externe_referenz    text,
  notizen             text,

  -- Verlinkung mit echtem Account (wenn Mieter sich später registriert)
  verknuepft_profile_id uuid references public.profiles(id) on delete set null,

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create trigger externe_mieter_updated_at before update on public.externe_mieter
  for each row execute procedure update_updated_at();

create index idx_externe_mieter_wohnung on public.externe_mieter(wohnung_id);
create index idx_externe_mieter_profile on public.externe_mieter(verknuepft_profile_id);

-- ── MIETERSPIEGEL IMPORTS (Job-Tracking) ────────────────────
create table public.mieterspiegel_imports (
  id                  uuid primary key default uuid_generate_v4(),
  verwalter_id        uuid not null references public.profiles(id) on delete cascade,

  -- Source
  storage_path        text not null,
  dateiname           text,

  -- Status
  status              text not null default 'hochgeladen' check (status in (
    'hochgeladen', 'extrahiert', 'vorschau', 'importiert', 'fehlgeschlagen'
  )),

  -- Ergebnis
  extrahierte_daten   jsonb,
  liegenschaft_id     uuid references public.liegenschaften(id) on delete set null,

  -- KI-Tracking
  fehler_meldung      text,
  tokens_input        integer,
  tokens_output       integer,
  kosten_chf          numeric(8,4),

  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create trigger mieterspiegel_imports_updated_at before update on public.mieterspiegel_imports
  for each row execute procedure update_updated_at();

create index idx_imports_verwalter on public.mieterspiegel_imports(verwalter_id);
create index idx_imports_status on public.mieterspiegel_imports(status);

-- ── ROW LEVEL SECURITY ──────────────────────────────────────
alter table public.externe_mieter enable row level security;
alter table public.mieterspiegel_imports enable row level security;

-- Externe Mieter: nur Verwalter der Liegenschaft
create policy "externe_mieter_owner" on public.externe_mieter
  for all using (
    exists (
      select 1 from public.wohnungen w
      join public.liegenschaften l on l.id = w.liegenschaft_id
      where w.id = wohnung_id and l.verwalter_id = auth.uid()
    )
  );

-- Externe Mieter: lesender Zugriff für verknüpften Account
create policy "externe_mieter_self_read" on public.externe_mieter
  for select using (verknuepft_profile_id = auth.uid());

-- Imports: nur eigene
create policy "imports_owner" on public.mieterspiegel_imports
  for all using (verwalter_id = auth.uid());

-- ── STORAGE BUCKET (privat) ─────────────────────────────────
-- Privater Bucket für Mieterspiegel-PDFs
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'mieterspiegel',
  'mieterspiegel',
  false,
  20971520,  -- 20 MB
  array['application/pdf']
)
on conflict (id) do nothing;

-- Storage-Policies (privater Zugriff via User-Folder)
create policy "mieterspiegel_upload_own"
  on storage.objects for insert
  with check (
    bucket_id = 'mieterspiegel'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "mieterspiegel_read_own"
  on storage.objects for select
  using (
    bucket_id = 'mieterspiegel'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "mieterspiegel_delete_own"
  on storage.objects for delete
  using (
    bucket_id = 'mieterspiegel'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ── ANGEPASSTE WOHNUNGEN-RLS ────────────────────────────────
-- Bestehende Policy erweitern: externe Mieter ihrer Wohnung sehen
drop policy if exists "wohnungen_owner" on public.wohnungen;

create policy "wohnungen_zugriff" on public.wohnungen
  for all using (
    -- Verwalter der Liegenschaft
    exists (
      select 1 from public.liegenschaften l
      where l.id = liegenschaft_id and l.verwalter_id = auth.uid()
    )
    -- ODER eingeloggter Mieter
    or mieter_id = auth.uid()
    -- ODER verknüpfter externer Mieter
    or exists (
      select 1 from public.externe_mieter em
      where em.wohnung_id = wohnungen.id
        and em.verknuepft_profile_id = auth.uid()
    )
  );
