import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isCronAuthorized } from "@/lib/automation/server";

export const dynamic = "force-dynamic";

// Cron job: Runs on February 1st at 06:00 to remind about NK settlements
// Finds all settlements in "berechnet" status and marks them as ready for review
// Does NOT auto-send — that requires human review (Einschreiben)
export async function POST(req: NextRequest) {
  // Verify cron authorization
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createAdminClient();
  if (!supabase) {
    return NextResponse.json({ error: "Admin access required" }, { status: 500 });
  }

  // Find all settlements in "berechnet" status
  const { data: abrechnungen, error } = await supabase
    .from("nebenkostenabrechnungen")
    .select("id, jahr, liegenschaft_id, wohnung_id, status")
    .eq("status", "berechnet");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!abrechnungen || abrechnungen.length === 0) {
    return NextResponse.json({ message: "Keine Abrechnungen im Status 'berechnet' gefunden", count: 0 });
  }

  // Log to automation_runs
  const { data: runData, error: runError } = await supabase
    .from("automation_runs")
    .insert({
      job_name: "nk-abrechnung",
      status: "success",
      trigger: "cron",
      summary_json: { found: abrechnungen.length, message: "Abrechnungen im Status 'berechnet' bereit zum Versand" },
    })
    .select("id")
    .single();

  return NextResponse.json({
    message: "NK-Abrechnungs-Cron ausgeführt",
    found: abrechnungen.length,
    abrechnungen: abrechnungen.map((a: any) => ({
      id: a.id,
      jahr: a.jahr,
      status: a.status,
    })),
    note: "Abrechnungen im Status 'berechnet' müssen manuell versendet werden (Einschreiben)",
  });
}

export async function GET() {
  return POST(new NextRequest("https://cron.internal/nk-abrechnung", { method: "POST" }));
}