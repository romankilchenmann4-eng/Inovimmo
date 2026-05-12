-- ============================================================
-- Inovimmo — Migration v6
-- Abonnements, Onboarding-Tokens, STWE
-- ============================================================

-- ── ABONNEMENTS (Stripe Subscriptions) ──────────────────────
create table if not exists public.abonnements (
  id                        uuid primary key default uuid_generate_v4(),
  verwalter_id              uuid not null references public.profiles(id) on delete cascade unique,
  stripe_customer_id        text,
  stripe_subscription_id    text,
  plan                      text not null default 'kostenlos'
                              check (plan in ('kostenlos','starter','professional','enterprise')),
  status                    text not null default 'aktiv'
                              check (status in ('aktiv','past_due','cancelled','trialing')),
  current_period_end        timestamptz,
  wohnungen_limit           integer not null default 5,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

alter table public.abonnements enable row level security;
create policy "abo_own" on public.abonnements for all using (verwalter_id = auth.uid());

-- ── ONBOARDING-TOKENS ───────────────────────────────────────
create table if not exists public.onboarding_tokens (
  id              uuid primary key default uuid_generate_v4(),
  token           text not null unique default encode(gen_random_bytes(32), 'hex'),
  wohnung_id      uuid not null references public.wohnungen(id) on delete cascade,
  verwalter_id    uuid not null references public.profiles(id),
  mieter_email    text not null,
  mieter_vorname  text,
  mieter_nachname text,
  mietbeginn      date,
  nettomiete      numeric(10,2),
  expires_at      timestamptz not null default (now() + interval '7 days'),
  used_at         timestamptz,
  created_at      timestamptz not null default now()
);

alter table public.onboarding_tokens enable row level security;
create policy "onboarding_verwalter" on public.onboarding_tokens
  for all using (verwalter_id = auth.uid());
-- Public read for token validation (token is secret)
create policy "onboarding_public_read" on public.onboarding_tokens
  for select using (true);

-- ── STWE (Stockwerkeigentümergemeinschaft) ───────────────────
create table if not exists public.stwe_gemeinschaften (
  id                  uuid primary key default uuid_generate_v4(),
  verwalter_id        uuid not null references public.profiles(id),
  name                text not null,
  strasse             text not null,
  hausnummer          text not null,
  plz                 text not null,
  ort                 text not null,
  anzahl_einheiten    integer not null default 0,
  grundbuchnummer     text,
  gruendungsjahr      integer,
  created_at          timestamptz not null default now()
);

create table if not exists public.stwe_einheiten (
  id                  uuid primary key default uuid_generate_v4(),
  gemeinschaft_id     uuid not null references public.stwe_gemeinschaften(id) on delete cascade,
  eigentuemer_id      uuid references public.profiles(id),
  bezeichnung         text not null,
  stockwerk           integer default 0,
  flaeche_m2          numeric(8,2),
  wertquote_prozent   numeric(5,2) not null default 0,
  created_at          timestamptz not null default now()
);

create table if not exists public.stwe_fonds (
  id                  uuid primary key default uuid_generate_v4(),
  gemeinschaft_id     uuid not null references public.stwe_gemeinschaften(id) on delete cascade,
  name                text not null,  -- "Erneuerungsfonds", "Betriebskostenfonds"
  saldo_chf           numeric(12,2) not null default 0,
  jahresbeitrag_chf   numeric(10,2) not null default 0,
  updated_at          timestamptz not null default now()
);

create table if not exists public.stwe_abstimmungen (
  id                  uuid primary key default uuid_generate_v4(),
  gemeinschaft_id     uuid not null references public.stwe_gemeinschaften(id) on delete cascade,
  titel               text not null,
  beschreibung        text,
  typ                 text not null default 'beschluss'
                        check (typ in ('beschluss','budget','sonstiges')),
  status              text not null default 'offen'
                        check (status in ('offen','angenommen','abgelehnt','vertagt')),
  datum               date not null,
  ja_stimmen          integer default 0,
  nein_stimmen        integer default 0,
  enthaltungen        integer default 0,
  created_at          timestamptz not null default now()
);

alter table public.stwe_gemeinschaften enable row level security;
alter table public.stwe_einheiten enable row level security;
alter table public.stwe_fonds enable row level security;
alter table public.stwe_abstimmungen enable row level security;

create policy "stwe_verwalter" on public.stwe_gemeinschaften for all using (verwalter_id = auth.uid());
create policy "stwe_einheiten_verwalter" on public.stwe_einheiten for all
  using (gemeinschaft_id in (select id from public.stwe_gemeinschaften where verwalter_id = auth.uid()));
create policy "stwe_fonds_verwalter" on public.stwe_fonds for all
  using (gemeinschaft_id in (select id from public.stwe_gemeinschaften where verwalter_id = auth.uid()));
create policy "stwe_abstimmungen_verwalter" on public.stwe_abstimmungen for all
  using (gemeinschaft_id in (select id from public.stwe_gemeinschaften where verwalter_id = auth.uid()));
