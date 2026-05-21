import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getStripe } from "@/lib/stripe";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  if (!process.env.STRIPE_SECRET_KEY) return NextResponse.json({ error: "Stripe nicht konfiguriert" }, { status: 503 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: abo } = await supabase.from("abonnements").select("stripe_customer_id").eq("verwalter_id", user.id).single();
  if (!abo?.stripe_customer_id) return NextResponse.json({ error: "Kein Stripe-Konto gefunden" }, { status: 404 });

  const stripe = getStripe();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://inovimmo.ch";

  const portal = await stripe.billingPortal.sessions.create({
    customer: abo.stripe_customer_id,
    return_url: `${baseUrl}/dashboard/einstellungen/abo`,
  });

  return NextResponse.json({ url: portal.url });
}
