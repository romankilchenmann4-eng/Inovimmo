import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createSupabaseAdminClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const COOKIE = "inovimmo_impersonate";

function getSupabaseAdmin() {
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const serviceRoleKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();

  if (!supabaseUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL fehlt");
  if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY fehlt");

  return createSupabaseAdminClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// POST — Admin starts impersonation
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: adminProfile } = await supabase
    .from("profiles").select("role").eq("id", user.id).single();
  if (adminProfile?.role !== "admin") {
    return NextResponse.json({ error: "Nur Admins können Benutzer wechseln" }, { status: 403 });
  }

  const { userId } = await req.json();
  if (!userId || userId === user.id) {
    return NextResponse.json({ error: "Ungültige Benutzer-ID" }, { status: 400 });
  }

  // Verify target user exists
  const { data: target } = await supabase
    .from("profiles").select("id, email, full_name, role").eq("id", userId).single();
  if (!target) return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 });
  if (!target.email) return NextResponse.json({ error: "Zielbenutzer hat keine E-Mail" }, { status: 400 });

  let actionLink: string | undefined;
  try {
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://app.inovimmo.ch").replace(/\/$/, "");
    const supabaseAdmin = getSupabaseAdmin();
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: target.email,
      options: {
        redirectTo: `${baseUrl}/auth/callback?next=/dashboard`,
      },
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    actionLink = data.properties?.action_link;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Impersonation konnte nicht gestartet werden";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  if (!actionLink) {
    return NextResponse.json({ error: "Supabase hat keinen Login-Link erzeugt" }, { status: 500 });
  }

  const jar = await cookies();
  jar.set(COOKIE, userId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60, // 1 hour
    path: "/",
  });

  return NextResponse.json({ ok: true, impersonating: target, actionLink });
}

// DELETE — Admin ends impersonation
export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const jar = await cookies();
  jar.delete(COOKIE);

  return NextResponse.json({ ok: true });
}
