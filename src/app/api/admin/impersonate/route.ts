import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, requireAdmin } from "@/lib/supabase/admin";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const COOKIE = "inovimmo_impersonate";
const IMPERSONATION_MAX_AGE = 60 * 60; // 1 hour

// POST — Admin starts impersonation
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Admin-Check mit zentraler Funktion
  try {
    await requireAdmin(supabase, user.id);
  } catch {
    return NextResponse.json({ error: "Nur Admins können Benutzer wechseln" }, { status: 403 });
  }

  let body: { userId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Ungültige Anfrage" }, { status: 400 });
  }

  const { userId } = body;

  // Validierung der Ziel-User-ID
  if (!userId || typeof userId !== "string") {
    return NextResponse.json({ error: "Benutzer-ID fehlt" }, { status: 400 });
  }

  // Nicht sich selbst impersonieren
  if (userId === user.id) {
    return NextResponse.json({ error: "Kann nicht sich selbst impersonieren" }, { status: 400 });
  }

  // UUID-Format prüfen
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(userId)) {
    return NextResponse.json({ error: "Ungültige Benutzer-ID" }, { status: 400 });
  }

  // Zielbenutzer existiert?
  const { data: target, error: targetError } = await supabase
    .from("profiles")
    .select("id, email, full_name, role")
    .eq("id", userId)
    .single();

  if (targetError || !target) {
    return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 });
  }

  if (!target.email) {
    return NextResponse.json({ error: "Zielbenutzer hat keine E-Mail" }, { status: 400 });
  }

  // Magic Link generieren
  let actionLink: string | undefined;
  try {
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://app.inovimmo.ch").replace(/\/$/, "");
    const supabaseAdmin = createAdminClient();
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: target.email,
      options: {
        redirectTo: `${baseUrl}/auth/callback?next=/dashboard`,
      },
    });

    if (error) {
      console.error("Impersonation Link Error:", error.message);
      return NextResponse.json({ error: "Login-Link konnte nicht generiert werden" }, { status: 500 });
    }
    actionLink = data.properties?.action_link;
  } catch (err) {
    console.error("Impersonation Exception:", err);
    const message = err instanceof Error ? err.message : "Impersonation fehlgeschlagen";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  if (!actionLink) {
    return NextResponse.json({ error: "Login-Link nicht verfügbar" }, { status: 500 });
  }

  // Secure Cookie setzen
  const jar = await cookies();
  jar.set(COOKIE, userId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: IMPERSONATION_MAX_AGE,
    path: "/",
  });

  // Audit-Logging in Datenbank
  try {
    await supabase.from("audit_log").insert({
      action: "impersonation_start",
      actor_id: user.id,
      target_id: userId,
      details: { target_email: target.email, target_role: target.role },
    });
  } catch {
    // Audit-Log-Fehler soll den Vorgang nicht blockieren
  }

  console.log(`Impersonation: Admin ${user.id} wechselt zu ${userId} (${target.email})`);

  return NextResponse.json({ ok: true, impersonating: { id: target.id, full_name: target.full_name, role: target.role } });
}

// DELETE — End impersonation
export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await requireAdmin(supabase, user.id);
  } catch {
    return NextResponse.json({ error: "Nur Admins können Impersonation beenden" }, { status: 403 });
  }

  const jar = await cookies();
  jar.delete(COOKIE);

  return NextResponse.json({ ok: true });
}
