import { NextRequest, NextResponse } from "next/server";
import { getAutomationAdminClient, isCronAuthorized, startAutomationRun, finishAutomationRun, getAutomationTrigger } from "@/lib/automation/server";

export const dynamic = "force-dynamic";

// Cron job: Runs on February 1st at 06:00 to remind about NK settlements
// Finds all settlements in "berechnet" status and marks them as ready for review
// Does NOT auto-send — that requires human review (Einschreiben)
export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getAutomationAdminClient();
  const trigger = getAutomationTrigger(req);
  const run = await startAutomationRun(supabase, "nk-abrechnung", trigger);

  try {
    // Find all settlements in "berechnet" status
    const { data: abrechnungen, error } = await supabase
      .from("nebenkostenabrechnungen")
      .select("id, jahr, liegenschaft_id, wohnung_id, status")
      .eq("status", "berechnet");

    if (error) {
      await finishAutomationRun(supabase, run, "failed", { error: error.message }, error.message);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!abrechnungen || abrechnungen.length === 0) {
      await finishAutomationRun(supabase, run, "success", { found: 0, message: "Keine Abrechnungen im Status 'berechnet' gefunden" });
      return NextResponse.json({ message: "Keine Abrechnungen im Status 'berechnet' gefunden", count: 0 });
    }

    await finishAutomationRun(supabase, run, "success", {
      found: abrechnungen.length,
      message: "Abrechnungen im Status 'berechnet' bereit zum Versand",
    });

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
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unbekannter Fehler";
    await finishAutomationRun(supabase, run, "failed", { error: message }, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}