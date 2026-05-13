import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "KI ist nicht konfiguriert." }, { status: 503 });
  }

  const { message, history = [] } = (await req.json()) as {
    message?: string;
    history?: ChatMessage[];
  };

  if (!message?.trim()) {
    return NextResponse.json({ error: "Nachricht fehlt." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 });
  }

  const [{ data: profile }, { data: tickets }, { data: mietverhaeltnisse }] = await Promise.all([
    supabase.from("profiles").select("full_name,role").eq("id", user.id).single(),
    supabase
      .from("tickets")
      .select("titel,status,prioritaet,created_at")
      .eq("erstellt_von", user.id)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("mietverhaeltnisse")
      .select("wohnung:wohnungen(bezeichnung,nettomiete,nebenkosten_akonto,status)")
      .eq("mieter_id", user.id)
      .limit(1),
  ]);

  const rawWohnung = Array.isArray(mietverhaeltnisse) ? mietverhaeltnisse[0]?.wohnung : null;
  const wohnung = (Array.isArray(rawWohnung) ? rawWohnung[0] : rawWohnung) as {
    bezeichnung?: string;
    nettomiete?: number;
    nebenkosten_akonto?: number;
  } | null;
  const safeHistory = history
    .filter((m) => m.role === "user" || m.role === "assistant")
    .slice(-8)
    .map((m) => ({ role: m.role, content: String(m.content).slice(0, 2000) }));

  const system = `
Du bist der freundliche KI-Assistent von Inovimmo, einer Schweizer Immobilienverwaltungsplattform.
Antworte auf Deutsch, kurz und präzise. Nutze Schweizer Schreibweise.

Nutzer: ${profile?.full_name ?? "Unbekannt"} (${profile?.role ?? "unbekannte Rolle"})
${wohnung ? `Wohnung: ${wohnung.bezeichnung}, Miete: CHF ${wohnung.nettomiete}/Mt., NK: CHF ${wohnung.nebenkosten_akonto}/Mt.` : ""}
${tickets?.length ? `Letzte Tickets: ${tickets.map((t) => `${t.titel} (${t.status})`).join(", ")}` : "Keine Tickets im Kontext."}

Wichtig: Du kannst keine Aktionen ausführen, nur informieren und beraten.
Für Notfälle: Feuerwehr 118, Polizei 117, Sanität 144.
`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-20250514",
      max_tokens: 500,
      system,
      messages: [...safeHistory, { role: "user", content: message.trim() }],
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    return NextResponse.json(
      { error: data?.error?.message ?? "KI-Antwort fehlgeschlagen." },
      { status: response.status }
    );
  }

  return NextResponse.json({
    reply: data.content?.[0]?.text ?? "Ich konnte keine Antwort generieren.",
  });
}
