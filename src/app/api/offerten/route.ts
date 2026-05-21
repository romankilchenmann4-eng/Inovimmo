import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// POST /api/offerten — Dienstleister submits a new offer for a ticket
export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (profile?.role !== "dienstleister" && profile?.role !== "admin") {
    return NextResponse.json({ error: "Nur Dienstleister können Offerten einreichen" }, { status: 403 });
  }

  const body = await req.json();
  const { ticket_id, betrag, beschreibung, verfuegbar_ab, garantie_monate } = body;

  if (!ticket_id || !betrag || !beschreibung || !verfuegbar_ab) {
    return NextResponse.json({ error: "Pflichtfelder fehlen" }, { status: 400 });
  }

  // Verify ticket is still open for offers
  const { data: ticket } = await supabase
    .from("tickets")
    .select("status")
    .eq("id", ticket_id)
    .single();

  if (!ticket || !["ausgeschrieben", "offerten_eingegangen"].includes(ticket.status)) {
    return NextResponse.json({ error: "Ticket ist nicht mehr offen für Offerten" }, { status: 409 });
  }

  // Prevent duplicate offer from same dienstleister
  const { data: existing } = await supabase
    .from("offerten")
    .select("id")
    .eq("ticket_id", ticket_id)
    .eq("dienstleister_id", user.id)
    .neq("status", "zurueckgezogen")
    .single();

  if (existing) {
    return NextResponse.json({ error: "Sie haben für dieses Ticket bereits eine Offerte eingereicht" }, { status: 409 });
  }

  const { data: offerte, error } = await supabase
    .from("offerten")
    .insert({
      ticket_id,
      dienstleister_id: user.id,
      betrag: parseFloat(betrag),
      beschreibung,
      verfuegbar_ab,
      garantie_monate: garantie_monate ? parseInt(garantie_monate) : null,
    })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Update ticket status to offerten_eingegangen if still ausgeschrieben
  if (ticket.status === "ausgeschrieben") {
    await supabase
      .from("tickets")
      .update({ status: "offerten_eingegangen" })
      .eq("id", ticket_id);
  }

  return NextResponse.json({ offerte });
}

// DELETE /api/offerten?id=... — Dienstleister withdraws their offer
export async function DELETE(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id fehlt" }, { status: 400 });

  const { count, error } = await supabase
    .from("offerten")
    .update({ status: "zurueckgezogen" }, { count: "exact" })
    .eq("id", id)
    .eq("dienstleister_id", user.id)
    .eq("status", "eingegangen");

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!count || count === 0) return NextResponse.json({ error: "Offerte nicht gefunden oder bereits zurückgezogen" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
