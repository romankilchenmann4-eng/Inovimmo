import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

type ErhoehungRow = {
  id: string;
  titel: string;
  grund: string;
  status: string;
  created_at: string;
  liegenschaft: { name: string; strasse: string; hausnummer: string; plz: string; ort: string } | null;
};

type PositionRow = {
  id: string;
  wohnung_bezeichnung: string;
  aktueller_mietzins: number;
  neuer_mietzins: number;
  differenz: number;
  gueltig_ab: string;
  status: string;
};

const GRUND_LABEL: Record<string, string> = {
  renovation: "Renovation / Investition",
  referenzzins: "Referenzzinsanpassung",
  teuerung: "Teuerungsausgleich",
  allgemein: "Allgemeine Kostenerhöhung",
  sonstiges: "Sonstiges",
};

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  entwurf:   { label: "Entwurf",    cls: "bg-white/10 text-white/40" },
  versendet: { label: "Zugestellt", cls: "bg-blue-500/20 text-blue-300" },
  akzeptiert:{ label: "Akzeptiert", cls: "bg-emerald-500/20 text-emerald-300" },
  bestritten:{ label: "Bestritten", cls: "bg-red-500/20 text-red-300" },
  abgelehnt: { label: "Abgelehnt",  cls: "bg-red-500/20 text-red-300" },
};

