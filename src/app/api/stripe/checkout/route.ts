import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  let body: { escrow_id?: string; payment_method?: string };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage." }, { status: 400 });
  }

  if (!body.escrow_id) {
    return NextResponse.json({ error: "escrow_id fehlt." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 });
  }

  const { data: escrow, error } = await supabase
    .from("escrows")
    .select("id,ticket_id,betrag,status,verwalter_id,stripe_payment_intent_id")
    .eq("id", body.escrow_id)
    .single();

  if (error || !escrow) {
    return NextResponse.json({ error: "Escrow nicht gefunden." }, { status: 404 });
  }

  if (escrow.verwalter_id !== user.id) {
    return NextResponse.json({ error: "Keine Berechtigung." }, { status: 403 });
  }

  if (escrow.status !== "ausstehend") {
    return NextResponse.json({ error: "Diese Zahlung ist nicht mehr ausstehend." }, { status: 409 });
  }

  try {
    const stripe = getStripe();
    const amount = Math.round(Number(escrow.betrag) * 100);
    const paymentIntent = escrow.stripe_payment_intent_id
      ? await stripe.paymentIntents.retrieve(escrow.stripe_payment_intent_id)
      : await stripe.paymentIntents.create({
          amount,
          currency: "chf",
          automatic_payment_methods: { enabled: true },
          metadata: {
            escrow_id: escrow.id,
            ticket_id: escrow.ticket_id,
            verwalter_id: user.id,
          },
        });

    if (!escrow.stripe_payment_intent_id) {
      await supabase
        .from("escrows")
        .update({ stripe_payment_intent_id: paymentIntent.id })
        .eq("id", escrow.id);
    }

    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (err: unknown) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Stripe-Zahlung konnte nicht gestartet werden." },
      { status: 503 }
    );
  }
}
