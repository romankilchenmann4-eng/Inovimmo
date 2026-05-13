-- ============================================================
-- Inovimmo — Migration v5
-- Buchhaltung: Buchungen, Mietkonten, Mahnungen
-- ============================================================

-- ── BUCHUNGEN ────────────────────────────────────────────────
-- Jede Mietzahlung / Gutschrift / Belastung als Buchungssatz
create table if not exists public.buchungen (
  id                uuid primary key default uuid_generate_v4(),
  verwalter_id      uuid not null references public.profiles(id) on delete cascade,
  wohnung_id        uuid references public.wohnungen(id) on delete set null,
  liegenschaft_id   uuid references public.liegenschaften(id) on delete set null,
  mieter_id         uuid references public.mieter(id) on delete set null,

  -- Buchungstyp
  typ               text not null check (typ in (
    'miete_soll',       -- monatliche Miete (Belastung)
    'miete_zahlung',    -- Mieteingang (Gutschrift)
    'nk_soll',          -- NK-Nachzahlung Soll
    'nk_rueckerstattung', -- NK-Rückerstattung
    'kaution_eingang',  -- Kautionszahlung
    'sonstiges_soll',   -- sonstige Belastung
    'sonstiges_haben'   -- sonstige Gutschrift
  )),

  buchungstext      text not null,
  betrag            numeric(10,2) not null,  -- immer positiv
  valuta            date not null,           -- Wertstellungsdatum
  periode_monat     integer,                 -- 1–12
  periode_jahr      integer,
  referenz          text,                    -- z.B. QR-Referenz
  notiz             text,
  manuell           boolean not null default true,
  created_at        timestamptz not null default now()
);

create index idx_buchungen_wohnung on public.buchungen(wohnung_id);
create index idx_buchungen_verwalter on public.buchungen(verwalter_id);
create index idx_buchungen_valuta on public.buchungen(valuta);

alter table public.buchungen enable row level security;
create policy "buchungen_owner" on public.buchungen
  for all using (verwalter_id = auth.uid());

-- ── MAHNUNGEN ────────────────────────────────────────────────
create table if not exists public.mahnungen (
  id                uuid primary key default uuid_generate_v4(),
  verwalter_id      uuid not null references public.profiles(id) on delete cascade,
  wohnung_id        uuid not null references public.wohnungen(id) on delete cascade,
  mieter_id         uuid references public.mieter(id),
  stufe             integer not null default 1 check (stufe between 1 and 3),
  offener_betrag    numeric(10,2) not null,
  periode           text not null,   -- z.B. "2025-01"
  versendet_at      timestamptz,
  bezahlt_at        timestamptz,
  status            text not null default 'offen' check (status in ('offen','bezahlt','storniert')),
  created_at        timestamptz not null default now()
);

create index idx_mahnungen_wohnung on public.mahnungen(wohnung_id);
create index idx_mahnungen_verwalter on public.mahnungen(verwalter_id);

alter table public.mahnungen enable row level security;
create policy "mahnungen_owner" on public.mahnungen
  for all using (verwalter_id = auth.uid());

-- ── BANKKONTEN (für spätere Bankintegration) ─────────────────
create table if not exists public.bankkonten (
  id              uuid primary key default uuid_generate_v4(),
  verwalter_id    uuid not null references public.profiles(id) on delete cascade,
  bezeichnung     text not null,
  iban            text not null,
  qr_iban         text,
  bank_name       text,
  waehrung        text not null default 'CHF',
  aktiv           boolean not null default true,
  created_at      timestamptz not null default now()
);

alter table public.bankkonten enable row level security;
create policy "bankkonten_owner" on public.bankkonten
  for all using (verwalter_id = auth.uid());
