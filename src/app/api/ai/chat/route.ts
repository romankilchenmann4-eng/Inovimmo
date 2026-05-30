import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Sanitize user-provided strings before embedding in system prompt.
 * Strips control characters, HTML tags, and truncates to maxLength.
 */
function sanitizePromptInput(input: unknown, maxLength: number = 200): string {
  return String(input ?? "")
    .replace(/[\x00-\x1F\x7F]/g, "")
    .replace(/[<>]/g, "")
    .slice(0, maxLength)
    .trim();
}

type ChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const apiKey = process.env.OLLAMA_API_KEY;
  const baseUrl = process.env.OLLAMA_BASE_URL ?? "https://ollama.cloud";

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

  const [{ data: profile }, { data: tickets }] = await Promise.all([
    supabase.from("profiles").select("full_name,role").eq("id", user.id).single(),
    supabase
      .from("tickets")
      .select("titel,status,prioritaet,created_at")
      .eq("erstellt_von", user.id)
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const admin = createAdminClient();
  const { data: mietverhaeltnisse } = user.email
    ? await admin
      .from("mietverhaeltnisse")
      .select("mieter:mieter_id!inner(email), wohnung:wohnungen(bezeichnung,nettomiete,nebenkosten_akonto,status)")
      .ilike("mieter.email", user.email)
      .is("mietende", null)
      .order("mietbeginn", { ascending: false })
      .limit(1)
    : { data: null };

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

  const systemPrompt = `
Du bist der freundliche KI-Assistent von Inovimmo, einer Schweizer Immobilienverwaltungsplattform.
Antworte auf Deutsch, kurz und präzise. Nutze Schweizer Schreibweise.

Nutzer: ${sanitizePromptInput(profile?.full_name)} (${sanitizePromptInput(profile?.role)})
${wohnung ? `Wohnung: ${sanitizePromptInput(wohnung.bezeichnung)}, Miete: CHF ${wohnung.nettomiete}/Mt., NK: CHF ${wohnung.nebenkosten_akonto}/Mt.` : ""}
${tickets?.length ? `Letzte Tickets: ${tickets.map((t) => `${sanitizePromptInput(t.titel)} (${sanitizePromptInput(t.status)})`).join(", ")}` : "Keine Tickets im Kontext."}

Wichtig: Du kannst keine Aktionen ausführen, nur informieren und beraten.
Für Notfälle: Feuerwehr 118, Polizei 117, Sanität 144.
`;

  const messages = [
    { role: "system", content: systemPrompt },
    ...safeHistory,
    { role: "user", content: message.trim() },
  ];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gemma3:4b",
        messages,
        stream: false,
      }),
      signal: controller.signal,
    });

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(
        { error: data?.error?.message ?? "KI-Antwort fehlgeschlagen." },
        { status: response.status }
      );
    }

    // Ollama API returns { message: { role, content }, done: true }
    return NextResponse.json({
      reply: data.message?.content ?? "Ich konnte keine Antwort generieren.",
    });
  } finally {
    clearTimeout(timeout);
  }
}
