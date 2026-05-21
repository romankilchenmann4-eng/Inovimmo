import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { AutomationJobName } from "@/lib/automation/server";

const JOB_PATHS: Record<AutomationJobName, string> = {
  monatssoll: "/api/cron/monatssoll",
  mahnungen: "/api/cron/mahnungen",
  "vertrag-reminder": "/api/cron/vertrag-reminder",
  "nk-abrechnung": "/api/cron/nk-abrechnung",
};

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const { job } = (await req.json()) as { job?: AutomationJobName };

  if (!job || !(job in JOB_PATHS)) {
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

  const response = await fetch(new URL(JOB_PATHS[job], req.nextUrl.origin), {
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
