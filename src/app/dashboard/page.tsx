const [
  { count: totalWohnungen },
  { count: belegteWohnungen },
  { count: offeneTickets },
  { count: dringendeTickets },
  { data: escrows },
  { data: recentTickets },
  { data: liegenschaften },
  { data: mieten }, // 👈 NEU
] = await Promise.all([
  supabase.from("wohnungen").select("*", { count: "exact", head: true }),
  supabase.from("wohnungen").select("*", { count: "exact", head: true }).eq("status", "vermietet"),
  supabase.from("tickets").select("*", { count: "exact", head: true }).in("status", ["neu","ausgeschrieben","offerten_eingegangen"]),
  supabase.from("tickets").select("*", { count: "exact", head: true }).eq("prioritaet", "notfall").in("status", ["neu","ausgeschrieben"]),
  supabase.from("escrows").select("betrag").in("status", ["einbezahlt","in_ausfuehrung"]),
  supabase.from("tickets").select("id,titel,prioritaet,status,created_at,liegenschaft:liegenschaften(name)").order("created_at", { ascending: false }).limit(5),
  supabase.from("liegenschaften").select("id,name,ort,anzahl_wohnungen").limit(5),
  supabase.from("wohnungen").select("brutto_miete"), // 👈 HIER
]);
