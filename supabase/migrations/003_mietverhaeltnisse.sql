-- ============================================================
-- Inovimmo — Migration v3
-- Mieter-Stammdaten, Mietverhältnisse, erweiterte Wohnungsfelder
-- ============================================================

-- ── MIETER (Stammdaten, unabhängig von Auth-Users) ───────────
create table if not exists public.mieter (
  id                uuid primary key default uuid_generate_v4(),
  verwalter_id      uuid not null references public.profiles(id) on delete cascade,
  vorname           text not null,
  nachname          text not null,
  geburtsdatum      date,
  telefon_mobil     text,
  telefon_festnetz  text,
  email             text,
  strasse           text,
  plz               text,
  ort               text,
  nationalitaet     text,
  ausweis_typ       text check (ausweis_typ in ('CH','C','B','L','G','Sonstiges')),
  ausweis_ablauf    date,
  notizen           text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger mieter_updated_at before update on public.mieter
  for each row execute procedure update_updated_at();

create index idx_mieter_verwalter on public.mieter(verwalter_id);

alter table public.mieter enable row level security;
create policy "mieter_owner" on public.mieter
  for all using (verwalter_id = auth.uid());

-- ── MIETVERHÄLTNISSE ────────────────────────────────────────
create table if not exists public.mietverhaeltnisse (
  id                    uuid primary key default uuid_generate_v4(),
  wohnung_id            uuid not null references public.wohnungen(id) on delete cascade,
  mieter_id             uuid not null references public.mieter(id) on delete cascade,
  ist_vertragspartner   boolean not null default true,
  ist_hauptperson       boolean not null default true,
  mietbeginn            date not null,
  mietende              date,
  kuendigungsdatum      date,
  kaution_chf           numeric(10,2),
  kaution_bezahlt       boolean not null default false,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create trigger mietverhaeltnisse_updated_at before update on public.mietverhaeltnisse
  for each row execute procedure update_updated_at();

create index idx_mv_wohnung on public.mietverhaeltnisse(wohnung_id);
create index idx_mv_mieter on public.mietverhaeltnisse(mieter_id);

alter table public.mietverhaeltnisse enable row level security;
create policy "mv_owner" on public.mietverhaeltnisse
  for all using (
    exists (
      select 1 from public.wohnungen w
      join public.liegenschaften l on l.id = w.liegenschaft_id
      where w.id = wohnung_id and l.verwalter_id = auth.uid()
    )
  );

-- ── ERWEITERTE WOHNUNGSFELDER ────────────────────────────────
-- Felder die der Code bereits nutzt aber in Migration v1 fehlen
alter table public.wohnungen
  add column if not exists wohnungstyp text not null default 'wohnung'
    check (wohnungstyp in ('wohnung','gewerbe','bastelraum','parkplatz_aussen','einstellgarage','lager','sonstiges')),
  add column if not exists beheizt boolean not null default true,
  add column if not exists whg_nr text,
  add column if not exists position text,
  add column if not exists kuendigungstermine text,
  add column if not exists verteilschluessel_prozent numeric(5,2),
  add column if not exists externe_referenz text;

-- Liegenschaft externe Referenz
alter table public.liegenschaften
  add column if not exists externe_referenz text;
