import { createClient } from "@/lib/supabase/server";
import { adminCreateUser, approveUser, disableUser } from "@/lib/admin/user-actions";
import ImpersonateButton from "./ImpersonateButton";

const ROLE_BADGE: Record<string, string> = {
  admin:         "badge-red",
  verwalter:     "badge-blue",
  "eigentümer":  "badge-green",
  dienstleister: "badge-amber",
  mieter:        "badge-gray",
};

const inp = "w-full px-3 py-2.5 border border-border rounded-xl text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[hsl(214,76%,49%)]/20 focus:border-[hsl(214,76%,49%)] transition-all placeholder:text-gray-400";

export default async function AdminBenutzerPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const { error: flashError, success: flashSuccess } = await searchParams;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: callerProfile } = await supabase
    .from("profiles").select("role").eq("id", user!.id).single();
  const isAdmin = callerProfile?.role === "admin";

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, firma, created_at, status")
    .order("created_at", { ascending: false });

  const { data: liegenschaften } = await supabase
    .from("liegenschaften").select("id, name").order("name");

  const pending = (profiles ?? []).filter(p => p.status === "pending");
  const active  = (profiles ?? []).filter(p => p.status !== "pending");

  const counts = {
    total:         profiles?.length ?? 0,
    pending:       pending.length,
    verwalter:     profiles?.filter(p => p.role === "verwalter").length ?? 0,
    mieter:        profiles?.filter(p => p.role === "mieter").length ?? 0,
    dienstleister: profiles?.filter(p => p.role === "dienstleister").length ?? 0,
  };

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Benutzerverwaltung</h2>
        <p className="text-sm text-muted-foreground mt-0.5">Alle registrierten Benutzer auf der Plattform</p>
      </div>

      {flashError && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-700">
          ⚠️ {decodeURIComponent(flashError)}
        </div>
      )}
      {flashSuccess && (
        <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700">
          ✓ {decodeURIComponent(flashSuccess)}
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: "Gesamt",           value: counts.total,         color: "text-foreground" },
          { label: "Ausstehend",       value: counts.pending,       color: "text-amber-600" },
          { label: "Verwalter",        value: counts.verwalter,     color: "text-[hsl(214,76%,49%)]" },
          { label: "Mieter",           value: counts.mieter,        color: "text-gray-600" },
          { label: "Dienstleister",    value: counts.dienstleister, color: "text-amber-600" },
        ].map(s => (
          <div key={s.label} className="bg-white rounded-2xl border border-border p-4 shadow-sm">
            <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Pending users */}
      {pending.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-amber-200 flex items-center gap-2">
            <span className="text-amber-600">⏳</span>
            <h3 className="font-semibold text-amber-800">Ausstehende Freischaltungen ({pending.length})</h3>
          </div>
          <div className="divide-y divide-amber-100">
            {pending.map(p => (
              <div key={p.id} className="px-5 py-3 flex items-center justify-between gap-4">
                <div>
                  <p className="font-medium text-sm text-gray-900">{p.full_name || "—"}</p>
                  <p className="text-xs text-gray-500">{p.email} · {p.role}</p>
                </div>
                {isAdmin && p.id !== user!.id && (
                  <div className="flex gap-2 flex-shrink-0">
                    <form action={approveUser}>
                      <input type="hidden" name="userId" value={p.id as string} />
                      <button type="submit" className="text-xs px-3 py-1.5 bg-green-100 text-green-700 rounded-lg hover:bg-green-200 font-semibold">
                        ✓ Freischalten
                      </button>
                    </form>
                    <form action={disableUser}>
                      <input type="hidden" name="userId" value={p.id as string} />
                      <button type="submit" className="text-xs px-3 py-1.5 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 font-semibold">
                        Ablehnen
                      </button>
                    </form>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* User table */}
      <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-gray-900">Alle Benutzer ({counts.total})</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="table-header">Name</th>
                <th className="table-header">E-Mail</th>
                <th className="table-header">Rolle</th>
                <th className="table-header">Firma</th>
                <th className="table-header">Seit</th>
                {isAdmin && <th className="table-header">Aktionen</th>}
              </tr>
            </thead>
            <tbody>
              {active.map(p => (
                <tr key={p.id} className="table-row">
                  <td className="table-cell">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-[hsl(214,76%,49%)] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {(p.full_name as string | null)?.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2) ?? "??"}
                      </div>
                      <span className="font-medium text-sm text-gray-900">{p.full_name ?? "—"}</span>
                    </div>
                  </td>
                  <td className="table-cell text-sm text-muted-foreground">{p.email ?? "—"}</td>
                  <td className="table-cell">
                    <span className={ROLE_BADGE[p.role as string] ?? "badge-gray"}>{p.role}</span>
                  </td>
                  <td className="table-cell text-sm text-muted-foreground">{p.firma ?? "—"}</td>
                  <td className="table-cell text-xs text-muted-foreground">
                    {new Date(p.created_at as string).toLocaleDateString("de-CH")}
                  </td>
                  {isAdmin && (
                    <td className="table-cell">
                      {p.id !== user!.id ? (
                        <ImpersonateButton
                          userId={p.id as string}
                          userName={(p.full_name as string | null) ?? (p.email as string | null) ?? "Benutzer"}
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">Du selbst</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create user form */}
      {isAdmin && (
        <div className="bg-white rounded-2xl border border-border shadow-sm p-6">
          <h3 className="font-semibold text-gray-900 mb-5">Neuen Benutzer erstellen</h3>
          <form action={adminCreateUser} className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1.5">Name</label>
                <input name="full_name" className={inp} placeholder="Maria Muster" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1.5">E-Mail *</label>
                <input name="email" type="email" required className={inp} placeholder="maria@beispiel.ch" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1.5">Passwort *</label>
                <input name="password" type="password" required minLength={8} className={inp} placeholder="Min. 8 Zeichen" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1.5">Rolle</label>
                <select name="role" defaultValue="mieter" className={inp}>
                  <option value="admin">Admin</option>
                  <option value="verwalter">Verwalter</option>
                  <option value="eigentümer">Eigentümer</option>
                  <option value="dienstleister">Dienstleister</option>
                  <option value="mieter">Mieter</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs font-semibold text-muted-foreground uppercase mb-1.5">Liegenschaften</label>
                <select name="liegenschaft_ids" multiple className={`${inp} h-32`}>
                  {(liegenschaften ?? []).map((l: { id: string; name: string }) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
                <p className="text-xs text-muted-foreground mt-1">Ctrl/Cmd für Mehrfachauswahl</p>
              </div>
            </div>
            <button type="submit" className="btn-primary">
              + Benutzer erstellen
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
