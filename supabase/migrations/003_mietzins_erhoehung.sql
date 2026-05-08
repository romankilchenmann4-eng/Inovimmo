-- ============================================================
-- Inovimmo — Migration v3
-- Mietzinserhöhung nach Schweizer Mietrecht (Art. 269a OR / Art. 14 VMWG)
-- ============================================================

-- ── MIETZINSERHOEHUNGEN ─────────────────────────────────────
-- Eine Berechnung pro Liegenschaft & Investition (z.B. Heizungsersatz)
create table public.mietzins_erhoehungen (
  id                       uuid primary key default uuid_generate_v4(),
  liegenschaft_id          uuid not null references public.liegenschaften(id) on delete cascade,
  verwalter_id             uuid not null references public.profiles(id) on delete cascade,

  -- Stammdaten
  titel                    text not null,
  grund                    text not null default 'heizungsersatz' check (grund in (
    'heizungsersatz', 'renovation', 'wertvermehrend_sonstiges'
  )),

  -- Investition
  investition_total        numeric(12,2) not null default 0,
  foerderbeitraege         numeric(12,2) not null default 0,
  wertvermehrend_prozent   numeric(5,2) not null default 60,

  -- Sätze (alle in %)
  referenzzinssatz         numeric(4,2) not null default 1.50,
  zuschlag                 numeric(4,2) not null default 0.50,
  amortisation_prozent     numeric(4,2) not null default 5.00,
  unterhalt_prozent        numeric(4,2) not null default 1.00,

  -- Berechnete Werte (cached für Performance)
  netto_investition        numeric(12,2) generated always as (investition_total - foerderbeitraege) stored,
  jahressatz_total         numeric(5,2) generated always as (
    referenzzinssatz + zuschlag + amortisation_prozent + unterhalt_prozent
  ) stored,

  -- Status
  status                   text not null default 'entwurf' check (status in (
    'entwurf', 'berechnet', 'versendet', 'angefochten', 'aktiv'
  )),
  inkrafttreten            date,

  -- Begründungstext fürs amtliche Formular
  begruendung_text         text,

  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);

create trigger mietzins_erhoehungen_updated_at before update on public.mietzins_erhoehungen
  for each row execute procedure update_updated_at();

create index idx_mietzins_erhoehungen_liegenschaft on public.mietzins_erhoehungen(liegenschaft_id);
create index idx_mietzins_erhoehungen_verwalter on public.mietzins_erhoehungen(verwalter_id);
create index idx_mietzins_erhoehungen_status on public.mietzins_erhoehungen(status);

-- ── MIETZINSERHOEHUNG POSITIONEN ────────────────────────────
-- Pro Wohnung der Liegenschaft eine Position
create table public.mietzins_erhoehung_positionen (
  id                       uuid primary key default uuid_generate_v4(),
  mietzins_erhoehung_id    uuid not null references public.mietzins_erhoehungen(id) on delete cascade,
  wohnung_id               uuid not null references public.wohnungen(id) on delete cascade,

  -- Beheizt-Flag (Bastelräume, Parkplätze etc. evtl. nicht beheizt → keine Erhöhung)
  beheizt                  boolean not null default true,

  -- Berechnete Werte (werden via Server Action gespeichert)
  anteil_prozent           numeric(7,4),
  monatliche_erhoehung     numeric(10,2),
  neuer_nettomietzins      numeric(10,2),

  -- Versand-Tracking
  versendet_at             timestamptz,
  versand_methode          text check (versand_methode in ('einschreiben', 'a_post', 'email', 'manuell')),
  bestaetigt_at            timestamptz,

  created_at               timestamptz not null default now(),

  unique(mietzins_erhoehung_id, wohnung_id)
);

create index idx_positionen_erhoehung on public.mietzins_erhoehung_positionen(mietzins_erhoehung_id);
create index idx_positionen_wohnung on public.mietzins_erhoehung_positionen(wohnung_id);

-- ── ROW LEVEL SECURITY ──────────────────────────────────────
alter table public.mietzins_erhoehungen enable row level security;
alter table public.mietzins_erhoehung_positionen enable row level security;

-- Verwalter: volle Rechte auf eigene Erhöhungen
create policy "mietzins_erhoehungen_owner" on public.mietzins_erhoehungen
  for all using (verwalter_id = auth.uid());

-- Mieter: lesender Zugriff auf Positionen, die ihre Wohnung betreffen
create policy "mietzins_erhoehungen_mieter_read" on public.mietzins_erhoehungen
  for select using (
    exists (
      select 1 from public.mietzins_erhoehung_positionen p
      join public.wohnungen w on w.id = p.wohnung_id
      where p.mietzins_erhoehung_id = mietzins_erhoehungen.id
        and w.mieter_id = auth.uid()
        and mietzins_erhoehungen.status in ('versendet', 'angefochten', 'aktiv')
    )
  );

-- Positionen: via Erhöhung-Owner
create policy "positionen_owner" on public.mietzins_erhoehung_positionen
  for all using (
    exists (
      select 1 from public.mietzins_erhoehungen e
      where e.id = mietzins_erhoehung_id and e.verwalter_id = auth.uid()
    )
  );

-- Mieter: lesender Zugriff auf eigene Position
create policy "positionen_mieter_read" on public.mietzins_erhoehung_positionen
  for select using (
    exists (
      select 1 from public.wohnungen w
      where w.id = wohnung_id and w.mieter_id = auth.uid()
    )
  );
