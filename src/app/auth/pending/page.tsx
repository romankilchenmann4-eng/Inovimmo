import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function PendingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/auth/login");

  const { data: profile } = await supabase
    .from("profiles").select("status, email").eq("id", user.id).single();

  if (profile?.status === "active") redirect("/dashboard");

  async function signOut() {
    "use server";
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/auth/login");
  }

  return (
    <div className="text-center space-y-4">
      <div className="text-4xl">⏳</div>
      <h1 className="text-xl font-bold text-gray-900">Konto wird geprüft</h1>
      <p className="text-sm text-gray-500">
        Ihr Konto (<strong>{profile?.email ?? user.email}</strong>) wurde registriert und wartet auf Freischaltung durch die Verwaltung.
      </p>
      <p className="text-sm text-gray-400">
        Sie erhalten eine Benachrichtigung, sobald Ihr Zugang aktiviert wurde.
      </p>
      <form action={signOut}>
        <button type="submit" className="mt-2 text-xs text-gray-400 hover:text-gray-600 underline">
          Abmelden
        </button>
      </form>
    </div>
  );
}
