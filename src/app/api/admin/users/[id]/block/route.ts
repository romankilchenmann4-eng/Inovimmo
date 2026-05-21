import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient, requireAdmin } from "@/lib/supabase/admin";

type RouteProps = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: RouteProps) {
  const { id: targetUserId } = await params;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Nicht autorisiert" }, { status: 401 });
  }

  if (user.id === targetUserId) {
    return NextResponse.json({ error: "Sie können sich nicht selbst sperren" }, { status: 400 });
  }

  let adminClient;
  try {
    adminClient = createAdminClient();
    await requireAdmin(adminClient, user.id);
  } catch {
    return NextResponse.json({ error: "Nur Admins können Benutzer sperren" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const block = body.block !== false;

  if (block) {
    const { error } = await adminClient.auth.admin.updateUserById(targetUserId, {
      ban_duration: "876000h",
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  } else {
    const { error } = await adminClient.auth.admin.updateUserById(targetUserId, {
      ban_duration: "none",
    });
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }

  return NextResponse.json({ success: true, blocked: block });
}