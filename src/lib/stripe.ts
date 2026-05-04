import Stripe from "stripe";
export function getStripe() {
  return new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_test_placeholder", {
    apiVersion: "2025-02-24.acacia",
    typescript: true,
  });
}
