"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

type Profile = { id: string; full_name: string | null; email: string | null; role: string };

type Nachricht = {
  id: string;
  sender_id: string;
  empfaenger_id: string;
  betreff: string;
  inhalt: string;
  gelesen: boolean;
  created_at: string;
  sender?: { full_name: string | null; email: string | null };
  empfaenger?: { full_name: string | null; email: string | null };
};

const inp = "w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-[hsl(214,76%,49%)] text-gray-900 placeholder-gray-400";

function initials(p: { full_name: string | null; email: string | null } | undefined) {
  if (!p) return "??";
  const name = p.full_name || p.email || "?";
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

function displayName(p: { full_name: string | null; email: string | null } | undefined) {
  if (!p) return "Unbekannt";
  return p.full_name || p.email || "Unbekannt";
}

export default function NachrichtenPage() {
  const supabase = createClient();
  const [me, setMe] = useState<Profile | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [inbox, setInbox] = useState<Nachricht[]>([]);
  const [sent, setSent] = useState<Nachricht[]>([]);
  const [selected, setSelected] = useState<Nachricht | null>(null);
  const [tab, setTab] = useState<"inbox" | "sent">("inbox");
  const [showCompose, setShowCompose] = useState(false);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [form, setForm] = useState({ empfaenger_id: "", betreff: "", inhalt: "" });
  const composeRef = useRef<HTMLDivElement>(null);

  async function load() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const [{ data: profile }, { data: allProfiles }, { data: received }, { data: outbox }] = await Promise.all([
      supabase.from("profiles").select("id, full_name, email, role").eq("id", user.id).single(),
      supabase.from("profiles").select("id, full_name, email, role").neq("id", user.id).order("full_name"),
      supabase.from("nachrichten")
        .select("*, sender:profiles!nachrichten_sender_id_fkey(full_name, email), empfaenger:profiles!nachrichten_empfaenger_id_fkey(full_name, email)")
        .eq("empfaenger_id", user.id)
        .order("created_at", { ascending: false }),
      supabase.from("nachrichten")
        .select("*, sender:profiles!nachrichten_sender_id_fkey(full_name, email), empfaenger:profiles!nachrichten_empfaenger_id_fkey(full_name, email)")
        .eq("sender_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

    setMe(profile as Profile);
    setProfiles(allProfiles as Profile[] ?? []);
    setInbox(received as unknown as Nachricht[] ?? []);
    setSent(outbox as unknown as Nachricht[] ?? []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function openMessage(n: Nachricht) {
    setSelected(n);
    if (!n.gelesen && n.empfaenger_id === me?.id) {
      await supabase.from("nachrichten").update({ gelesen: true }).eq("id", n.id);
      setInbox(prev => prev.map(m => m.id === n.id ? { ...m, gelesen: true } : m));
    }
  }

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!form.empfaenger_id || !form.betreff || !form.inhalt) {
      toast.error("Alle Felder ausfüllen");
      return;
    }
    setSending(true);
    const { error } = await supabase.from("nachrichten").insert({
      sender_id: me!.id,
      empfaenger_id: form.empfaenger_id,
      betreff: form.betreff,
      inhalt: form.inhalt,
    });
    if (error) { setSending(false); toast.error(error.message); return; }

    // Fire-and-forget email notification to recipient
    const empfaenger = profiles.find(p => p.id === form.empfaenger_id);
    if (empfaenger?.email) {
      fetch("/api/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "nachricht",
          to: empfaenger.email,
          data: {
            empfaengerName: empfaenger.full_name || empfaenger.email,
            absenderName: me!.full_name || me!.email || "Jemand",
            betreff: form.betreff,
            vorschau: form.inhalt.slice(0, 100),
          },
        }),
      }).catch(() => {});
    }

    setSending(false);
    toast.success("Nachricht gesendet");
    setShowCompose(false);
    setForm({ empfaenger_id: "", betreff: "", inhalt: "" });
    await load();
    setTab("sent");
  }

  async function replyTo(n: Nachricht) {
    const otherPerson = n.sender_id === me?.id ? n.empfaenger_id : n.sender_id;
    setForm({
      empfaenger_id: otherPerson,
      betreff: n.betreff.startsWith("Re: ") ? n.betreff : `Re: ${n.betreff}`,
      inhalt: "",
    });
    setShowCompose(true);
    setTimeout(() => composeRef.current?.scrollIntoView({ behavior: "smooth" }), 100);
  }

  const unread = inbox.filter(n => !n.gelesen).length;
  const list = tab === "inbox" ? inbox : sent;

  if (loading) {
    return <div className="flex items-center justify-center h-64 text-gray-400 text-sm">Lade Nachrichten…</div>;
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Nachrichten</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {unread > 0 ? `${unread} ungelesene Nachricht${unread > 1 ? "en" : ""}` : "Alle Nachrichten gelesen"}
          </p>
        </div>
        <button
          onClick={() => { setShowCompose(v => !v); setSelected(null); }}
          className="btn-primary"
        >
          + Neue Nachricht
        </button>
      </div>

      {/* Compose form */}
      {showCompose && (
        <div ref={composeRef} className="bg-white rounded-2xl border border-border shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Neue Nachricht verfassen</h3>
          <form onSubmit={send} className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Empfänger *</label>
              <select required className={inp} value={form.empfaenger_id} onChange={e => setForm(f => ({ ...f, empfaenger_id: e.target.value }))}>
                <option value="">— Person wählen —</option>
                {profiles.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.full_name || p.email} ({p.role})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Betreff *</label>
              <input required className={inp} value={form.betreff} onChange={e => setForm(f => ({ ...f, betreff: e.target.value }))} placeholder="Betreff der Nachricht" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Nachricht *</label>
              <textarea required rows={5} className={inp + " resize-none"} value={form.inhalt} onChange={e => setForm(f => ({ ...f, inhalt: e.target.value }))} placeholder="Ihre Nachricht…" />
            </div>
            <div className="flex gap-2 pt-1">
              <button type="submit" disabled={sending} className="btn-primary disabled:opacity-50">
                {sending ? "Senden…" : "Senden"}
              </button>
              <button type="button" onClick={() => setShowCompose(false)} className="px-4 py-2 border border-border text-gray-600 text-sm rounded-xl hover:bg-gray-50">
                Abbrechen
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="grid lg:grid-cols-5 gap-4">
        {/* Message list */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
          <div className="flex border-b border-border">
            <button
              onClick={() => setTab("inbox")}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${tab === "inbox" ? "text-[hsl(214,76%,49%)] border-b-2 border-[hsl(214,76%,49%)]" : "text-gray-500 hover:text-gray-700"}`}
            >
              Eingang {unread > 0 && <span className="ml-1 text-xs font-bold bg-[hsl(214,76%,49%)] text-white rounded-full px-1.5 py-0.5">{unread}</span>}
            </button>
            <button
              onClick={() => setTab("sent")}
              className={`flex-1 py-3 text-sm font-medium transition-colors ${tab === "sent" ? "text-[hsl(214,76%,49%)] border-b-2 border-[hsl(214,76%,49%)]" : "text-gray-500 hover:text-gray-700"}`}
            >
              Gesendet
            </button>
          </div>

          {list.length === 0 ? (
            <div className="py-12 text-center text-gray-400 text-sm">
              <p className="text-2xl mb-2">{tab === "inbox" ? "📭" : "📤"}</p>
              <p>{tab === "inbox" ? "Kein Eingang" : "Nichts gesendet"}</p>
            </div>
          ) : (
            <div className="divide-y divide-border overflow-y-auto max-h-[520px]">
              {list.map(n => {
                const other = tab === "inbox" ? n.sender : n.empfaenger;
                const isSelected = selected?.id === n.id;
                const isUnread = tab === "inbox" && !n.gelesen;
                return (
                  <button
                    key={n.id}
                    onClick={() => openMessage(n)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${isSelected ? "bg-[hsl(214,76%,49%)]/5" : ""}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-full bg-[hsl(214,76%,49%)] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {initials(other)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <p className={`text-sm truncate ${isUnread ? "font-bold text-gray-900" : "font-medium text-gray-700"}`}>
                            {displayName(other)}
                          </p>
                          <span className="text-xs text-gray-400 flex-shrink-0">
                            {new Date(n.created_at).toLocaleDateString("de-CH")}
                          </span>
                        </div>
                        <p className={`text-xs truncate ${isUnread ? "text-gray-800 font-medium" : "text-gray-500"}`}>{n.betreff}</p>
                        <p className="text-xs text-gray-400 truncate mt-0.5">{n.inhalt.slice(0, 60)}{n.inhalt.length > 60 ? "…" : ""}</p>
                      </div>
                      {isUnread && <span className="w-2 h-2 rounded-full bg-[hsl(214,76%,49%)] flex-shrink-0 mt-1.5" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Message detail */}
        <div className="lg:col-span-3">
          {selected ? (
            <div className="bg-white rounded-2xl border border-border shadow-sm h-full flex flex-col">
              <div className="px-5 py-4 border-b border-border">
                <h3 className="font-bold text-gray-900">{selected.betreff}</h3>
                <div className="flex items-center gap-3 mt-2">
                  <div className="w-7 h-7 rounded-full bg-[hsl(214,76%,49%)] flex items-center justify-center text-white text-xs font-bold">
                    {initials(tab === "inbox" ? selected.sender : selected.empfaenger)}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">
                      {tab === "inbox" ? "Von" : "An"}: <span className="font-medium text-gray-700">{displayName(tab === "inbox" ? selected.sender : selected.empfaenger)}</span>
                    </p>
                    <p className="text-xs text-gray-400">
                      {new Date(selected.created_at).toLocaleDateString("de-CH", { day: "2-digit", month: "long", year: "numeric" })}
                      {" "}um{" "}
                      {new Date(selected.created_at).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })} Uhr
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex-1 px-5 py-5 overflow-y-auto">
                <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{selected.inhalt}</p>
              </div>
              <div className="px-5 py-4 border-t border-border">
                <button
                  onClick={() => replyTo(selected)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-xl hover:bg-gray-200 transition-colors"
                >
                  Antworten
                </button>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-border shadow-sm p-10 text-center text-gray-400 h-full flex flex-col items-center justify-center">
              <p className="text-3xl mb-2">💬</p>
              <p className="text-sm">Nachricht auswählen</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
