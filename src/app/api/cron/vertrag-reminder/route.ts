import { NextRequest, NextResponse } from "next/server";
import { sendVertragAblauf } from "@/lib/email";
import {
  finishAutomationRun,
  getAutomationAdminClient,
  getAutomationTrigger,
  isCronAuthorized,
  startAutomationRun,
} from "@/lib/automation/server";

export const dynamic = "force-dynamic";

/**
 * Monatlicher Vertrag-Ablauf-Reminder
 *
 * Läuft am 1. des Monats um 07:30 Uhr.
 * Informiert Verwalter über Mietverhältnisse, die in 30–60 Tagen enden.
 */
export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getAutomationAdminClient();
  const run = await startAutomationRun(supabase, "vertrag-reminder", getAutomationTrigger(req));

  try {
  const today = new Date();
  const in30 = new Date(today); in30.setDate(in30.getDate() + 30);
  const in60 = new Date(today); in60.setDate(in60.getDate() + 60);

  // Find mietverhaeltnisse ending in 30–60 days, reminder not yet sent
  const { data: ablaufend, error } = await supabase
    .from("mietverhaeltnisse")
    .select(`
      id, mietende, mietbeginn, ablauf_reminder_sent,
      wohnung:wohnungen(
        id, bezeichnung,
        liegenschaft:liegenschaften(name, verwalter_id)
      ),
      mieter:mieter(vorname, nachname, email)
    `)
    .eq("ablauf_reminder_sent", false)
    .not("mietende", "is", null)
    .gte("mietende", in30.toISOString().split("T")[0])
    .lte("mietende", in60.toISOString().split("T")[0]);

  if (error) {
    await finishAutomationRun(supabase, run, "failed", {}, error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!ablaufend?.length) {
    const summary = { message: "Keine ablaufenden Verträge im Fenster 30–60 Tage", verarbeitet: 0 };
    await finishAutomationRun(supabase, run, "success", summary);
    return NextResponse.json(summary);
  }

  // Batch-fetch all verwalter profiles to avoid N+1 queries
  const verwalterIds = [...new Set(
    ablaufend
      .map((mv: any) => (mv.wohnung as any)?.liegenschaft?.verwalter_id)
      .filter(Boolean)
  )];
  const { data: verwalterProfiles } = await supabase
    .from("profiles")
    .select("id, full_name, email")
    .in("id", verwalterIds);
  const profileMap = new Map((verwalterProfiles ?? []).map((p: any) => [p.id, p]));

  let verarbeitet = 0;

  for (const mv of ablaufend) {
    const wohnung = mv.wohnung as unknown as {
      bezeichnung: string;
      liegenschaft: { name: string; verwalter_id: string } | null;
    } | null;
    const mieter = mv.mieter as unknown as { vorname: string; nachname: string; email: string | null } | null;

    if (!wohnung?.liegenschaft?.verwalter_id) continue;

    const verwalterProfile = profileMap.get(wohnung.liegenschaft.verwalter_id);

    let emailSent = false;
    if (verwalterProfile?.email) {
      try {
        await sendVertragAblauf({
          to: verwalterProfile.email,
          verwalterName: verwalterProfile.full_name ?? "Verwalter",
          mieterName: mieter ? `${mieter.vorname} ${mieter.nachname}` : "Unbekannt",
          wohnung: wohnung.bezeichnung,
          liegenschaft: wohnung.liegenschaft.name,
          mietende: mv.mietende as string,
          mietbeginn: mv.mietbeginn as string,
        });
        emailSent = true;
      } catch (emailErr) {
        console.error("Vertrag-reminder email error:", emailErr);
      }
    }

    // Only mark as sent if email was actually delivered
    if (emailSent) {
      await supabase
        .from("mietverhaeltnisse")
        .update({ ablauf_reminder_sent: true })
        .eq("id", mv.id);
    }

    verarbeitet++;
  }

  const summary = {
    message: "Vertrag-Reminder abgeschlossen",
    verarbeitet,
    timestamp: new Date().toISOString(),
  };
  await finishAutomationRun(supabase, run, "success", summary);
  return NextResponse.json(summary);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Vertrag-Reminder fehlgeschlagen";
    await finishAutomationRun(supabase, run, "failed", {}, message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  return POST(req);
}
