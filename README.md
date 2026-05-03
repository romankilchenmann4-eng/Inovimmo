# 🏛 Inovimmo — Swiss Property Intelligence

Die erste kostenlose, vollintegrierte Immobilienverwaltungsplattform der Schweiz.

---

## 🚀 Setup in 15 Minuten

### 1. Voraussetzungen
- Node.js 18+ (https://nodejs.org)
- Git (https://git-scm.com)
- Supabase Account (https://supabase.com) — kostenlos
- Vercel Account (https://vercel.com) — kostenlos

---

### 2. Projekt lokal starten

```bash
# ZIP entpacken oder ins Verzeichnis wechseln
cd inovimmo

# Abhängigkeiten installieren
npm install

# Umgebungsvariablen einrichten
cp .env.local.example .env.local
# .env.local mit deinen Supabase-Keys ausfüllen (siehe Schritt 3)

# Entwicklungsserver starten
npm run dev
# → http://localhost:3000
```

---

### 3. Supabase einrichten

1. Gehe zu https://supabase.com → "New Project"
2. **Settings → API** → kopiere:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Füge diese Werte in `.env.local` ein

**Datenbank-Migration ausführen:**
1. Supabase Dashboard → **SQL Editor**
2. Inhalt von `supabase/migrations/001_initial.sql` einfügen
3. **Run** klicken

**Demo-User anlegen:**
1. Supabase Dashboard → **Authentication → Users → Add User**
2. Folgende 3 User anlegen:
   - `verwalter@demo.ch` / `demo1234`
   - `mieter@demo.ch` / `demo1234`
   - `dienst@demo.ch` / `demo1234`
3. Die User-UUIDs findest du in Authentication → Users
4. Im SQL Editor: Demo-Daten mit den UUIDs einfügen (letzte Zeile der Migration)

---

### 4. Auf Vercel deployen (5 Minuten)

```bash
# Vercel CLI installieren
npm install -g vercel

# Deployen
vercel

# Umgebungsvariablen setzen
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
```

Oder: Vercel Dashboard → **Import Git Repository** → Umgebungsvariablen unter Settings → Environment Variables

---

### 5. PWA (Mobile App) einrichten

Die App ist bereits PWA-ready. Auf iOS/Android:
1. Website im Safari/Chrome öffnen
2. "Zum Home-Bildschirm hinzufügen"
3. App-Icon erscheint wie eine native App

---

## 📁 Projektstruktur

```
inovimmo/
├── src/
│   ├── app/
│   │   ├── auth/           # Login, Register
│   │   ├── dashboard/      # Alle Dashboard-Seiten
│   │   │   ├── page.tsx    # Dashboard Übersicht
│   │   │   ├── objekte/    # Liegenschaften & Wohnungen
│   │   │   ├── tickets/    # Ticket-System
│   │   │   ├── offerten/   # Offerten-Vergleich
│   │   │   ├── escrow/     # Zahlungen & Escrow
│   │   │   ├── nebkosten/  # Nebenkostenabrechnung
│   │   │   ├── mieter/     # Mieter-Portal
│   │   │   ├── dienstleister/ # Dienstleister-Bereich
│   │   │   └── marktplatz/ # Services
│   │   └── api/            # API Routes
│   ├── components/
│   │   ├── layout/         # Sidebar, Topbar
│   │   ├── tickets/        # Ticket-Komponenten
│   │   ├── objekte/        # Objekt-Komponenten
│   │   └── escrow/         # Escrow-Komponenten
│   ├── lib/
│   │   └── supabase/       # Client, Server, Middleware
│   ├── types/              # TypeScript Typen
│   └── hooks/              # React Hooks
├── supabase/
│   └── migrations/         # SQL Migrations
└── public/                 # Statische Assets
```

---

## 🔑 Tech Stack

| Layer | Technologie | Warum |
|-------|------------|-------|
| Frontend | Next.js 15 + React 19 | SSR, SEO, Performance |
| Styling | Tailwind CSS | Schnell, konsistent |
| Backend | Supabase | PostgreSQL + Auth + Storage |
| Payments | Stripe + TWINT | CH-Zahlungsmethoden |
| Hosting | Vercel | Zero-config, Edge |
| Mobile | PWA (React Native geplant) | Shared Codebase |

---

## 💰 Kosten bis Launch

| Service | Plan | Kosten |
|---------|------|--------|
| Supabase | Free (500MB, 50K users) | CHF 0 |
| Vercel | Hobby | CHF 0 |
| Stripe | 1.5% + 0.25 CHF/Transaktion | ~CHF 0 bis erste Zahlung |
| Domain (inovimmo.ch) | | ~CHF 15/Jahr |
| **Total** | | **~CHF 15/Jahr** |

---

## 🗺️ Roadmap

### Phase 1 — MVP (jetzt)
- [x] Auth (Login, Register, Rollen)
- [x] Dashboard mit Statistiken
- [x] Liegenschaften & Wohnungen
- [x] Ticket-System
- [x] Offerten-System
- [x] Escrow-Grundstruktur
- [x] Nebenkostenabrechnung Grundgerüst
- [x] Mieter-Portal
- [x] Dienstleister-Dashboard

### Phase 2 (Monat 2-3)
- [ ] Stripe-Integration (echte Zahlung)
- [ ] TWINT-Integration
- [ ] Dokumenten-Upload (Supabase Storage)
- [ ] E-Mail-Benachrichtigungen (Resend)
- [ ] PDF-Export Nebenkostenabrechnung
- [ ] KI-Anomalie-Erkennung

### Phase 3 (Monat 4-6)
- [ ] React Native App (iOS/Android)
- [ ] Versicherungs-Integration
- [ ] Hypotheken-Vergleich
- [ ] Mieter-Screening API

---

## 📞 Kontakt

**Roman Kilchenmann**
r.kilchenmann@gmx.ch
Zürich, Schweiz

---

*Inovimmo — Swiss Property Intelligence*
*© 2026 — Kostenlos für Verwalter, finanziert durch Dienstleister-Provisionen*
