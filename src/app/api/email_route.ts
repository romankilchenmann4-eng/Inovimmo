import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

import {
  sendTicketBestaetigung,
  sendOfferteEingegangen,
  sendAuftragVergeben,
  sendTicketStatusUpdate,
  sendWillkommen,
} from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { type, payload } = await req.json();

    switch (type) {
      case "ticket_erstellt": {
        const { ticket_id } = payload;
        const { data: ticket } = await supabase
          .from("tickets")
          .select("*, ersteller:profiles!tickets_erstellt_von_fkey(full_name,email), liegenschaft:liegenschaften(name)")
          .eq("id", ticket_id).single();

        if (!ticket) return NextResponse.json({ error: "Ticket nicht gefunden" }, { status: 404 });

        const ersteller = ticket.ersteller as unknown as { full_name: string; email: string };
        const liegenschaft = ticket.liegenschaft as unknown as { name: string };

        if (ersteller?.email) {
          await sendTicketBestaetigung({
            to: ersteller.email,
            name: ersteller.full_name,
            ticketTitel: ticket.titel,
            ticketId: ticket_id,
            liegenschaft: liegenschaft?.name ?? "—",
            prioritaet: ticket.prioritaet,
          });
        }

        // Notify matching Dienstleister
        const { data: dienstleister } = await supabase
          .from("dienstleister_profile")
          .select("profile:profiles(full_name,email)")
          .contains("kategorien", [ticket.kategorie]);

        for (const dl of dienstleister ?? []) {
          const p = dl.profile as unknown as { full_name: string; email: string };
          if (p?.email) {
            await sendTicketStatusUpdate({
              to: p.email,
              name: p.full_name,
              ticketTitel: ticket.titel,
              ticketId: ticket_id,
              neuerStatus: "ausgeschrieben",
            });
          }
        }

        return NextResponse.json({ sent: true });
      }

      case "offerte_eingegangen": {
        const { offerte_id } = payload;
        const { data: offerte } = await supabase
          .from("offerten")
          .select("betrag, ticket:tickets(id,titel,erstellt_von,profiles!tickets_erstellt_von_fkey(full_name,email)), dienstleister:profiles!offerten_dienstleister_id_fkey(full_name,firma)")
          .eq("id", offerte_id).single();

        if (!offerte) return NextResponse.json({ error: "Offerte nicht gefunden" }, { status: 404 });

        const ticket = offerte.ticket as unknown as { id: string; titel: string; profiles: { full_name: string; email: string } };
        const dl = offerte.dienstleister as unknown as { full_name: string; firma: string };

        // Count total offerten
        const { count } = await supabase.from("offerten").select("*", { count: "exact", head: true }).eq("ticket_id", ticket.id);

        if (ticket.profiles?.email) {
          await sendOfferteEingegangen({
            to: ticket.profiles.email,
            verwalterName: ticket.profiles.full_name,
            ticketTitel: ticket.titel,
            ticketId: ticket.id,
            dienstleisterName: dl.firma ?? dl.full_name,
            betrag: offerte.betrag,
            anzahlOfferten: count ?? 1,
          });
        }

        return NextResponse.json({ sent: true });
      }

      case "auftrag_vergeben": {
        const { offerte_id } = payload;
        const { data: offerte } = await supabase
          .from("offerten")
          .select("betrag,verfuegbar_ab, dienstleister:profiles!offerten_dienstleister_id_fkey(full_name,firma,email), ticket:tickets(titel,ersteller:profiles!tickets_erstellt_von_fkey(full_name))")
          .eq("id", offerte_id).single();

        if (!offerte) return NextResponse.json({ error: "Offerte nicht gefunden" }, { status: 404 });

        const dl = offerte.dienstleister as unknown as { full_name: string; firma: string; email: string };
        const ticket = offerte.ticket as unknown as { titel: string; ersteller: { full_name: string } };

        if (dl?.email) {
          await sendAuftragVergeben({
            to: dl.email,
            dienstleisterName: dl.firma ?? dl.full_name,
            ticketTitel: ticket.titel,
            ticketId: payload.ticket_id,
            betrag: offerte.betrag,
            verwalterName: ticket.ersteller?.full_name ?? "Verwalter",
            verfuegbarAb: offerte.verfuegbar_ab,
          });
        }

        return NextResponse.json({ sent: true });
      }

      case "willkommen": {
        const { to, name, role } = payload;
        await sendWillkommen({ to, name, role });
        return NextResponse.json({ sent: true });
      }

      default:
        return NextResponse.json({ error: "Unknown type" }, { status: 400 });
    }
  } catch (err) {
    console.error("Email API error:", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Fehler" }, { status: 500 });
  }
}
