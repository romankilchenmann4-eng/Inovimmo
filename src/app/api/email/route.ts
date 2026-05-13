import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  sendTicketBestaetigung,
  sendOfferteEingegangen,
  sendAuftragVergeben,
  sendEscrowEinbezahlt,
  sendAuftragAbgeschlossen,
  sendWillkommen,
  sendTicketStatusUpdate,
  sendMahnung,
} from "@/lib/email";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { type, to, data } = body;

  try {
    switch (type) {
      case "ticket_bestaetigung":
        await sendTicketBestaetigung({ to, ...data });
        break;
      case "offerte_eingegangen":
        await sendOfferteEingegangen({ to, ...data });
        break;
      case "auftrag_vergeben":
        await sendAuftragVergeben({ to, ...data });
        break;
      case "escrow_einbezahlt":
        await sendEscrowEinbezahlt({ to, ...data });
        break;
      case "auftrag_abgeschlossen":
        await sendAuftragAbgeschlossen({ to, ...data });
        break;
      case "willkommen":
        await sendWillkommen({ to, ...data });
        break;
      case "ticket_status":
        await sendTicketStatusUpdate({ to, ...data });
        break;
      case "mahnung":
        await sendMahnung({ to, ...data });
        break;
      default:
        return NextResponse.json({ error: `Unbekannter Email-Typ: ${type}` }, { status: 400 });
    }
    return NextResponse.json({ sent: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Email-Fehler";
    return NextResponse.json({ sent: false, error: message }, { status: 500 });
  }
}
