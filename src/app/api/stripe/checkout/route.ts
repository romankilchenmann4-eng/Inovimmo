import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Price IDs — set these in Stripe Dashboard and add to env
// STRIPE_PRICE_STARTER, STRIPE_PRICE_PROFESSIONAL, STRIPE_PRICE_ENTERPRISE
const PLANS: Record<string, { name: string; priceEnvKey: string; limit: number }> = {
  starter:      { name: "Starter",      priceEnvKey: "STRIPE_PRICE_STARTER",      limit: 10 },
  professional: { name: "Professional", priceEnvKey: "STRIPE_PRICE_PROFESSIONAL",  limit: 50 },
  enterprise:   { name: "Enterprise",   priceEnvKey: "STRIPE_PRICE_ENTERPRISE",    limit: 9999 },
};

export async function POST(req: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return NextResponse.json({ error: "Stripe nicht konfiguriert" }, { status: 503 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { plan } = body as { plan: string };

  if (!PLANS[plan]) {
    return NextResponse.json({ error: "Ungültiger Plan" }, { status: 400 });
  }

  const planConfig = PLANS[plan];
  const priceId = process.env[planConfig.priceEnvKey];
  if (!priceId) {
    return NextResponse.json({ error: `Price ID für ${plan} fehlt (${planConfig.priceEnvKey})` }, { status: 503 });
  }

  const stripe = new Stripe(stripeKey);

  const { data: profile } = await supabase.from("profiles").select("email,full_name,firma").eq("id", user.id).single();
  const { data: existingAbo } = await supabase.from("abonnements").select("stripe_customer_id").eq("verwalter_id", user.id).single();

  let customerId = existingAbo?.stripe_customer_id;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: profile?.email ?? user.email ?? "",
      name: profile?.firma ?? profile?.full_name ?? "",
      metadata: { supabase_user_id: user.id },
    });
    customerId = customer.id;
    await supabase.from("abonnements").upsert({ verwalter_id: user.id, stripe_customer_id: customerId, plan: "kostenlos" });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://inovimmo.ch";
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${baseUrl}/dashboard/einstellungen/abo?success=1`,
    cancel_url: `${baseUrl}/dashboard/einstellungen/abo?cancelled=1`,
    metadata: { supabase_user_id: user.id, plan },
    subscription_data: {
      metadata: { supabase_user_id: user.id, plan },
    },
    locale: "de",
  });

  return NextResponse.json({ url: session.url });
}
