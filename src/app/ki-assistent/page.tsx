"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type Message = { role: "user" | "assistant"; content: string; ts: Date };

const QUICK_REPLIES = [
  "Wann wird mein Ticket bearbeitet?",
  "Wie melde ich einen Schaden?",
  "Wann ist die NK-Abrechnung fertig?",
  "Wie hoch ist meine Miete?",
  "An wen wende ich mich bei Notfällen?",
];

export default function KIChatPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "Hallo! Ich bin Ihr Inovimmo-Assistent. Ich kann Ihnen bei Fragen zu Ihrer Wohnung, Tickets und Verwaltungsthemen helfen. Was kann ich für Sie tun?",
      ts: new Date(),
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text?: string) {
    const msg = text ?? input.trim();
    if (!msg) return;
    setInput("");
    setLoading(true);

    const userMsg: Message = { role: "user", content: msg, ts: new Date() };
    setMessages(m => [...m, userMsg]);

    try {
      // Get user context from Supabase
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase.from("profiles").select("full_name,role").eq("id", user!.id).single();
      const { data: tickets } = await supabase.from("tickets").select("titel,status,prioritaet,created_at").eq("erstellt_von", user!.id).order("created_at", { ascending: false }).limit(5);
      const { data: wohnung } = await supabase.from("wohnungen").select("bezeichnung,nettomiete,nebenkosten_akonto,status").eq("mieter_id", user!.id).single();

      const context = `
Du bist der freundliche KI-Assistent von Inovimmo, einer Schweizer Immobilienverwaltungsplattform.
Antworte auf Deutsch, kurz und präzise. Nutze Schweizer Schreibweise (CHF, nicht €).

Nutzer: ${profile?.full_name} (${profile?.role})
${wohnung ? `Wohnung: ${wohnung.bezeichnung}, Miete: CHF ${wohnung.nettomiete}/Mt., NK: CHF ${wohnung.nebenkosten_akonto}/Mt.` : ""}
${tickets?.length ? `Offene Tickets: ${tickets.map(t => `${t.titel} (${t.status})`).join(", ")}` : "Keine offenen Tickets."}

Wichtig: Du kannst keine Aktionen ausführen, nur informieren und beraten.
Für Notfälle: Feuerwehr 118, Polizei 117, Sanitäter 144.
`;

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 500,
          system: context,
          messages: [
            ...messages.filter(m => m.role !== "assistant" || messages.indexOf(m) > 0).map(m => ({
              role: m.role, content: m.content
            })),
            { role: "user", content: msg }
          ],
        }),
      });

      const data = await response.json();
      const reply = data.content?.[0]?.text ?? "Entschuldigung, ich konnte keine Antwort generieren.";

      setMessages(m => [...m, { role: "assistant", content: reply, ts: new Date() }]);
    } catch {
      setMessages(m => [...m, {
        role: "assistant",
        content: "Entschuldigung, ich bin momentan nicht erreichbar. Bitte wenden Sie sich direkt an Ihre Verwaltung.",
        ts: new Date()
      }]);
    } finally { setLoading(false); }
  }

  return (
    <div className="max-w-2xl mx-auto h-[calc(100vh-120px)] flex flex-col">
      <div className="mb-4">
        <h2 className="text-xl font-bold text-gray-900">KI-Assistent</h2>
        <p className="text-sm text-gray-500">Powered by Claude · Beantwortet Fragen zu Ihrer Wohnung und Tickets</p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            {m.role === "assistant" && (
              <div className="w-8 h-8 rounded-full bg-[hsl(214,62%,17%)] flex items-center justify-center text-white text-xs font-bold mr-2 flex-shrink-0 mt-1">
                🏛
              </div>
            )}
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${m.role === "user" ? "bg-[hsl(214,76%,49%)] text-white rounded-br-sm" : "bg-white border border-border shadow-sm rounded-bl-sm"}`}>
              <p className={`text-sm leading-relaxed whitespace-pre-wrap ${m.role === "user" ? "text-white" : "text-gray-800"}`}>{m.content}</p>
              <p className={`text-xs mt-1 ${m.role === "user" ? "text-white/60" : "text-gray-400"}`}>
                {m.ts.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" })}
              </p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="w-8 h-8 rounded-full bg-[hsl(214,62%,17%)] flex items-center justify-center text-white text-xs font-bold mr-2">🏛</div>
            <div className="bg-white border border-border shadow-sm rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1">
                {[0,1,2].map(i => <div key={i} className="w-2 h-2 bg-gray-300 rounded-full animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Quick Replies */}
      {messages.length <= 2 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {QUICK_REPLIES.map(q => (
            <button key={q} onClick={() => send(q)} className="text-xs px-3 py-1.5 bg-white border border-gray-200 rounded-full text-gray-600 hover:border-[hsl(214,76%,49%)] hover:text-[hsl(214,76%,49%)] transition-colors">
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="flex gap-3 bg-white border border-border rounded-2xl p-2 shadow-sm">
        <input
          type="text" value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && !e.shiftKey && send()}
          placeholder="Frage stellen…"
          disabled={loading}
          className="flex-1 px-3 py-2 text-sm outline-none bg-transparent"
        />
        <button
          onClick={() => send()} disabled={!input.trim() || loading}
          className="px-4 py-2 bg-[hsl(214,76%,49%)] text-white rounded-xl text-sm font-medium disabled:opacity-40 transition-colors hover:bg-[hsl(214,76%,44%)]"
        >
          Senden
        </button>
      </div>
    </div>
  );
}
