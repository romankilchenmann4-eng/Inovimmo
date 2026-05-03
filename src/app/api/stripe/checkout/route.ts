import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { stripe } from "@/lib/stripe";
import { sendEscrowEinbezahlt } from "@/lib/email";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { escrow_id } = await req.json();
    if (!escrow_id) return NextResponse.json({ error: "escrow_id required" }, { status: 400 });

    // Fetch escrow with details
    const { data: escrow } = await supabase
      .from("escrows")
      .select("*, ticket:tickets(titel), dienstleister:profiles!escrows_dienstleister_id_fkey(full_name,firma,email)")
      .eq("id", escrow_id)
      .eq("verwalter_id", user.id)
      .single();

    if (!escrow) return NextResponse.json({ error: "Escrow nicht gefunden" }, { status: 404 });
    if (escrow.status !== "ausstehend") return NextResponse.json({ error: "Bereits bezahlt" }, { status: 400 });

    const dl = escrow.dienstleister as unknown as { full_name: string; firma: string; email: string };
    const ticket = escrow.ticket as unknown as { titel: string };
    const betragCHF = Math.round(escrow.betrag * 100); // Stripe expects Rappen

    // Create Stripe PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: betragCHF,
      currency: "chf",
      metadata: {
        escrow_id,
        ticket_id: escrow.ticket_id,
        verwalter_id: user.id,
        dienstleister_id: escrow.dienstleister_id,
      },
      description: `Inovimmo Escrow: ${ticket.titel}`,
      statement_descriptor: "INOVIMMO ESCROW",
    });

    // Save payment intent ID
    await supabase
      .from("escrows")
      .update({
        stripe_payment_intent_id: paymentIntent.id,
        status: "einbezahlt",
        einbezahlt_at: new Date().toISOString(),
      })
      .eq("id", escrow_id);

    // Update ticket status
    await supabase.from("tickets").update({ status: "in_ausfuehrung" }).eq("id", escrow.ticket_id);

    // Send email to Dienstleister
    if (dl?.email) {
      await sendEscrowEinbezahlt({
        to: dl.email,
        dienstleisterName: dl.firma ?? dl.full_name,
        ticketTitel: ticket.titel,
        betrag: escrow.betrag,
        escrowId: escrow_id,
      });
    }

    return NextResponse.json({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    });
  } catch (err) {
    console.error("Stripe checkout error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Stripe-Fehler" },
      { status: 500 }
    );
  }
}
