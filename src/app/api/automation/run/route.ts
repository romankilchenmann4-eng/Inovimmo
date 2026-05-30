import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { AutomationJobName } from "@/lib/automation/server";

// Import handlers directly instead of self-HTTP-call
import { POST as mahnungenHandler } from "@/app/api/cron/mahnungen/route";
import { POST as monatssollHandler } from "@/app/api/cron/monatssoll/route";

const JOB_HANDLERS: Record<string, ((req: NextRequest) => Promise<NextResponse>) | null> = {
  monatssoll: monatssollHandler,
  mahnungen: mahnungenHandler,
  // These handlers may not exist yet — fall back to HTTP call
  "vertrag-reminder": null,
  "nk-abrechnung": null,
};

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { job } = (await req.json()) as { job?: AutomationJobName };

  if (!job || !(job in JOB_HANDLERS)) {
    return NextResponse.json({ error: "Unbekannter Job." }, { status: 400 });
  }

  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET fehlt." }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["admin", "verwalter"].includes(profile.role)) {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
  }

  const handler = JOB_HANDLERS[job];

  if (handler) {
    // Direct function call — no HTTP overhead
    const cronReq = new Request(req.url, {
      method: "POST",
      headers: {
        authorization: `Bearer ${secret}`,
        "x-inovimmo-trigger": "manual",
      },
    }) as NextRequest;

    return handler(cronReq);
  }

  // Fallback: self-HTTP-call for handlers not yet migrated
  const JOB_PATHS: Record<string, string> = {
    "vertrag-reminder": "/api/cron/vertrag-reminder",
    "nk-abrechnung": "/api/cron/nk-abrechnung",
  };

  const path = JOB_PATHS[job];
  if (!path) {
    return NextResponse.json({ error: "Job-Handler nicht gefunden." }, { status: 400 });
  }

  const response = await fetch(new URL(path, req.nextUrl.origin), {
    method: "POST",
    headers: {
      authorization: `Bearer ${secret}`,
      "x-inovimmo-trigger": "manual",
    },
    cache: "no-store",
  });

  const data = await response.json().catch(() => ({}));
  return NextResponse.json(data, { status: response.status });
}