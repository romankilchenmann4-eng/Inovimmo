# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Inovimmo is a Next.js 15 SaaS platform for Swiss property management (rental contracts, rent increases, accounting, tenant management). Built with React 19, TypeScript, Tailwind CSS, shadcn/ui, and Supabase.

## Commands

```bash
npm run dev          # Start dev server (http://localhost:3000)
npm run build        # Production build
npm run start        # Start production server
npm run lint         # ESLint
```

## Architecture

**Stack:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, shadcn/ui, Supabase (Auth + Postgres), Stripe (Escrow), Resend (Emails), Ollama (AI)

**Key patterns:**
- Server Components by default; client components marked with `"use client"`
- Supabase SSR auth via middleware (`src/middleware.ts`) — auth state propagated to RSC via cookies
- Route handlers in `app/api/**/route.ts` for server-side logic
- Cron jobs via Vercel (`vercel.json`) hitting `/api/cron/*` endpoints with `CRON_SECRET` protection

**Directory structure:**
```
src/
  app/               # App Router pages + API routes
  components/        # UI components (layout, forms, feature-specific)
  lib/               # Utilities: supabase clients, email, stripe, calculations
  types/             # Shared TypeScript types
supabase/migrations/ # Database schema migrations
```

**Auth flow:**
1. Middleware protects routes (redirects unauthenticated users to `/auth/login`)
2. Auth callbacks handled at `/api/auth/callback`
3. Server-side Supabase client (`src/lib/supabase/server.ts`) for RSC/route handlers
4. Browser client (`src/lib/supabase/client.ts`) for client components

**Key features:**
- Rent increase calculations (`src/lib/mietzinserhoehung/`)
- QR-Rechnung generation (`/api/qr-rechnung`)
- Annual report generation (`/api/jahresbericht`)
- Tenant screening (`/dashboard/screening`)
- Escrow payments via Stripe
- AI chat assistant (`/api/ai/chat`)

## Environment

Copy `.env.local` for local development. Production uses `.env.production` or Vercel environment variables.

Key services:
- **Supabase:** Auth + database (see `supabase/migrations/`)
- **Stripe:** Escrow checkout + webhooks
- **Resend:** Transactional emails
- **Ollama:** AI API for chat/analysis
- **Hostpoint FTP:** Document storage (FTP upload via `src/lib/email.ts`)

## Database

Migrations live in `supabase/migrations/`. Schema includes tables for users, properties (`objekte`), apartments (`wohnungen`), tenants (`mieter`), contracts (`mietvertraege`), rent increases (`mietzinserhoehungen`), tickets, and more.

## Testing

No test suite currently configured. Manual testing via dev server.
