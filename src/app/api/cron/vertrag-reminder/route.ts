import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { sendVertragAblauf } from "@/lib/email";

export const dynamic = "force-dynamic";

function getAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function checkAuth(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  return token === secret;
}

/**
 * Monatlicher Vertrag-Ablauf-Reminder
 *
 * Läuft am 1. des Monats um 07:30 Uhr.
 * Informiert Verwalter über Mietverhältnisse, die in 30–60 Tagen enden.
 */
export async function POST(req: NextRequest) {
  if (!checkAuth(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = getAdminClient();
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
        liegenschaft:liegenschaften(name, verwalter_id,
          verwalter:profiles(full_name, email:profiles(id))
        )
      ),
      mieter:mieter(vorname, nachname, email)
    `)
    .eq("ablauf_reminder_sent", false)
    .not("mietende", "is", null)
    .gte("mietende", in30.toISOString().split("T")[0])
    .lte("mietende", in60.toISOString().split("T")[0]);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!ablaufend?.length) {
    return NextResponse.json({ message: "Keine ablaufenden Verträge im Fenster 30–60 Tage", verarbeitet: 0 });
  }

  let verarbeitet = 0;

  for (const mv of ablaufend) {
    const wohnung = mv.wohnung as unknown as {
      bezeichnung: string;
      liegenschaft: { name: string; verwalter_id: string } | null;
    } | null;
    const mieter = mv.mieter as unknown as { vorname: string; nachname: string; email: string | null } | null;

    if (!wohnung?.liegenschaft?.verwalter_id) continue;

    // Get verwalter email
    const { data: verwalterProfile } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", wohnung.liegenschaft.verwalter_id)
      .single();

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
      } catch (emailErr) {
        console.error("Vertrag-reminder email error:", emailErr);
      }
    }

    // Mark reminder as sent
    await supabase
      .from("mietverhaeltnisse")
      .update({ ablauf_reminder_sent: true })
      .eq("id", mv.id);

    verarbeitet++;
  }

  return NextResponse.json({
    message: "Vertrag-Reminder abgeschlossen",
    verarbeitet,
    timestamp: new Date().toISOString(),
  });
}
