import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";
import { createClient } from "@/lib/supabase/server";
import { sendAuftragAbgeschlossen } from "@/lib/email";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature")!;

  let event;
  try {
    event = getStripe().webhooks.constructEvent(
      body, sig, process.env.STRIPE_WEBHOOK_SECRET!
    );
  } catch (err) {
    console.error("Webhook signature error:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const supabase = await createClient();

  switch (event.type) {
    case "payment_intent.succeeded": {
      const pi = event.data.object;
      const { escrow_id, ticket_id } = pi.metadata;

      if (escrow_id) {
        await supabase.from("escrows")
          .update({ status: "in_ausfuehrung", einbezahlt_at: new Date().toISOString() })
          .eq("id", escrow_id);
        await supabase.from("tickets")
          .update({ status: "in_ausfuehrung" })
          .eq("id", ticket_id);
      }
      break;
    }

    case "payment_intent.payment_failed": {
      const pi = event.data.object;
      const { escrow_id } = pi.metadata;
      if (escrow_id) {
        await supabase.from("escrows")
          .update({ status: "ausstehend" })
          .eq("id", escrow_id);
      }
      break;
    }

    // When we transfer funds to Dienstleister (via Connect)
    case "transfer.created": {
      const transfer = event.data.object;
      const escrowId = transfer.metadata?.escrow_id;
      if (escrowId) {
        const { data: escrow } = await supabase
          .from("escrows")
          .select("betrag,provision_betrag,ticket:tickets(titel),verwalter:profiles!escrows_verwalter_id_fkey(full_name,email),dienstleister:profiles!escrows_dienstleister_id_fkey(full_name,firma,email)")
          .eq("id", escrowId).single();

        if (escrow) {
          const auszahlung = escrow.betrag - escrow.provision_betrag;
          const verwalter = escrow.verwalter as unknown as { full_name: string; email: string };
          const dl = escrow.dienstleister as unknown as { full_name: string; firma: string; email: string };
          const ticket = escrow.ticket as unknown as { titel: string };

          await supabase.from("escrows")
            .update({ status: "abgeschlossen", freigegeben_at: new Date().toISOString() })
            .eq("id", escrowId);

          // Notify both parties
          if (verwalter?.email) {
            await sendAuftragAbgeschlossen({ to: verwalter.email, name: verwalter.full_name, ticketTitel: ticket.titel, betrag: escrow.betrag, auszahlung, isVerwalter: true });
          }
          if (dl?.email) {
            await sendAuftragAbgeschlossen({ to: dl.email, name: dl.firma ?? dl.full_name, ticketTitel: ticket.titel, betrag: escrow.betrag, auszahlung, isVerwalter: false });
          }
        }
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}

export const config = { api: { bodyParser: false } };
