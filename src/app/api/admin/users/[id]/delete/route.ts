import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, requireAdmin } from "@/lib/supabase/admin";

type RouteProps = { params: Promise<{ id: string }> };

export async function DELETE(_req: NextRequest, { params }: RouteProps) {
  const { id: targetUserId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  if (user.id === targetUserId) {
    return NextResponse.json({ error: "Sie können sich nicht selbst löschen" }, { status: 400 });
  }

  let adminClient;
  try {
    adminClient = createAdminClient();
    await requireAdmin(adminClient, user.id);
  } catch {
    return NextResponse.json({ error: "Nur Admins können Benutzer löschen" }, { status: 403 });
  }

  // Delete profile first
  await adminClient.from("profiles").delete().eq("id", targetUserId);

  // Delete auth user
  const { error } = await adminClient.auth.admin.deleteUser(targetUserId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}