import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// POST — Verwalter erstellt Einladungstoken für neuen Mieter
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "verwalter" && profile?.role !== "admin") {
    return NextResponse.json({ error: "Nur Verwalter können Einladungen erstellen" }, { status: 403 });
  }

  const body = await req.json();
  const { wohnung_id, mieter_email, mieter_vorname, mieter_nachname, mietbeginn, nettomiete } = body;

  if (!wohnung_id || !mieter_email) {
    return NextResponse.json({ error: "wohnung_id und mieter_email sind erforderlich" }, { status: 400 });
  }

  // Verify the wohnung belongs to a liegenschaft managed by this verwalter
  const { data: wohnung } = await supabase
    .from("wohnungen")
    .select("id, bezeichnung, liegenschaft:liegenschaften(verwalter_id, name)")
    .eq("id", wohnung_id)
    .single();

  const lg = wohnung?.liegenschaft as unknown as { verwalter_id: string; name: string } | null;
  if (!lg || lg.verwalter_id !== user.id) {
    return NextResponse.json({ error: "Wohnung nicht gefunden oder keine Berechtigung" }, { status: 403 });
  }

  // Invalidate old unused tokens for same wohnung
  await supabase.from("onboarding_tokens")
    .update({ used_at: new Date().toISOString() })
    .eq("wohnung_id", wohnung_id)
    .is("used_at", null);

  const { data: token, error } = await supabase
    .from("onboarding_tokens")
    .insert({
      wohnung_id,
      verwalter_id: user.id,
      mieter_email,
      mieter_vorname: mieter_vorname ?? null,
      mieter_nachname: mieter_nachname ?? null,
      mietbeginn: mietbeginn ?? null,
      nettomiete: nettomiete ?? null,
    })
    .select("token")
    .single();

  if (error || !token) {
    return NextResponse.json({ error: error?.message ?? "Token-Erstellung fehlgeschlagen" }, { status: 500 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://inovimmo.ch";
  const link = `${baseUrl}/onboarding/${token.token}`;

  // Send invitation email
  try {
    const { data: { user: verwalterUser } } = await supabase.auth.getUser();
    const { data: verwalterProfile } = await supabase.from("profiles").select("full_name,firma").eq("id", user.id).single();
    const verwalterName = verwalterProfile?.firma ?? verwalterProfile?.full_name ?? "Ihr Verwalter";

    await fetch(`${baseUrl}/api/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "willkommen",
        to: mieter_email,
        data: {
          name: `${mieter_vorname ?? ""} ${mieter_nachname ?? ""}`.trim() || "Neuer Mieter",
          wohnung: wohnung?.bezeichnung ?? "",
          liegenschaft: lg.name,
          verwalter: verwalterName,
          onboarding_link: link,
        },
      }),
    });
  } catch {
    // Email send failure is non-fatal
  }

  return NextResponse.json({ token: token.token, link });
}

// GET — Validiert einen Token (public, kein Auth)
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ valid: false, error: "Token fehlt" }, { status: 400 });

  const supabase = await createClient();
  const { data } = await supabase
    .from("onboarding_tokens")
    .select(`
      token, mieter_email, mieter_vorname, mieter_nachname, mietbeginn, nettomiete, expires_at, used_at,
      wohnung:wohnungen(id, bezeichnung, etage, zimmer, nettomiete,
        liegenschaft:liegenschaften(name, strasse, hausnummer, plz, ort))
    `)
    .eq("token", token)
    .single();

  if (!data) return NextResponse.json({ valid: false, error: "Ungültiger Token" }, { status: 404 });
  if (data.used_at) return NextResponse.json({ valid: false, error: "Einladung bereits verwendet" }, { status: 410 });
  if (new Date(data.expires_at) < new Date()) return NextResponse.json({ valid: false, error: "Einladung abgelaufen" }, { status: 410 });

  return NextResponse.json({ valid: true, data });
}
