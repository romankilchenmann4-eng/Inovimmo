import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const COOKIE = "inovimmo_impersonate";

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
    .from("profiles").select("id, full_name, role").eq("id", userId).single();
  if (!target) return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 });

  const jar = await cookies();
  jar.set(COOKIE, userId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60, // 1 hour
    path: "/",
  });

  return NextResponse.json({ ok: true, impersonating: target });
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
