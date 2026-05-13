import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const PLAN_LIMITS: Record<string, number> = {
  starter:      10,
  professional: 50,
  enterprise:   9999,
};

export async function POST(req: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeKey) return NextResponse.json({ received: true });

  const stripe = new Stripe(stripeKey);
  const body = await req.text();

  let event: Stripe.Event;
  try {
    if (webhookSecret) {
      const sig = req.headers.get("stripe-signature") ?? "";
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } else {
      event = JSON.parse(body) as Stripe.Event;
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Webhook-Fehler";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const supabase = await createClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode !== "subscription") break;
      const userId = session.metadata?.supabase_user_id;
      const plan = session.metadata?.plan ?? "starter";
      if (!userId) break;
      await supabase.from("abonnements").upsert({
        verwalter_id: userId,
        stripe_customer_id: session.customer as string,
        stripe_subscription_id: session.subscription as string,
        plan,
        status: "aktiv",
        wohnungen_limit: PLAN_LIMITS[plan] ?? 10,
        updated_at: new Date().toISOString(),
      });
      break;
    }

    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.supabase_user_id;
      const plan = sub.metadata?.plan ?? "starter";
      if (!userId) break;
      await supabase.from("abonnements")
        .update({
          plan,
          status: sub.status === "active" ? "aktiv" : sub.status === "past_due" ? "past_due" : "cancelled",
          current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
          wohnungen_limit: PLAN_LIMITS[plan] ?? 10,
          updated_at: new Date().toISOString(),
        })
        .eq("verwalter_id", userId);
      break;
    }

    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const userId = sub.metadata?.supabase_user_id;
      if (!userId) break;
      await supabase.from("abonnements")
        .update({ plan: "kostenlos", status: "cancelled", wohnungen_limit: 5, updated_at: new Date().toISOString() })
        .eq("verwalter_id", userId);
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;
      await supabase.from("abonnements")
        .update({ status: "past_due", updated_at: new Date().toISOString() })
        .eq("stripe_customer_id", customerId);
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId = invoice.customer as string;
      await supabase.from("abonnements")
        .update({ status: "aktiv", updated_at: new Date().toISOString() })
        .eq("stripe_customer_id", customerId);
      break;
    }
  }

  return NextResponse.json({ received: true });
}
