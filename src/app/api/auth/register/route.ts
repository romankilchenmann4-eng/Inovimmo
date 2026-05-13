import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { email, password, full_name, firma, role } = await req.json();

  if (!email || !password || !full_name) {
    return NextResponse.json({ error: "Pflichtfelder fehlen" }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  const res = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
    },
    body: JSON.stringify({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name, firma: firma ?? "", role: role ?? "verwalter" },
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    return NextResponse.json({ error: data.msg ?? data.message ?? "Registrierung fehlgeschlagen" }, { status: res.status });
  }

  return NextResponse.json({ success: true });
}
