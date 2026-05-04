"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { UserRole } from "@/types";

export default function RegisterPage() {
  const [form, setForm] = useState({
    email: "", password: "", full_name: "", firma: "", role: "verwalter" as UserRole,
  });
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  function update(key: string, value: string) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            full_name: form.full_name,
            firma: form.firma,
            role: form.role,
          },
        },
      });
      if (error) throw error;
      toast.success("Registrierung erfolgreich! Bitte E-Mail bestätigen.");
      router.push("/auth/login");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Registrierung fehlgeschlagen";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  const roles = [
    { value: "verwalter", label: "🏢 Immobilienverwalter", desc: "Verwalte Liegenschaften und Mieter" },
    { value: "mieter", label: "🏠 Mieter", desc: "Melde Schäden, verwalte Dokumente" },
    { value: "dienstleister", label: "🔧 Dienstleister", desc: "Erhalte Aufträge und stelle Offerten" },
  ];

  return (
    <>
      <h1 className="text-xl font-bold text-gray-900 mb-1">Konto erstellen</h1>
      <p className="text-sm text-gray-500 mb-5">Kostenlos — kein Kreditkarte erforderlich.</p>

      <form onSubmit={handleRegister} className="space-y-4">
        {/* Rolle */}
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Ich bin…
          </label>
          <div className="grid gap-2">
            {roles.map((r) => (
              <label
                key={r.value}
                className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                  form.role === r.value
                    ? "border-[hsl(214,76%,49%)] bg-blue-50"
                    : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <input
                  type="radio"
                  name="role"
                  value={r.value}
                  checked={form.role === r.value}
                  onChange={(e) => update("role", e.target.value)}
                  className="mt-0.5"
                />
                <div>
                  <div className="text-sm font-medium text-gray-900">{r.label}</div>
                  <div className="text-xs text-gray-500">{r.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Name</label>
            <input
              type="text" required value={form.full_name}
              onChange={(e) => update("full_name", e.target.value)}
              placeholder="Max Muster"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[hsl(214,76%,49%)] focus:ring-2 focus:ring-blue-100"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Firma (opt.)</label>
            <input
              type="text" value={form.firma}
              onChange={(e) => update("firma", e.target.value)}
              placeholder="Muster GmbH"
              className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[hsl(214,76%,49%)] focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">E-Mail</label>
          <input
            type="email" required value={form.email}
            onChange={(e) => update("email", e.target.value)}
            placeholder="name@beispiel.ch"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[hsl(214,76%,49%)] focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Passwort</label>
          <input
            type="password" required minLength={8} value={form.password}
            onChange={(e) => update("password", e.target.value)}
            placeholder="Mind. 8 Zeichen"
            className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[hsl(214,76%,49%)] focus:ring-2 focus:ring-blue-100"
          />
        </div>

        <button
          type="submit" disabled={loading}
          className="w-full py-2.5 bg-[hsl(214,76%,49%)] hover:bg-[hsl(214,76%,44%)] disabled:opacity-50 text-white font-semibold rounded-lg transition-colors text-sm"
        >
          {loading ? "Wird registriert…" : "Kostenlos registrieren"}
        </button>
      </form>

      <div className="mt-5 pt-5 border-t border-gray-100 text-center">
        <p className="text-sm text-gray-500">
          Bereits Konto?{" "}
          <Link href="/auth/login" className="text-[hsl(214,76%,49%)] font-medium hover:underline">
            Einloggen
          </Link>
        </p>
      </div>
    </>
  );
}
