import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { nkVersandSubject, nkVersandHtml, nkVersandText } from "@/lib/nebenkostenabrechnung/email";
import { Resend } from "resend";
import type { BegleitschreibenTon } from "@/lib/nebenkostenabrechnung/types";

export const dynamic = "force-dynamic";

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { abrechnung_ids, versand_methode, email_betreff, send_email } = await req.json() as {
    abrechnung_ids: string[];
    versand_methode?: "einschreiben" | "a_post" | "email";
    email_betreff?: string;
    send_email?: boolean;
  };

  if (!abrechnung_ids || abrechnung_ids.length === 0) {
    return NextResponse.json({ error: "abrechnung_ids erforderlich" }, { status: 400 });
  }

  const methode = versand_methode ?? "einschreiben";
  const results: { id: string; status: string; error?: string }[] = [];

  for (const abrechnung_id of abrechnung_ids) {
    try {
      // Load abrechnung
      const { data: abrechnung, error: abrError } = await supabase
        .from("nebenkostenabrechnungen")
        .select("*")
        .eq("id", abrechnung_id)
        .single();

      if (abrError || !abrechnung) {
        results.push({ id: abrechnung_id, status: "error", error: "Abrechnung nicht gefunden" });
        continue;
      }

      // Load mieter for this wohnung
      const { data: mietverhaeltnisse } = await supabase
        .from("mietverhaeltnisse")
        .select("ist_hauptperson, mieter:mieter!inner(id, vorname, nachname, email, strasse, plz, ort)")
        .eq("wohnung_id", abrechnung.wohnung_id)
        .is("mietende", null);

      const hauptMieterData = mietverhaeltnisse?.find((mv: any) => mv.ist_hauptperson) ?? mietverhaeltnisse?.[0];
      const hauptMieter = hauptMieterData ? (Array.isArray(hauptMieterData.mieter) ? hauptMieterData.mieter[0] : hauptMieterData.mieter) : null;

      // Load wohnung and liegenschaft
      const { data: wohnung } = await supabase
        .from("wohnungen")
        .select("id, bezeichnung")
        .eq("id", abrechnung.wohnung_id)
        .single();

      const { data: liegenschaft } = await supabase
        .from("liegenschaften")
        .select("name")
        .eq("id", abrechnung.liegenschaft_id)
        .single();

      // Load verwalter profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, firma, email")
        .eq("id", user.id)
        .single();

      const saldo = Number(abrechnung.differenz ?? 0);

      // Update abrechnung status to versendet
      const { error: updateError } = await supabase
        .from("nebenkostenabrechnungen")
        .update({
          status: "versendet",
          versendet_an: hauptMieter?.email ?? "",
        })
        .eq("id", abrechnung_id);

      if (updateError) {
        results.push({ id: abrechnung_id, status: "error", error: updateError.message });
        continue;
      }

      // Track document
      const dateiname = `NK_Abrechnung_${abrechnung.jahr}_Einschreiben_${wohnung?.bezeichnung ?? "Unbekannt"}.pdf`;
      await supabase.from("nk_abrechnung_dokumente").insert({
        abrechnung_id,
        dokument_typ: "abrechnung",
        dateiname,
        versendet_am: new Date().toISOString(),
        versendet_an: hauptMieter?.email ?? "",
      });

      // Send email notification if requested and mieter has email
      if (send_email && hauptMieter?.email && resend) {
        try {
          const emailData = {
            mieter_name: `${hauptMieter.vorname} ${hauptMieter.nachname}`,
            mieter_email: hauptMieter.email,
            liegenschaft_name: liegenschaft?.name ?? "",
            wohnung_bezeichnung: wohnung?.bezeichnung ?? "",
            jahr: abrechnung.jahr,
            saldo_typ: saldo >= 0 ? "Guthaben" as const : "Nachzahlung" as const,
            saldo_betrag: Math.abs(saldo),
            verwalter_name: profile?.firma ?? profile?.full_name ?? "Verwaltung",
            verwalter_email: profile?.email ?? "",
            versand_methode: methode,
            ton: (abrechnung.begleitschreiben_ton ?? "neutral") as BegleitschreibenTon,
          };

          await resend.emails.send({
            from: `${profile?.firma ?? profile?.full_name ?? "Verwaltung"} <noreply@inovimmo.ch>`,
            to: hauptMieter.email,
            subject: email_betreff ?? nkVersandSubject(emailData),
            html: nkVersandHtml(emailData),
            text: nkVersandText(emailData),
          });
        } catch (emailError) {
          // Email failure is non-critical — the Einschreiben is the primary delivery method
          console.error("E-Mail-Versand fehlgeschlagen:", emailError);
        }
      }

      results.push({ id: abrechnung_id, status: "versendet" });
    } catch (err) {
      results.push({ id: abrechnung_id, status: "error", error: String(err) });
    }
  }

  return NextResponse.json({
    versand_methode: methode,
    results,
    total: abrechnung_ids.length,
    erfolgreich: results.filter((r) => r.status === "versendet").length,
    fehler: results.filter((r) => r.status === "error").length,
  });
}