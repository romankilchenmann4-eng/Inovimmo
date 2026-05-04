-- ============================================================
-- Inovimmo — Supabase Migration v1
-- Alle Tabellen, RLS Policies, Indexes, Triggers
-- Ausführen in: Supabase Dashboard > SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── PROFILES ────────────────────────────────────────────────
create table public.profiles (
  id          uuid references auth.users on delete cascade primary key,
  email       text not null,
  full_name   text not null default '',
  role        text not null default 'verwalter' check (role in ('verwalter','mieter','dienstleister','admin')),
  phone       text,
  avatar_url  text,
  firma       text,
  adresse     text,
  plz         text,
  ort         text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name, role, firma)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'role', 'verwalter'),
    coalesce(new.raw_user_meta_data->>'firma', '')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Updated_at trigger
create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

-- ── LIEGENSCHAFTEN ──────────────────────────────────────────
create table public.liegenschaften (
  id                uuid primary key default uuid_generate_v4(),
  verwalter_id      uuid not null references public.profiles(id) on delete cascade,
  name              text not null,
  strasse           text not null,
  hausnummer        text not null,
  plz               text not null,
  ort               text not null,
  kanton            text not null default 'ZH',
  baujahr           integer,
  anzahl_wohnungen  integer not null default 1,
  objekttyp         text not null default 'MFH' check (objekttyp in ('MFH','EFH','Gewerbe','Gemischt')),
  notizen           text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger liegenschaften_updated_at before update on public.liegenschaften
  for each row execute procedure update_updated_at();

create index idx_liegenschaften_verwalter on public.liegenschaften(verwalter_id);

-- ── WOHNUNGEN ───────────────────────────────────────────────
create table public.wohnungen (
  id                    uuid primary key default uuid_generate_v4(),
  liegenschaft_id       uuid not null references public.liegenschaften(id) on delete cascade,
  bezeichnung           text not null,
  etage                 integer not null default 0,
  zimmer                numeric(3,1) not null default 3.5,
  flaeche_m2            numeric(6,1),
  nettomiete            numeric(10,2) not null default 0,
  nebenkosten_akonto    numeric(10,2) not null default 0,
  status                text not null default 'leer' check (status in ('vermietet','leer','kuendigung')),
  mieter_id             uuid references public.profiles(id),
  mietbeginn            date,
  mietende              date,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create trigger wohnungen_updated_at before update on public.wohnungen
  for each row execute procedure update_updated_at();

create index idx_wohnungen_liegenschaft on public.wohnungen(liegenschaft_id);
create index idx_wohnungen_mieter on public.wohnungen(mieter_id);

-- ── TICKETS ─────────────────────────────────────────────────
create table public.tickets (
  id              uuid primary key default uuid_generate_v4(),
  liegenschaft_id uuid not null references public.liegenschaften(id) on delete cascade,
  wohnung_id      uuid references public.wohnungen(id),
  erstellt_von    uuid not null references public.profiles(id),
  titel           text not null,
  beschreibung    text not null,
  kategorie       text not null default 'sonstiges' check (kategorie in (
    'heizung_sanitaer','elektro','fenster_tueren','maler_boeden','garten','reinigung','sonstiges'
  )),
  prioritaet      text not null default 'normal' check (prioritaet in ('normal','dringend','notfall')),
  status          text not null default 'neu' check (status in (
    'neu','ausgeschrieben','offerten_eingegangen','vergeben','in_ausfuehrung','abgeschlossen','storniert'
  )),
  budget_max      numeric(10,2),
  fotos           text[],
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create trigger tickets_updated_at before update on public.tickets
  for each row execute procedure update_updated_at();

create index idx_tickets_liegenschaft on public.tickets(liegenschaft_id);
create index idx_tickets_status on public.tickets(status);
create index idx_tickets_erstellt_von on public.tickets(erstellt_von);

-- ── OFFERTEN ────────────────────────────────────────────────
create table public.offerten (
  id                uuid primary key default uuid_generate_v4(),
  ticket_id         uuid not null references public.tickets(id) on delete cascade,
  dienstleister_id  uuid not null references public.profiles(id),
  betrag            numeric(10,2) not null,
  beschreibung      text not null,
  verfuegbar_ab     date not null,
  garantie_monate   integer,
  status            text not null default 'eingegangen' check (status in (
    'eingegangen','akzeptiert','abgelehnt','zurueckgezogen'
  )),
  versiegelt_at     timestamptz not null default now(),
  created_at        timestamptz not null default now()
);

create index idx_offerten_ticket on public.offerten(ticket_id);
create index idx_offerten_dienstleister on public.offerten(dienstleister_id);

-- Prevent editing after versiegelt (immutable offers)
create or replace function check_offerte_immutable()
returns trigger as $$
begin
  if old.versiegelt_at is not null and (new.betrag <> old.betrag or new.beschreibung <> old.beschreibung) then
    raise exception 'Versiegelte Offerten können nicht geändert werden';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger offerte_immutable before update on public.offerten
  for each row execute procedure check_offerte_immutable();

-- ── ESCROW ──────────────────────────────────────────────────
create table public.escrows (
  id                      uuid primary key default uuid_generate_v4(),
  ticket_id               uuid not null references public.tickets(id),
  offerte_id              uuid not null references public.offerten(id),
  verwalter_id            uuid not null references public.profiles(id),
  dienstleister_id        uuid not null references public.profiles(id),
  betrag                  numeric(10,2) not null,
  provision_prozent       numeric(4,2) not null default 6.0,
  provision_betrag        numeric(10,2) not null,
  status                  text not null default 'ausstehend' check (status in (
    'ausstehend','einbezahlt','in_ausfuehrung','abgeschlossen','zurueckerstattet','streit'
  )),
  stripe_payment_intent_id text,
  einbezahlt_at           timestamptz,
  freigegeben_at          timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create trigger escrows_updated_at before update on public.escrows
  for each row execute procedure update_updated_at();

create index idx_escrows_ticket on public.escrows(ticket_id);
create index idx_escrows_verwalter on public.escrows(verwalter_id);
create index idx_escrows_status on public.escrows(status);

-- ── NEBENKOSTEN ─────────────────────────────────────────────
create table public.nebenkostenpositionen (
  id                uuid primary key default uuid_generate_v4(),
  liegenschaft_id   uuid not null references public.liegenschaften(id) on delete cascade,
  jahr              integer not null,
  bezeichnung       text not null,
  betrag_total      numeric(10,2) not null,
  verteilschluessel text not null default 'flaeche' check (verteilschluessel in ('flaeche','kopf','gleich')),
  created_at        timestamptz not null default now()
);

create table public.nebenkostenabrechnungen (
  id              uuid primary key default uuid_generate_v4(),
  wohnung_id      uuid not null references public.wohnungen(id),
  liegenschaft_id uuid not null references public.liegenschaften(id),
  jahr            integer not null,
  akonto_total    numeric(10,2) not null default 0,
  kosten_total    numeric(10,2) not null default 0,
  differenz       numeric(10,2) generated always as (akonto_total - kosten_total) stored,
  status          text not null default 'entwurf' check (status in ('entwurf','versendet','bezahlt')),
  erstellt_at     timestamptz not null default now(),
  versendet_at    timestamptz
);

-- ── DIENSTLEISTER PROFILE ───────────────────────────────────
create table public.dienstleister_profile (
  id                   uuid primary key default uuid_generate_v4(),
  profile_id           uuid not null references public.profiles(id) on delete cascade unique,
  kategorien           text[] not null default '{}',
  beschreibung         text,
  webseite             text,
  zertifikate          text[],
  bewertung_schnitt    numeric(2,1) not null default 0,
  anzahl_bewertungen   integer not null default 0,
  abo_aktiv            boolean not null default false,
  abo_typ              text not null default 'basic' check (abo_typ in ('basic','premium')),
  verified             boolean not null default false,
  created_at           timestamptz not null default now()
);

-- ── BEWERTUNGEN ─────────────────────────────────────────────
create table public.bewertungen (
  id                uuid primary key default uuid_generate_v4(),
  ticket_id         uuid not null references public.tickets(id),
  dienstleister_id  uuid not null references public.profiles(id),
  bewerter_id       uuid not null references public.profiles(id),
  sterne            integer not null check (sterne between 1 and 5),
  kommentar         text,
  created_at        timestamptz not null default now(),
  unique(ticket_id, bewerter_id)
);

-- Update dienstleister rating after new review
create or replace function update_dienstleister_rating()
returns trigger as $$
begin
  update public.dienstleister_profile
  set
    bewertung_schnitt = (select avg(sterne) from public.bewertungen where dienstleister_id = new.dienstleister_id),
    anzahl_bewertungen = (select count(*) from public.bewertungen where dienstleister_id = new.dienstleister_id)
  where profile_id = new.dienstleister_id;
  return new;
end;
$$ language plpgsql;

create trigger after_bewertung_insert after insert on public.bewertungen
  for each row execute procedure update_dienstleister_rating();

-- ── ROW LEVEL SECURITY ──────────────────────────────────────
alter table public.profiles enable row level security;
alter table public.liegenschaften enable row level security;
alter table public.wohnungen enable row level security;
alter table public.tickets enable row level security;
alter table public.offerten enable row level security;
alter table public.escrows enable row level security;
alter table public.nebenkostenpositionen enable row level security;
alter table public.nebenkostenabrechnungen enable row level security;
alter table public.dienstleister_profile enable row level security;
alter table public.bewertungen enable row level security;

-- Profiles: users can see their own, verwalter can see mieter profiles
create policy "profiles_self" on public.profiles
  for all using (auth.uid() = id);

create policy "profiles_verwalter_read" on public.profiles
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('verwalter','admin'))
  );

-- Liegenschaften: only own
create policy "liegenschaften_owner" on public.liegenschaften
  for all using (verwalter_id = auth.uid());

-- Wohnungen: via liegenschaft ownership
create policy "wohnungen_owner" on public.wohnungen
  for all using (
    exists (select 1 from public.liegenschaften l where l.id = liegenschaft_id and l.verwalter_id = auth.uid())
    or mieter_id = auth.uid()
  );

-- Tickets: ersteller or verwalter of liegenschaft or any dienstleister (to see ausgeschriebene)
create policy "tickets_owner" on public.tickets
  for all using (
    erstellt_von = auth.uid()
    or exists (select 1 from public.liegenschaften l where l.id = liegenschaft_id and l.verwalter_id = auth.uid())
  );

create policy "tickets_dienstleister_read" on public.tickets
  for select using (
    exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'dienstleister')
    and status in ('ausgeschrieben','offerten_eingegangen')
  );

-- Offerten: own or ticket owner
create policy "offerten_dienstleister" on public.offerten
  for all using (dienstleister_id = auth.uid());

create policy "offerten_verwalter_read" on public.offerten
  for select using (
    exists (
      select 1 from public.tickets t
      join public.liegenschaften l on l.id = t.liegenschaft_id
      where t.id = ticket_id and l.verwalter_id = auth.uid()
    )
  );

-- Escrows: own
create policy "escrows_own" on public.escrows
  for all using (verwalter_id = auth.uid() or dienstleister_id = auth.uid());

-- Nebenkosten: own liegenschaft
create policy "nebkosten_owner" on public.nebenkostenpositionen
  for all using (
    exists (select 1 from public.liegenschaften l where l.id = liegenschaft_id and l.verwalter_id = auth.uid())
  );

create policy "nebkabrechnungen_owner" on public.nebenkostenabrechnungen
  for all using (
    exists (select 1 from public.liegenschaften l where l.id = liegenschaft_id and l.verwalter_id = auth.uid())
  );

-- Dienstleister profile: own + public read
create policy "dl_profile_own" on public.dienstleister_profile
  for all using (profile_id = auth.uid());

create policy "dl_profile_public_read" on public.dienstleister_profile
  for select using (true);

-- Bewertungen: bewerter or subject
create policy "bewertungen_own" on public.bewertungen
  for all using (bewerter_id = auth.uid() or dienstleister_id = auth.uid());

-- ── DEMO DATA ────────────────────────────────────────────────
-- Run this AFTER creating demo users in Supabase Auth Dashboard:
-- verwalter@demo.ch / demo1234 (role: verwalter)
-- mieter@demo.ch / demo1234 (role: mieter)
-- dienst@demo.ch / demo1234 (role: dienstleister)

-- Insert demo liegenschaft (replace UUID with actual verwalter user ID)
-- insert into public.liegenschaften (verwalter_id, name, strasse, hausnummer, plz, ort, kanton, baujahr, anzahl_wohnungen, objekttyp)
-- values ('<VERWALTER_UUID>', 'Parkstrasse 12', 'Parkstrasse', '12', '8001', 'Zürich', 'ZH', 1978, 10, 'MFH');
