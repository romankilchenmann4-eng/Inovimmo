import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendWillkommen } from "@/lib/email";

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

  let body: {
    wohnung_id?: string;
    mieter_email?: string;
    mieter_vorname?: string;
    mieter_nachname?: string;
    mietbeginn?: string;
    nettomiete?: number;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }

  const { wohnung_id, mieter_email, mieter_vorname, mieter_nachname, mietbeginn, nettomiete } = body;

  // Pflichtfelder
  if (!wohnung_id || !mieter_email) {
    return NextResponse.json({ error: "wohnung_id und mieter_email sind erforderlich" }, { status: 400 });
  }

  // UUID-Format prüfen
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(wohnung_id)) {
    return NextResponse.json({ error: "Ungültige wohnung_id" }, { status: 400 });
  }

  // Email-Validierung
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const emailTrimmed = String(mieter_email).trim();
  if (!emailRegex.test(emailTrimmed)) {
    return NextResponse.json({ error: "Ungültige E-Mail-Adresse" }, { status: 400 });
  }

  // Namen validieren (Länge + XSS-Schutz)
  const vorname = mieter_vorname ? String(mieter_vorname).trim() : null;
  const nachname = mieter_nachname ? String(mieter_nachname).trim() : null;
  const dangerousPattern = /[<>]/;

  if (vorname && (vorname.length < 1 || vorname.length > 50 || dangerousPattern.test(vorname))) {
    return NextResponse.json({ error: "Ungültiger Vorname" }, { status: 400 });
  }
  if (nachname && (nachname.length < 1 || nachname.length > 50 || dangerousPattern.test(nachname))) {
    return NextResponse.json({ error: "Ungültiger Nachname" }, { status: 400 });
  }

  // Mietbeginn validieren (ISO-Format)
  if (mietbeginn) {
    const datePattern = /^\d{4}-\d{2}-\d{2}$/;
    if (!datePattern.test(mietbeginn) || isNaN(Date.parse(mietbeginn))) {
      return NextResponse.json({ error: "Ungültiges Mietbeginn-Format" }, { status: 400 });
    }
  }

  // Nettomiete validieren
  if (nettomiete !== null && nettomiete !== undefined) {
    if (typeof nettomiete !== "number" || nettomiete < 0 || nettomiete > 100000) {
      return NextResponse.json({ error: "Ungültige Nettomiete" }, { status: 400 });
    }
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
      mieter_email: emailTrimmed,
      mieter_vorname: vorname,
      mieter_nachname: nachname,
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

  // Send invitation email directly (no self-HTTP call)
  try {
    const { data: verwalterProfile } = await supabase.from("profiles").select("full_name,firma").eq("id", user.id).single();
    const verwalterName = verwalterProfile?.firma ?? verwalterProfile?.full_name ?? "Ihr Verwalter";

    await sendWillkommen({
      to: mieter_email,
      name: `${mieter_vorname ?? ""} ${mieter_nachname ?? ""}`.trim() || "Neuer Mieter",
      role: "mieter",
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

// PATCH — Mieter schliesst Einladung ab und wird mit Stammdaten/Mietverhältnis verknüpft
export async function PATCH(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { token, vorname, nachname, phone, geburtsdatum, nationalitaet } = await req.json();
  if (!token) return NextResponse.json({ error: "Token fehlt" }, { status: 400 });

  const admin = createAdminClient();
  const { data: tokenData, error: tokenError } = await admin
    .from("onboarding_tokens")
    .select("token, wohnung_id, verwalter_id, mieter_email, mieter_vorname, mieter_nachname, mietbeginn, expires_at, used_at")
    .eq("token", token)
    .single();

  if (tokenError || !tokenData) {
    return NextResponse.json({ error: "Ungültiger Token" }, { status: 404 });
  }
  if (tokenData.used_at) {
    return NextResponse.json({ error: "Einladung bereits verwendet" }, { status: 410 });
  }
  if (new Date(tokenData.expires_at) < new Date()) {
    return NextResponse.json({ error: "Einladung abgelaufen" }, { status: 410 });
  }
  if (tokenData.mieter_email.toLowerCase() !== user.email.toLowerCase()) {
    return NextResponse.json({ error: "Einladung gehört zu einer anderen E-Mail-Adresse" }, { status: 403 });
  }

  const firstName = String(vorname || tokenData.mieter_vorname || "").trim();
  const lastName = String(nachname || tokenData.mieter_nachname || "").trim();
  if (!firstName || !lastName) {
    return NextResponse.json({ error: "Vorname und Nachname sind erforderlich" }, { status: 400 });
  }

  await admin.from("profiles").update({
    full_name: `${firstName} ${lastName}`.trim(),
    phone: phone || null,
    role: "mieter",
  }).eq("id", user.id);

  const existing = await admin
    .from("mieter")
    .select("id")
    .eq("verwalter_id", tokenData.verwalter_id)
    .ilike("email", user.email)
    .maybeSingle();

  let mieterId = existing.data?.id as string | undefined;
  if (mieterId) {
    await admin.from("mieter").update({
      vorname: firstName,
      nachname: lastName,
      telefon_mobil: phone || null,
      geburtsdatum: geburtsdatum || null,
    }).eq("id", mieterId);
  } else {
    const { data: newMieter, error: mieterError } = await admin
      .from("mieter")
      .insert({
        verwalter_id: tokenData.verwalter_id,
        vorname: firstName,
        nachname: lastName,
        email: user.email,
        telefon_mobil: phone || null,
        geburtsdatum: geburtsdatum || null,
      })
      .select("id")
      .single();

    if (mieterError || !newMieter) {
      return NextResponse.json({ error: mieterError?.message ?? "Mieter konnte nicht erstellt werden" }, { status: 500 });
    }
    mieterId = newMieter.id;
  }

  const { data: existingLease } = await admin
    .from("mietverhaeltnisse")
    .select("id")
    .eq("wohnung_id", tokenData.wohnung_id)
    .eq("mieter_id", mieterId)
    .is("mietende", null)
    .maybeSingle();

  if (!existingLease) {
    const { error: leaseError } = await admin.from("mietverhaeltnisse").insert({
      wohnung_id: tokenData.wohnung_id,
      mieter_id: mieterId,
      mietbeginn: tokenData.mietbeginn ?? new Date().toISOString().slice(0, 10),
      ist_vertragspartner: true,
      ist_hauptperson: true,
    });

    if (leaseError) {
      return NextResponse.json({ error: leaseError.message }, { status: 500 });
    }
  }

  await admin.from("wohnungen").update({ status: "vermietet" }).eq("id", tokenData.wohnung_id);
  await admin.from("onboarding_tokens").update({ used_at: new Date().toISOString() }).eq("token", token);

  return NextResponse.json({ ok: true });
}
