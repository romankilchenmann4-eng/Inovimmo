import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashboardContent from "./DashboardContent";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Profile
  const { data: profile } = await supabase
    .from("profiles")
    .select("id, full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  const isAdmin = profile?.role === "admin";

  // Liegenschaften
  let liegQuery = supabase
    .from("liegenschaften")
    .select("id, name, ort, anzahl_wohnungen");

  if (!isAdmin) {
    liegQuery = liegQuery.eq("verwalter_id", user.id);
  }

  const { data: liegenschaften } = await liegQuery;

  // Wohnungen + KPIs
  let whgQuery = supabase
    .from("wohnungen")
    .select("status, nettomiete, nebenkosten_akonto");

  if (!isAdmin) {
    whgQuery = whgQuery.eq("verwalter_id", user.id);
  }

  const { data: wohnungen } = await whgQuery;

  const totalWohnungen = wohnungen?.length ?? 0;
  const belegteWohnungen = wohnungen?.filter((w) => w.status === "vermietet").length ?? 0;

  const jahresErtrag =
    ((wohnungen?.reduce((sum, w) => sum + (w.nettomiete ?? 0) + (w.nebenkosten_akonto ?? 0), 0)) ?? 0) * 12;

  const leerstandQuote =
    totalWohnungen > 0
      ? (((totalWohnungen - belegteWohnungen) / totalWohnungen) * 100).toFixed(1)
      : "0.0";

  return (
    <DashboardContent
      profileName={profile?.full_name?.split(" ")[0] ?? ""}
      liegenschaften={liegenschaften ?? []}
      totalWohnungen={totalWohnungen}
      belegteWohnungen={belegteWohnungen}
      jahresErtrag={jahresErtrag}
      leerstandQuote={leerstandQuote}
    />
  );
}