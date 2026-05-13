import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: "STRIPE_WEBHOOK_SECRET fehlt" }, { status: 503 });
  }

  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Stripe-Signatur fehlt" }, { status: 400 });
  }

  const stripe = getStripe();
  const rawBody = await req.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ungültige Stripe-Signatur" },
      { status: 400 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json({ error: "Supabase Admin-Konfiguration fehlt" }, { status: 503 });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  });

  if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object;
    const escrowId = paymentIntent.metadata?.escrow_id;
    const ticketId = paymentIntent.metadata?.ticket_id;

    if (escrowId) {
      await supabase
        .from("escrows")
        .update({
          status: "einbezahlt",
          einbezahlt_at: new Date().toISOString(),
          stripe_payment_intent_id: paymentIntent.id,
        })
        .eq("id", escrowId);
    }

    if (ticketId) {
      await supabase
        .from("tickets")
        .update({ status: "in_ausfuehrung" })
        .eq("id", ticketId);
    }
  }

  return NextResponse.json({ received: true });
}
