import { NextRequest, NextResponse } from "next/server";
import {
  sendAuftragAbgeschlossen,
  sendAuftragVergeben,
  sendEscrowEinbezahlt,
  sendOfferteEingegangen,
  sendTicketBestaetigung,
  sendTicketStatusUpdate,
  sendWillkommen,
} from "@/lib/email";

export const dynamic = "force-dynamic";

const handlers = {
  ticket_bestaetigung: sendTicketBestaetigung,
  offerte_eingegangen: sendOfferteEingegangen,
  auftrag_vergeben: sendAuftragVergeben,
  escrow_einbezahlt: sendEscrowEinbezahlt,
  auftrag_abgeschlossen: sendAuftragAbgeschlossen,
  willkommen: sendWillkommen,
  ticket_status_update: sendTicketStatusUpdate,
};

type EmailType = keyof typeof handlers;

export async function POST(req: NextRequest) {
  if (!process.env.RESEND_API_KEY) {
    return NextResponse.json({ sent: false, error: "RESEND_API_KEY fehlt." }, { status: 503 });
  }

  let body: { type?: EmailType; payload?: unknown; data?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ sent: false, error: "Ungültige Anfrage." }, { status: 400 });
  }

  if (!body.type || !(body.type in handlers)) {
    return NextResponse.json({ sent: false, error: "Unbekannter E-Mail-Typ." }, { status: 400 });
  }

  try {
    const result = await handlers[body.type]((body.payload ?? body.data) as never);
    return NextResponse.json({ sent: true, result });
  } catch (err: unknown) {
    return NextResponse.json(
      { sent: false, error: err instanceof Error ? err.message : "E-Mail konnte nicht gesendet werden." },
      { status: 500 }
    );
  }
}