export default async function MieterAnpassungenPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Get the wohnung for this mieter
  const { data: wohnung } = await supabase
    .from("wohnungen")
    .select("id, bezeichnung, nettomiete, liegenschaft_id, liegenschaft:liegenschaften(id, name)")
    .eq("mieter_id", user.id)
    .single();

  // Get mietzinserhöhungen for that liegenschaft
  const { data: erhoehungen } = wohnung?.liegenschaft_id
    ? await supabase
        .from("mietzins_erhoehungen")
        .select(`id, titel, grund, status, created_at,
          liegenschaft:liegenschaften(name, strasse, hausnummer, plz, ort)`)
        .eq("liegenschaft_id", wohnung.liegenschaft_id)
        .in("status", ["versendet", "akzeptiert", "bestritten"])
        .order("created_at", { ascending: false })
    : { data: null };

  // For each Erhöhung, get the position for this wohnung
  const erhoehungIds = (erhoehungen ?? []).map(e => e.id);
  const { data: positionen } = erhoehungIds.length > 0
    ? await supabase
        .from("mietzins_erhoehung_positionen")
        .select("id, mietzins_erhoehung_id, wohnung_bezeichnung, aktueller_mietzins, neuer_mietzins, differenz, gueltig_ab, status")
        .in("mietzins_erhoehung_id", erhoehungIds)
        .ilike("wohnung_bezeichnung", `%${wohnung?.bezeichnung ?? ""}%`)
    : { data: null };

  const allErhoehungen = (erhoehungen ?? []) as unknown as ErhoehungRow[];
  const allPositionen = (positionen ?? []) as unknown as (PositionRow & { mietzins_erhoehung_id: string })[];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Mietzinsanpassungen</h1>
        <p className="text-white/50 text-sm mt-1">
          Alle Mietzinserhöhungen für Ihre Wohnung{wohnung ? ` – ${wohnung.bezeichnung}` : ""}
        </p>
      </div>

      {!wohnung && (
        <div className="card p-6 text-center text-white/40">
          <p className="text-2xl mb-2">🏠</p>
          <p className="text-sm">Keine Wohnung gefunden</p>
        </div>
      )}

      {wohnung && allErhoehungen.length === 0 && (
        <div className="card p-8 text-center">
          <p className="text-3xl mb-3">✓</p>
          <p className="font-semibold text-white">Keine offenen Mietzinsanpassungen</p>
          <p className="text-sm text-white/50 mt-1">
            Aktueller Nettomietzins: CHF {Number(wohnung.nettomiete).toLocaleString("de-CH", { minimumFractionDigits: 2 })} / Monat
          </p>
        </div>
      )}

      {allErhoehungen.map(e => {
        const pos = allPositionen.find(p => p.mietzins_erhoehung_id === e.id);
        const lg = e.liegenschaft;
        const sc = STATUS_CONFIG[e.status] ?? { label: e.status, cls: "bg-white/10 text-white/40" };

        return (
          <div key={e.id} className="card p-5 space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${sc.cls}`}>
                    {sc.label}
                  </span>
                  <span className="text-xs text-white/40">
                    {new Date(e.created_at).toLocaleDateString("de-CH")}
                  </span>
                </div>
                <h2 className="font-bold text-white">{e.titel}</h2>
                {lg && (
                  <p className="text-xs text-white/40 mt-0.5">
                    {lg.strasse} {lg.hausnummer}, {lg.plz} {lg.ort}
                  </p>
                )}
              </div>
            </div>

            <div className="text-sm text-white/60">
              <span className="font-medium text-white/80">Grund: </span>
              {GRUND_LABEL[e.grund] ?? e.grund}
            </div>

            {pos && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <p className="text-xs text-white/40 mb-3 font-medium uppercase tracking-wide">Ihre Wohnung: {pos.wohnung_bezeichnung}</p>
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div>
                    <p className="text-xs text-white/40 mb-1">Bisheriger Mietzins</p>
                    <p className="text-lg font-bold text-white">
                      CHF {Number(pos.aktueller_mietzins).toLocaleString("de-CH", { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-white/30">pro Monat</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/40 mb-1">Erhöhung</p>
                    <p className="text-lg font-bold text-amber-400">
                      + CHF {Number(pos.differenz).toLocaleString("de-CH", { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-white/30">pro Monat</p>
                  </div>
                  <div>
                    <p className="text-xs text-white/40 mb-1">Neuer Mietzins</p>
                    <p className="text-lg font-bold text-white">
                      CHF {Number(pos.neuer_mietzins).toLocaleString("de-CH", { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-white/30">pro Monat</p>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-white/10 flex items-center justify-between">
                  <p className="text-sm text-white/60">
                    Gültig ab:{" "}
                    <span className="font-semibold text-white">
                      {pos.gueltig_ab ? new Date(pos.gueltig_ab).toLocaleDateString("de-CH") : "–"}
                    </span>
                  </p>
                </div>
              </div>
            )}

            {/* Rechte des Mieters */}
            {e.status === "versendet" && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 text-sm">
                <p className="font-semibold text-blue-300 mb-2">Ihre Rechte als Mieter</p>
                <p className="text-white/60 leading-relaxed">
                  Sie können diese Mietzinserhöhung innerhalb von <strong className="text-white">30 Tagen</strong> nach Erhalt
                  bei der zuständigen Schlichtungsbehörde anfechten (Art. 270b OR). Die Erhöhung muss auf dem
                  amtlich genehmigten Formular mitgeteilt werden, andernfalls ist sie nichtig.
                </p>
                <p className="text-xs text-white/30 mt-2">
                  Schlichtungsbehörden:{" "}
                  <a href="https://www.mieterverband.ch" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">
                    Mieterverband Schweiz
                  </a>
                </p>
              </div>
            )}
          </div>
        );
      })}

      <div className="card p-5">
        <h3 className="font-semibold text-white/70 text-sm mb-3">Rechtliche Grundlagen</h3>
        <div className="space-y-2 text-xs text-white/40 leading-relaxed">
          <p><span className="text-white/60">Art. 269 OR:</span> Missbräuchliche Mietzinse sind anfechtbar, wenn sie einen übersetzten Ertrag abwerfen oder auf einem offensichtlich übersetzten Kaufpreis beruhen.</p>
          <p><span className="text-white/60">Art. 270a OR:</span> Der Mieter kann den Mietzins als missbräuchlich anfechten und die Herabsetzung auf einen nicht missbräuchlichen Betrag verlangen.</p>
          <p><span className="text-white/60">Art. 270b OR:</span> Der Mieter kann eine Mietzinserhöhung innerhalb von 30 Tagen bei der Schlichtungsbehörde anfechten.</p>
        </div>
        <Link href="/dashboard/ki-assistent" className="text-xs text-[hsl(214,76%,60%)] hover:underline mt-3 block">
          Frage den KI-Assistenten zu Ihren Rechten →
        </Link>
      </div>
    </div>
  );
}
