import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const requestUrl = new URL(req.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next") || "/dashboard";

  if (code) {
    const supabase = await createClient();
    await supabase.auth.exchangeCodeForSession(code);
  }

  // Prevent open redirect: only allow relative paths
  if (!next.startsWith("/") || next.startsWith("//")) {
    return NextResponse.redirect(new URL("/dashboard", requestUrl.origin));
  }

  return NextResponse.redirect(new URL(next, requestUrl.origin));
}
