import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { messages, context } = await req.json();

  const apiKey = process.env.OLLAMA_API_KEY;
  const baseUrl = process.env.OLLAMA_BASE_URL ?? "https://ollama.cloud";

  if (!apiKey) {
    return NextResponse.json({ error: "KI nicht konfiguriert" }, { status: 503 });
  }

  const systemMessage = { role: "system", content: context || "Du bist ein hilfreicher Assistent." };
  const allMessages = [systemMessage, ...messages];

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "llama3.1:8b",
      messages: allMessages,
      stream: false,
    }),
  });

  if (!response.ok) {
    return NextResponse.json({ error: "KI nicht erreichbar" }, { status: 502 });
  }

  const data = await response.json();
  // Ollama API returns { message: { role, content }, done: true }
  const reply = data.message?.content ?? "Keine Antwort erhalten.";
  return NextResponse.json({ reply });
}
