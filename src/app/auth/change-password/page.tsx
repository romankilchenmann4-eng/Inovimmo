"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export default function ChangePasswordPage() {
  const router = useRouter();
  const supabase = createClient();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Passwörter stimmen nicht überein");
      return;
    }
    if (password.length < 8) {
      toast.error("Passwort muss mindestens 8 Zeichen lang sein");
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({
        password,
        data: { force_password_change: false },
      });
      if (error) throw error;
      toast.success("Passwort erfolgreich geändert");
      router.push("/dashboard");
    } catch (err: any) {
      toast.error(err.message ?? "Fehler beim Ändern des Passworts");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-9 h-9 bg-[hsl(214,76%,49%)] rounded-lg flex items-center justify-center text-xl">
            🏛
          </div>
          <span className="text-xl font-bold tracking-tight text-gray-900">Inovimmo</span>
        </div>

        <div className="bg-white rounded-2xl border border-border shadow-sm p-8 space-y-6">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Passwort festlegen</h1>
            <p className="text-sm text-gray-400 mt-1">
              Bitte legen Sie zu Ihrer Sicherheit ein persönliches Passwort fest.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Neues Passwort</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                placeholder="Mindestens 8 Zeichen"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Passwort bestätigen</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                required
                placeholder="Passwort wiederholen"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-[hsl(214,76%,49%)] hover:bg-[hsl(214,76%,44%)] disabled:opacity-50 text-white font-medium rounded-lg text-sm transition-colors"
            >
              {loading ? "Wird gespeichert…" : "Passwort speichern"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
