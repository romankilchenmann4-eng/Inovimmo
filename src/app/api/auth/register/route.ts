import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

const VALID_ROLES = ["verwalter", "mieter", "dienstleister", "admin"] as const;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: NextRequest) {
  let body: { email?: string; password?: string; full_name?: string; firma?: string; role?: string };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }

  const { email, password, full_name, firma, role } = body;

  // Pflichtfelder prüfen
  if (!email || !password || !full_name) {
    return NextResponse.json({ error: "E-Mail, Passwort und Name sind erforderlich" }, { status: 400 });
  }

  // Email-Validierung
  const emailTrimmed = String(email).trim();
  if (!EMAIL_REGEX.test(emailTrimmed)) {
    return NextResponse.json({ error: "Ungültige E-Mail-Adresse" }, { status: 400 });
  }

  // Passwort-Stärke prüfen (mind. 8 Zeichen)
  const passwordStr = String(password);
  if (passwordStr.length < 8) {
    return NextResponse.json({ error: "Passwort muss mindestens 8 Zeichen haben" }, { status: 400 });
  }

  // Role validieren
  const roleToUse = VALID_ROLES.includes(role as any) ? role : "verwalter";

  // Name validieren (XSS-Schutz)
  const nameTrimmed = String(full_name).trim();
  if (nameTrimmed.length < 2 || nameTrimmed.length > 100) {
    return NextResponse.json({ error: "Name muss zwischen 2 und 100 Zeichen haben" }, { status: 400 });
  }

  // HTML/Script-Tags erkennen
  const dangerousPattern = /[<>]/;
  if (dangerousPattern.test(nameTrimmed) || dangerousPattern.test(emailTrimmed)) {
    return NextResponse.json({ error: "Ungültige Zeichen im Namen oder der E-Mail" }, { status: 400 });
  }

  try {
    const supabase = createAdminClient();

    const { data, error } = await supabase.auth.admin.createUser({
      email: emailTrimmed,
      password: passwordStr,
      email_confirm: true,
      user_metadata: {
        full_name: nameTrimmed,
        firma: firma ? String(firma).slice(0, 200) : "",
        role: roleToUse,
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Profile erstellen
    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({
        id: data.user.id,
        email: emailTrimmed,
        full_name: nameTrimmed,
        role: roleToUse,
        firma: firma ? String(firma).slice(0, 200) : "",
      });

    if (profileError) {
      console.error("Profile creation failed:", profileError.message);
      // User wurde erstellt, aber Profile fehlgeschlagen - Admin benachrichtigen
    }

    return NextResponse.json({ success: true, userId: data.user.id });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Registrierung fehlgeschlagen";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
