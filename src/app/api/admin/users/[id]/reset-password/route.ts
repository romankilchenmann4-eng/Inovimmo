import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, requireAdmin } from "@/lib/supabase/admin";

type RouteProps = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: RouteProps) {
  const { id: targetUserId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  let adminClient;
  try {
    adminClient = createAdminClient();
    await requireAdmin(adminClient, user.id);
  } catch {
    return NextResponse.json({ error: "Nur Admins können Passwörter zurücksetzen" }, { status: 403 });
  }

  // Get user email from auth
  const { data: { user: targetUser }, error: fetchError } = await adminClient.auth.admin.getUserById(targetUserId);
  if (fetchError || !targetUser?.email) {
    return NextResponse.json({ error: "Benutzer nicht gefunden" }, { status: 404 });
  }

  // Generate password reset link — Supabase sends the email automatically
  const { error } = await adminClient.auth.admin.generateLink({
    type: "recovery",
    email: targetUser.email,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, email: targetUser.email });
}