"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      router.push("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Login fehlgeschlagen";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <h1 className="text-xl font-bold text-gray-900 mb-1">Willkommen zurück</h1>
      <p className="text-sm text-gray-500 mb-6">Melden Sie sich in Ihrem Inovimmo-Konto an.</p>

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
            E-Mail
          </label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="name@beispiel.ch"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[hsl(214,76%,49%)] focus:ring-2 focus:ring-blue-100 transition-all"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
            Passwort
          </label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="••••••••"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[hsl(214,76%,49%)] focus:ring-2 focus:ring-blue-100 transition-all"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-2.5 bg-[hsl(214,76%,49%)] hover:bg-[hsl(214,76%,44%)] disabled:opacity-50 text-white font-semibold rounded-lg transition-colors text-sm"
        >
          {loading ? "Wird angemeldet…" : "Einloggen"}
        </button>
      </form>

      <div className="mt-5 pt-5 border-t border-gray-100 text-center">
        <p className="text-sm text-gray-500">
          Noch kein Konto?{" "}
          <Link href="/auth/register" className="text-[hsl(214,76%,49%)] font-medium hover:underline">
            Kostenlos registrieren
          </Link>
        </p>
      </div>

      {/* Demo-Hinweis */}
      <div className="mt-4 p-3 bg-blue-50 rounded-lg">
        <p className="text-xs text-blue-700 font-medium mb-1">Demo-Zugänge:</p>
        <p className="text-xs text-blue-600">Verwalter: verwalter@demo.ch / demo1234</p>
        <p className="text-xs text-blue-600">Mieter: mieter@demo.ch / demo1234</p>
        <p className="text-xs text-blue-600">Dienstleister: dienst@demo.ch / demo1234</p>
      </div>
    </>
  );
}
