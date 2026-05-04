-- ============================================================
-- Inovimmo — Migration v2
-- Neue Tabellen für erweiterte Module
-- ============================================================

-- ── DOKUMENTE ───────────────────────────────────────────────
create table public.dokumente (
  id              uuid primary key default uuid_generate_v4(),
  eigentümer_id   uuid not null references public.profiles(id) on delete cascade,
  liegenschaft_id uuid references public.liegenschaften(id),
  wohnung_id      uuid references public.wohnungen(id),
  bezeichnung     text not null,
  typ             text not null default 'sonstiges',
  dateiname       text not null,
  storage_path    text not null,
  public_url      text not null,
  mime_type       text,
  groesse_bytes   bigint default 0,
  created_at      timestamptz not null default now()
);

alter table public.dokumente enable row level security;
create policy "dokumente_owner" on public.dokumente for all using (eigentümer_id = auth.uid());

-- ── ÜBERGABEPROTOKOLLE ──────────────────────────────────────
create table public.uebergabeprotokolle (
  id                    uuid primary key default uuid_generate_v4(),
  erstellt_von          uuid not null references public.profiles(id),
  typ                   text not null check (typ in ('einzug','auszug')),
  wohnung_bezeichnung   text not null,
  mieter_name           text not null,
  datum                 date not null,
  zaehlerstand_strom    text,
  zaehlerstand_wasser   text,
  anzahl_schluessel     integer default 2,
  notizen_allgemein     text,
  zustand_json          text,
  maengel_anzahl        integer default 0,
  unterschrift_mieter   boolean default false,
  status                text default 'abgeschlossen',
  kosten_chf            numeric(6,2) default 12,
  created_at            timestamptz not null default now()
);

alter table public.uebergabeprotokolle enable row level security;
create policy "uebergabe_owner" on public.uebergabeprotokolle for all using (erstellt_von = auth.uid());

-- ── SCREENINGS ──────────────────────────────────────────────
create table public.screenings (
  id                  uuid primary key default uuid_generate_v4(),
  erstellt_von        uuid not null references public.profiles(id),
  mieter_vorname      text not null,
  mieter_nachname     text not null,
  mieter_geburtsdatum date,
  ergebnis_json       text,
  empfehlung          text check (empfehlung in ('freigabe','vorbehalt','ablehnung')),
  kosten_chf          numeric(6,2) default 25,
  created_at          timestamptz not null default now()
);

alter table public.screenings enable row level security;
create policy "screenings_owner" on public.screenings for all using (erstellt_von = auth.uid());

-- ── KALENDER EVENTS ─────────────────────────────────────────
create table public.kalender_events (
  id              uuid primary key default uuid_generate_v4(),
  erstellt_von    uuid not null references public.profiles(id),
  titel           text not null,
  typ             text not null default 'sonstiges',
  datum           date not null,
  zeit_von        time not null default '09:00',
  zeit_bis        time not null default '10:00',
  notiz           text,
  liegenschaft    text,
  status          text default 'geplant',
  created_at      timestamptz not null default now()
);

alter table public.kalender_events enable row level security;
create policy "kalender_owner" on public.kalender_events for all using (erstellt_von = auth.uid());

-- ── SUPABASE STORAGE BUCKET ─────────────────────────────────
-- In Supabase Dashboard > Storage > Create Bucket:
-- Name: "dokumente"
-- Public: true (für direkte URL-Zugriffe)
-- Max file size: 50MB
-- Allowed MIME types: image/*, application/pdf, application/msword,
--   application/vnd.openxmlformats-officedocument.*

-- Storage RLS Policy (im Dashboard unter Storage > Policies):
-- INSERT: auth.uid()::text = (storage.foldername(name))[1]
-- SELECT: true (public read)
-- DELETE: auth.uid()::text = (storage.foldername(name))[1]
