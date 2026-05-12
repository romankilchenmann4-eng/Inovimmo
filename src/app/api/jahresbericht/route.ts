import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { PDFDocument, rgb, StandardFonts, PDFPage, PDFFont } from "pdf-lib";

export const dynamic = "force-dynamic";

const NAVY = rgb(0.08, 0.18, 0.35);
const DARK = rgb(0.1, 0.1, 0.1);
const GRAY = rgb(0.45, 0.45, 0.45);
const LINE_GRAY = rgb(0.8, 0.8, 0.8);
const FILL_BG = rgb(0.96, 0.97, 1.0);
const GREEN = rgb(0.1, 0.6, 0.3);
const RED = rgb(0.75, 0.1, 0.1);
const WHITE = rgb(1, 1, 1);

function chf(n: number): string {
  return n.toLocaleString("de-CH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function drawHR(page: PDFPage, x1: number, y: number, x2: number, t = 0.5, color = LINE_GRAY) {
  page.drawLine({ start: { x: x1, y }, end: { x: x2, y }, thickness: t, color });
}

function txt(page: PDFPage, text: string, x: number, y: number, font: PDFFont, size: number, color = DARK) {
  if (!text) return;
  page.drawText(text, { x, y, size, font, color });
}

function box(page: PDFPage, x: number, y: number, w: number, h: number, fill = FILL_BG, border = LINE_GRAY) {
  page.drawRectangle({ x, y: y - h, width: w, height: h, color: fill, borderColor: border, borderWidth: 0.5 });
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { liegenschaft_id, jahr } = body as { liegenschaft_id: string; jahr: number };

  if (!liegenschaft_id || !jahr) {
    return NextResponse.json({ error: "liegenschaft_id und jahr sind erforderlich" }, { status: 400 });
  }

  // ── Load all data ─────────────────────────────────────────
  const [
    { data: lgData },
    { data: wohnungen },
    { data: buchungen },
    { data: nkAbrechnungen },
    { data: profile },
  ] = await Promise.all([
    supabase.from("liegenschaften").select("name,strasse,hausnummer,plz,ort,kanton,baujahr,objekttyp,anzahl_wohnungen").eq("id", liegenschaft_id).single(),
    supabase.from("wohnungen").select("id,bezeichnung,etage,zimmer,flaeche_m2,nettomiete,nebenkosten_akonto,status").eq("liegenschaft_id", liegenschaft_id),
    supabase.from("buchungen")
      .select("typ,betrag,valuta,periode_monat,periode_jahr,notiz")
      .eq("liegenschaft_id", liegenschaft_id)
      .eq("periode_jahr", jahr)
      .order("valuta"),
    supabase.from("nebenkostenabrechnungen")
      .select("id,periode_von,periode_bis,status,total_kosten,total_vorschuss")
      .eq("liegenschaft_id", liegenschaft_id)
      .order("periode_von"),
    supabase.from("profiles").select("full_name,firma,adresse,plz,ort").eq("id", user.id).single(),
  ]);

  const lg = lgData;
  if (!lg) return NextResponse.json({ error: "Liegenschaft nicht gefunden" }, { status: 404 });

  const allBuchungen = buchungen ?? [];
  const allWohnungen = wohnungen ?? [];

  // ── Compute financials ────────────────────────────────────
  type BTyp = "miete_soll" | "miete_zahlung" | "nk_soll" | "nk_rueckerstattung" | "kaution_eingang" | "sonstiges_soll" | "sonstiges_haben";
  const sumByTyp = (typ: BTyp) =>
    allBuchungen.filter(b => b.typ === typ).reduce((s, b) => s + Number(b.betrag), 0);

  const mieteSoll = sumByTyp("miete_soll");
  const mieteZahlung = sumByTyp("miete_zahlung");
  const nkSoll = sumByTyp("nk_soll");
  const nkRueck = sumByTyp("nk_rueckerstattung");
  const kautionEingang = sumByTyp("kaution_eingang");
  const sonst = sumByTyp("sonstiges_haben") - sumByTyp("sonstiges_soll");

  const totalEinnahmen = mieteZahlung + nkSoll + kautionEingang + Math.max(0, sonst);
  const totalAusgaben = nkRueck + Math.max(0, -sonst);
  const nettoeinkommen = totalEinnahmen - totalAusgaben;
  const zahlungsquote = mieteSoll > 0 ? Math.round((mieteZahlung / mieteSoll) * 100) : 0;

  const vermName = profile?.firma ?? profile?.full_name ?? "Verwalter";
  const vermAdr = [profile?.adresse, profile?.plz && profile?.ort ? `${profile.plz} ${profile.ort}` : ""].filter(Boolean).join(", ");

  const liegAdr = `${lg.strasse} ${lg.hausnummer}, ${lg.plz} ${lg.ort}`;
  const sollMieteJahrl = allWohnungen.reduce((s, w) => s + Number(w.nettomiete) * 12, 0);
  const leerstand = allWohnungen.filter(w => w.status === "leer").length;
  const vermietet = allWohnungen.filter(w => w.status === "vermietet").length;

  // Monthly cashflow
  const monthlyData: { monat: number; soll: number; zahlung: number }[] = Array.from({ length: 12 }, (_, i) => ({
    monat: i + 1,
    soll: allBuchungen.filter(b => b.typ === "miete_soll" && b.periode_monat === i + 1).reduce((s, b) => s + Number(b.betrag), 0),
    zahlung: allBuchungen.filter(b => b.typ === "miete_zahlung" && b.periode_monat === i + 1).reduce((s, b) => s + Number(b.betrag), 0),
  }));

  // ── Build PDF ─────────────────────────────────────────────
  const pdfDoc = await PDFDocument.create();
  const fontR = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontB = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const W = 595;
  const ML = 40;
  const MR = W - 40;
  const BW = MR - ML;

  // ── PAGE 1: Cover + Summary ───────────────────────────────
  const p1 = pdfDoc.addPage([W, 842]);
  let y = 842;

  // Cover band
  p1.drawRectangle({ x: 0, y: y - 120, width: W, height: 120, color: NAVY });
  txt(p1, "JAHRESBERICHT", 40, y - 38, fontB, 9, rgb(0.6, 0.7, 0.9));
  txt(p1, `${lg.name}`, 40, y - 62, fontB, 22, WHITE);
  txt(p1, liegAdr, 40, y - 80, fontR, 9, rgb(0.75, 0.82, 0.95));
  txt(p1, `Berichtsjahr ${jahr}`, 40, y - 98, fontR, 9, rgb(0.6, 0.7, 0.9));
  txt(p1, `Erstellt von: ${vermName}${vermAdr ? "  ·  " + vermAdr : ""}`, MR - fontR.widthOfTextAtSize(`Erstellt von: ${vermName}`, 8), y - 98, fontR, 8, rgb(0.5, 0.6, 0.8));

  y -= 140;

  // KPI cards
  const kpis = [
    { label: "Bruttomietertrag Soll", value: `CHF ${chf(mieteSoll)}`, sub: "Jahres-Sollmiete", color: NAVY },
    { label: "Mietzahlungen Ist", value: `CHF ${chf(mieteZahlung)}`, sub: `${zahlungsquote}% Zahlungsquote`, color: zahlungsquote >= 95 ? GREEN : RED },
    { label: "Nettoeinkommen", value: `CHF ${chf(nettoeinkommen)}`, sub: "Einnahmen – Ausgaben", color: nettoeinkommen >= 0 ? GREEN : RED },
  ];

  kpis.forEach((kpi, i) => {
    const kx = ML + i * ((BW + 8) / 3);
    const kw = (BW - 16) / 3;
    box(p1, kx, y, kw, 70, rgb(0.97, 0.98, 1.0));
    p1.drawRectangle({ x: kx, y: y - 4, width: kw, height: 4, color: kpi.color });
    txt(p1, kpi.label, kx + 8, y - 14, fontR, 7.5, GRAY);
    txt(p1, kpi.value, kx + 8, y - 34, fontB, 12, kpi.color);
    txt(p1, kpi.sub, kx + 8, y - 50, fontR, 7, GRAY);
  });
  y -= 82;

  // Secondary KPIs
  const kpis2 = [
    { label: "Wohnungen vermietet", value: `${vermietet} / ${allWohnungen.length}` },
    { label: "Leerstand", value: leerstand > 0 ? `${leerstand} Wohnung(en)` : "Keiner" },
    { label: "Jahres-NK (Soll)", value: `CHF ${chf(nkSoll)}` },
    { label: "Kautionseingänge", value: `CHF ${chf(kautionEingang)}` },
  ];
  kpis2.forEach((kpi, i) => {
    const kx = ML + i * ((BW + 8) / 4);
    const kw = (BW - 24) / 4;
    box(p1, kx, y, kw, 38, rgb(0.98, 0.98, 0.99));
    txt(p1, kpi.label, kx + 6, y - 8, fontR, 7, GRAY);
    txt(p1, kpi.value, kx + 6, y - 24, fontB, 9.5, DARK);
  });
  y -= 50;

  // Einnahmen / Ausgaben breakdown
  y -= 10;
  txt(p1, "Erfolgsrechnung", ML, y, fontB, 10, NAVY);
  y -= 16;

  const erItems = [
    { label: "Mietzahlungen (Ist)", betrag: mieteZahlung, positive: true },
    { label: "Nebenkosten Akonto (Soll)", betrag: nkSoll, positive: true },
    { label: "Kautionseingänge", betrag: kautionEingang, positive: true },
    { label: "Sonstige Haben-Buchungen", betrag: Math.max(0, sonst), positive: true },
    { label: "NK-Rückerstattungen", betrag: nkRueck, positive: false },
    { label: "Sonstige Soll-Buchungen", betrag: Math.max(0, -sonst), positive: false },
  ].filter(r => r.betrag > 0);

  erItems.forEach((item, i) => {
    const bg = i % 2 === 0 ? rgb(0.98, 0.98, 0.99) : rgb(1, 1, 1);
    box(p1, ML, y, BW, 14, bg);
    txt(p1, item.label, ML + 6, y - 4, fontR, 8, DARK);
    const valStr = `CHF ${chf(item.betrag)}`;
    const vw = fontB.widthOfTextAtSize(valStr, 8.5);
    txt(p1, valStr, MR - vw - 6, y - 4, fontB, 8.5, item.positive ? GREEN : RED);
    y -= 14;
  });

  // Total
  box(p1, ML, y, BW, 16, rgb(0.9, 0.93, 0.98));
  txt(p1, "Nettoeinkommen", ML + 6, y - 5, fontB, 9, NAVY);
  const netStr = `CHF ${chf(nettoeinkommen)}`;
  const nw = fontB.widthOfTextAtSize(netStr, 10);
  txt(p1, netStr, MR - nw - 6, y - 5, fontB, 10, nettoeinkommen >= 0 ? GREEN : RED);
  y -= 20;

  // Monthly cashflow table
  y -= 14;
  txt(p1, "Monatlicher Mietzinseingang (Soll vs. Ist)", ML, y, fontB, 10, NAVY);
  y -= 14;

  const colW = BW / 14;
  const monthNames = ["Jan","Feb","Mär","Apr","Mai","Jun","Jul","Aug","Sep","Okt","Nov","Dez"];

  // Header
  box(p1, ML, y, BW, 13, rgb(0.88, 0.92, 0.98));
  txt(p1, "Monat", ML + 6, y - 4, fontB, 7.5, NAVY);
  txt(p1, "Soll CHF", ML + colW * 3, y - 4, fontB, 7.5, NAVY);
  txt(p1, "Ist CHF", ML + colW * 7, y - 4, fontB, 7.5, NAVY);
  txt(p1, "Differenz", ML + colW * 10, y - 4, fontB, 7.5, NAVY);
  txt(p1, "%", ML + colW * 13, y - 4, fontB, 7.5, NAVY);
  y -= 13;

  monthlyData.forEach((m, i) => {
    if (m.soll === 0 && m.zahlung === 0) return;
    const bg = i % 2 === 0 ? rgb(0.98, 0.99, 1.0) : rgb(1, 1, 1);
    box(p1, ML, y, BW, 12, bg);
    txt(p1, monthNames[m.monat - 1], ML + 6, y - 3, fontR, 7.5, DARK);
    txt(p1, chf(m.soll), ML + colW * 3, y - 3, fontR, 7.5, DARK);
    txt(p1, chf(m.zahlung), ML + colW * 7, y - 3, fontR, 7.5, m.zahlung >= m.soll ? GREEN : RED);
    const diff = m.zahlung - m.soll;
    txt(p1, (diff >= 0 ? "+" : "") + chf(diff), ML + colW * 10, y - 3, fontR, 7.5, diff >= 0 ? GREEN : RED);
    const pct = m.soll > 0 ? Math.round((m.zahlung / m.soll) * 100) : 0;
    txt(p1, `${pct}%`, ML + colW * 13, y - 3, fontR, 7.5, pct >= 95 ? GREEN : RED);
    y -= 12;
  });

  // Footer
  txt(p1, `Jahresbericht ${jahr} · ${lg.name} · Erstellt ${new Date().toLocaleDateString("de-CH")} · Seite 1/2`, ML, 28, fontR, 7, GRAY);

  // ── PAGE 2: Wohnung details + NK + Hinweise ───────────────
  const p2 = pdfDoc.addPage([W, 842]);
  y = 820;

  txt(p2, `Jahresbericht ${jahr} – ${lg.name}`, ML, y, fontB, 12, NAVY);
  txt(p2, `${liegAdr} · ${lg.objekttyp ?? ""} · Baujahr ${lg.baujahr ?? "–"}`, ML, y - 14, fontR, 8, GRAY);
  y -= 28;
  drawHR(p2, ML, y, MR, 1, NAVY);
  y -= 14;

  // Wohnungsübersicht
  txt(p2, "Wohnungsübersicht", ML, y, fontB, 10, NAVY);
  y -= 14;

  const wColW = [BW * 0.25, BW * 0.1, BW * 0.08, BW * 0.1, BW * 0.15, BW * 0.16, BW * 0.16];
  const wHeaders = ["Bezeichnung", "Etage", "Zi.", "m²", "Nettomiete", "NK Akonto", "Status"];

  box(p2, ML, y, BW, 13, rgb(0.88, 0.92, 0.98));
  let cx = ML + 4;
  wHeaders.forEach((h, i) => {
    txt(p2, h, cx, y - 4, fontB, 7.5, NAVY);
    cx += wColW[i];
  });
  y -= 13;

  const STATUS_LABEL: Record<string, string> = { vermietet: "Vermietet", leer: "Leer", kuendigung: "Kündigung" };

  allWohnungen.forEach((w, idx) => {
    const bg = idx % 2 === 0 ? rgb(0.98, 0.99, 1.0) : rgb(1, 1, 1);
    box(p2, ML, y, BW, 12, bg);
    cx = ML + 4;
    const cells = [
      w.bezeichnung,
      w.etage === 0 ? "EG" : w.etage < 0 ? "UG" : `${w.etage}.OG`,
      String(w.zimmer),
      w.flaeche_m2 ? `${w.flaeche_m2}` : "–",
      `CHF ${chf(Number(w.nettomiete))}`,
      `CHF ${chf(Number(w.nebenkosten_akonto))}`,
      STATUS_LABEL[w.status] ?? w.status,
    ];
    cells.forEach((cell, i) => {
      const color = i === 6 && w.status === "leer" ? RED : i === 6 && w.status === "vermietet" ? GREEN : DARK;
      txt(p2, cell, cx, y - 3, i === 0 ? fontB : fontR, 7.5, color);
      cx += wColW[i];
    });
    y -= 12;
  });

  // Totals row
  box(p2, ML, y, BW, 13, rgb(0.9, 0.93, 0.98));
  txt(p2, "Jahres-Soll (12 Monate)", ML + 4, y - 4, fontB, 8, NAVY);
  txt(p2, `CHF ${chf(sollMieteJahrl)}`, ML + BW * 0.75, y - 4, fontB, 8, NAVY);
  y -= 17;

  // NK Abrechnungen
  if (nkAbrechnungen && nkAbrechnungen.length > 0) {
    y -= 10;
    txt(p2, "Nebenkostenabrechnungen", ML, y, fontB, 10, NAVY);
    y -= 14;

    box(p2, ML, y, BW, 12, rgb(0.88, 0.92, 0.98));
    txt(p2, "Periode", ML + 4, y - 4, fontB, 7.5, NAVY);
    txt(p2, "Total Kosten", ML + BW * 0.35, y - 4, fontB, 7.5, NAVY);
    txt(p2, "Vorschüsse", ML + BW * 0.55, y - 4, fontB, 7.5, NAVY);
    txt(p2, "Saldo", ML + BW * 0.75, y - 4, fontB, 7.5, NAVY);
    txt(p2, "Status", ML + BW * 0.88, y - 4, fontB, 7.5, NAVY);
    y -= 12;

    nkAbrechnungen.forEach((nk, i) => {
      const bg = i % 2 === 0 ? rgb(0.98, 0.99, 1.0) : rgb(1, 1, 1);
      box(p2, ML, y, BW, 12, bg);
      const vonStr = nk.periode_von ? new Date(nk.periode_von).toLocaleDateString("de-CH", { month: "2-digit", year: "numeric" }) : "–";
      const bisStr = nk.periode_bis ? new Date(nk.periode_bis).toLocaleDateString("de-CH", { month: "2-digit", year: "numeric" }) : "–";
      const saldo = (Number(nk.total_kosten) || 0) - (Number(nk.total_vorschuss) || 0);
      txt(p2, `${vonStr} – ${bisStr}`, ML + 4, y - 3, fontR, 7.5, DARK);
      txt(p2, nk.total_kosten ? `CHF ${chf(Number(nk.total_kosten))}` : "–", ML + BW * 0.35, y - 3, fontR, 7.5, DARK);
      txt(p2, nk.total_vorschuss ? `CHF ${chf(Number(nk.total_vorschuss))}` : "–", ML + BW * 0.55, y - 3, fontR, 7.5, DARK);
      txt(p2, nk.total_kosten ? `${saldo >= 0 ? "+" : ""}CHF ${chf(saldo)}` : "–", ML + BW * 0.75, y - 3, fontR, 7.5, saldo >= 0 ? RED : GREEN);
      txt(p2, nk.status ?? "–", ML + BW * 0.88, y - 3, fontR, 7.5, GRAY);
      y -= 12;
    });
  }

  // Hinweis
  y -= 20;
  drawHR(p2, ML, y, MR);
  y -= 12;
  txt(p2, "Hinweis", ML, y, fontB, 9, NAVY);
  y -= 12;
  const hinweis = [
    "Dieser Bericht wurde automatisch durch Inovimmo auf Basis der erfassten Buchungen generiert.",
    "Alle Angaben ohne Gewähr. Massgebend sind die vollständige Buchhaltung und die Originaldokumente.",
    "Die Zahlen beziehen sich ausschliesslich auf das Berichtsjahr " + jahr + " und die ausgewählte Liegenschaft.",
  ];
  hinweis.forEach(line => {
    txt(p2, line, ML, y, fontR, 7.5, GRAY);
    y -= 11;
  });

  // Footer
  txt(p2, `Jahresbericht ${jahr} · ${lg.name} · Erstellt ${new Date().toLocaleDateString("de-CH")} · ${vermName} · Seite 2/2`, ML, 28, fontR, 7, GRAY);

  const pdfBytes = await pdfDoc.save();
  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Jahresbericht_${jahr}_${lg.name.replace(/\s/g, "_")}.pdf"`,
    },
  });
}
