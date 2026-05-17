-- ============================================================
-- Inovimmo — Migration v12
-- Nebenkostenabrechnung v2: Zähler, Verteilschlüssel, Vorlagen, Dokumente
-- ============================================================

-- ── NK-ZÄHLER (Meter/Counter Readings) ──────────────────────
create table if not exists public.nk_zaehler (
  id                uuid primary key default uuid_generate_v4(),
  liegenschaft_id   uuid not null references public.liegenschaften(id) on delete cascade,
  wohnung_id        uuid references public.wohnungen(id) on delete set null,
  bezeichnung       text not null,
  zaehler_typ       text not null check (zaehler_typ in ('heizung','warmwasser','wasser','abwasser','strom')),
  einheit           text not null default 'kWh',
  stand_vorjahr     numeric(12,2),
  stand_endjahr     numeric(12,2),
  faktor            numeric(8,4) not null default 1.0,
  notiz             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index idx_nk_zaehler_liegenschaft on public.nk_zaehler(liegenschaft_id);
create index idx_nk_zaehler_wohnung on public.nk_zaehler(wohnung_id);

-- ── NK-VERTEILSCHLÜSSEL (Allocation Key per Category) ──────
create table if not exists public.nk_verteilschluessel (
  id                    uuid primary key default uuid_generate_v4(),
  liegenschaft_id       uuid not null references public.liegenschaften(id) on delete cascade,
  kategorie             text not null check (kategorie in (
    'heizung','warmwasser','wasser_abwasser','kehricht','allgemeinstrom',
    'hauswart','versicherung','sonstiges'
  )),
  verteilschluessel_typ text not null default 'flaeche' check (verteilschluessel_typ in (
    'flaeche','kopf','gleich','verbrauch','gemischt'
  )),
  gemischt_positionen   jsonb default '[]',
  notiz                 text,
  created_at            timestamptz not null default now(),
  unique(liegenschaft_id, kategorie)
);

-- ── NK-ABRECHNUNG VORLAGEN (Cover Letter Templates) ─────────
create table if not exists public.nk_abrechnung_vorlagen (
  id                uuid primary key default uuid_generate_v4(),
  verwalter_id      uuid not null references public.profiles(id) on delete cascade,
  name              text not null default 'Standard',
  ton               text not null default 'neutral' check (ton in ('neutral','freundlich','streng')),
  betreff           text not null,
  anrede_vorlage    text not null default 'Sehr geehrte/r {{mieter_name}},',
  einleitungstext   text,
  schlusstext       text,
  zahlungshinweis   text,
  belege_hinweis    text not null default 'Die Belege können während 14 Tagen bei der Verwaltung eingesehen werden.',
  erstellt_von       uuid references public.profiles(id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index idx_nk_vorlagen_verwalter on public.nk_abrechnung_vorlagen(verwalter_id);

-- ── NK-ABRECHNUNG DOKUMENTE (Generated Document Tracking) ───
create table if not exists public.nk_abrechnung_dokumente (
  id                uuid primary key default uuid_generate_v4(),
  abrechnung_id     uuid not null references public.nebenkostenabrechnungen(id) on delete cascade,
  dokument_typ      text not null check (dokument_typ in (
    'abrechnung','begleitschreiben','kostenuebersicht','detailbeilage','batch_pdf'
  )),
  pdf_url           text,
  dateiname         text not null,
  erstellt_am       timestamptz not null default now(),
  versendet_am      timestamptz,
  versendet_an      text,
  created_at        timestamptz not null default now()
);

create index idx_nk_dokumente_abrechnung on public.nk_abrechnung_dokumente(abrechnung_id);

-- ── ERWEITERUNG: nebenkostenpositionen ──────────────────────
alter table public.nebenkostenpositionen
  add column if not exists zaehler_id uuid references public.nk_zaehler(id) on delete set null,
  add column if not exists mwst_prozent numeric(4,2) default 0,
  add column if not exists umlagefaehig boolean not null default true,
  add column if not exists verteilschluessel_override text
    check (verteilschluessel_override is null or verteilschluessel_override in ('flaeche','kopf','gleich','verbrauch','gemischt'));

-- ── ERWEITERUNG: nebenkostenabrechnungen ─────────────────────
alter table public.nebenkostenabrechnungen
  add column if not exists periode_von date,
  add column if not exists periode_bis date,
  add column if not exists total_kosten numeric(10,2) default 0,
  add column if not exists total_vorschuss numeric(10,2) default 0;

-- nachzahlung as generated column (kosten_total - akonto_total)
-- Only add if not exists; differenz already exists as generated column
do $$
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'nebenkostenabrechnungen' and column_name = 'nachzahlung'
  ) then
    alter table public.nebenkostenabrechnungen
      add column nachzahlung numeric(10,2) generated always as (kosten_total - akonto_total) stored;
  end if;
end $$;

alter table public.nebenkostenabrechnungen
  add column if not exists zahlungsfrist date,
  add column if not exists begleitschreiben_ton text default 'neutral' check (begleitschreiben_ton in ('neutral','freundlich','streng')),
  add column if not exists bankkonto_id uuid references public.bankkonten(id) on delete set null,
  add column if not exists verwalter_id uuid references public.profiles(id) on delete set null,
  add column if not exists notiz text;

-- Expand status constraint to include more granular states
-- First drop the existing check constraint if it exists
do $$
declare
  constraint_name text;
begin
  select conname into constraint_name
  from pg_constraint c
  join pg_namespace n on n.oid = c.connamespace
  where n.nspname = 'public'
    and c.conrelid = 'public.nebenkostenabrechnungen'::regclass
    and contype = 'c'
    and pg_get_constraintdef(c.oid) like '%status%';

  if constraint_name is not null then
    execute format('alter table public.nebenkostenabrechnungen drop constraint %I', constraint_name);
  end if;
end $$;

alter table public.nebenkostenabrechnungen
  add constraint nk_abrechnung_status_check
    check (status in ('entwurf','berechnet','versendet','teilweise_bezahlt','bezahlt','angefochten'));

-- ── ERWEITERUNG: nk_abrechnung_positionen ────────────────────
alter table public.nk_abrechnung_positionen
  add column if not exists zaehlerstand_start numeric(12,2),
  add column if not exists zaehlerstand_end numeric(12,2),
  add column if not exists verbrauch_einheit numeric(12,2),
  add column if not exists verteilschluessel_typ text check (verteilschluessel_typ is null or verteilschluessel_typ in ('flaeche','kopf','gleich','verbrauch','gemischt')),
  add column if not exists notiz text;

-- ── RLS POLICIES ────────────────────────────────────────────
alter table public.nk_zaehler enable row level security;
create policy "nk_zaehler_owner" on public.nk_zaehler
  for all using (
    exists (select 1 from public.liegenschaften l where l.id = liegenschaft_id and l.verwalter_id = auth.uid())
  );

alter table public.nk_verteilschluessel enable row level security;
create policy "nk_verteilschluessel_owner" on public.nk_verteilschluessel
  for all using (
    exists (select 1 from public.liegenschaften l where l.id = liegenschaft_id and l.verwalter_id = auth.uid())
  );

alter table public.nk_abrechnung_vorlagen enable row level security;
create policy "nk_vorlagen_owner" on public.nk_abrechnung_vorlagen
  for all using (verwalter_id = auth.uid());

alter table public.nk_abrechnung_dokumente enable row level security;
create policy "nk_dokumente_owner" on public.nk_abrechnung_dokumente
  for all using (
    exists (
      select 1 from public.nebenkostenabrechnungen a
      join public.liegenschaften l on l.id = a.liegenschaft_id
      where a.id = abrechnung_id and l.verwalter_id = auth.uid()
    )
  );

-- Mieter can read their own NK documents
create policy "nk_dokumente_mieter_read" on public.nk_abrechnung_dokumente
  for select using (
    exists (
      select 1 from public.nebenkostenabrechnungen a
      join public.mietverhaeltnisse mv on mv.wohnung_id = a.wohnung_id
      join public.mieter m on m.id = mv.mieter_id
      where a.id = abrechnung_id
        and (mv.mietende is null or mv.mietende > now())
        and lower(m.email) = lower(auth.jwt() ->> 'email')
    )
  );

-- ── UPDATED_AT TRIGGER ──────────────────────────────────────
create or replace function public.update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger nk_zaehler_updated_at
  before update on public.nk_zaehler
  for each row execute function public.update_updated_at();

create trigger nk_vorlagen_updated_at
  before update on public.nk_abrechnung_vorlagen
  for each row execute function public.update_updated_at();