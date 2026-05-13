"use client";

import { useState, useRef, useEffect } from "react";

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
      const response = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: msg,
          history: messages.map(m => ({ role: m.role, content: m.content })),
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "KI-Antwort fehlgeschlagen");
      const reply = data.reply ?? "Entschuldigung, ich konnte keine Antwort generieren.";

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
