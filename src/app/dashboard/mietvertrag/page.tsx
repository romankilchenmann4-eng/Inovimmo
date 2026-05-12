"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { MietvertragWohnraumInput } from "@/app/api/mietvertrag/wohnraum/route";
import type { MietvertragNebenraumInput } from "@/app/api/mietvertrag/nebenraum/route";

type Tab = "wohnraum" | "nebenraum";

type WohnungRow = {
  id: string;
  bezeichnung: string;
  etage: number;
  zimmer: number;
  flaeche_m2: number;
  nettomiete: number;
  nebenkosten_akonto: number;
  bruttomiete?: number;
  status: string;
  liegenschaft: {
    id: string;
    name: string;
    strasse: string;
    hausnummer: string;
    plz: string;
    ort: string;
  } | null;
  mietverhaeltnisse?: Array<{
    id: string;
    mietbeginn: string;
    mietende?: string;
    kaution_chf?: number;
    mieter?: {
      vorname: string;
      nachname: string;
    } | null;
  }>;
};

type ProfileRow = {
  full_name: string;
  firma?: string;
  adresse?: string;
  plz?: string;
  ort?: string;
};

const inp = "w-full px-3 py-2 border border-white/10 rounded-lg text-sm bg-white/5 focus:outline-none focus:border-[hsl(214,76%,49%)] text-white placeholder-white/30";
const lbl = "block text-xs text-white/50 mb-1";
const row = "grid grid-cols-2 gap-4";

function today(): string {
  const d = new Date();
  return `${String(d.getDate()).padStart(2,"0")}.${String(d.getMonth()+1).padStart(2,"0")}.${d.getFullYear()}`;
}

function etageLabel(etage: number): string {
  if (etage === 0) return "EG";
  if (etage === -1) return "UG";
  return `${etage}.OG`;
}

export default function MietvertragPage() {
  const supabase = createClient();
  const [tab, setTab] = useState<Tab>("wohnraum");
  const [wohnungen, setWohnungen] = useState<WohnungRow[]>([]);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [loading, setLoading] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);

  // ── Wohnraum form state
  const [wf, setWf] = useState<MietvertragWohnraumInput>({
    vermieter_name: "",
    vermieter_adresse: "",
    ref_nr: "",
    depot_chf: 0,
    mieter_namen: [""],
    liegenschaft_strasse: "",
    liegenschaft_plz_ort: "",
    mietobjekt_bezeichnung: "",
    stockwerk: "",
    benutzung_als: "Wohnung",
    personenzahl_max: 2,
    mitbenuetzung_waschkueche: true,
    mitbenuetzung_trockenraum: true,
    mitbenuetzung_einstellraum_velo: true,
    mitbenuetzung_garten: false,
    keller_nr: "",
    autoabstellplatz_nr: "",
    garage: false,
    mietbeginn: "",
    kuendigungsfrist_monate: 3,
    kuendigungstermine: "Ende März / Ende Juni / Ende September / Ende Dezember",
    mindestdauer_bis: "",
    nettomietzins: 0,
    garage_mietzins: 0,
    nk_heizung: 0,
    nk_heizung_typ: "akonto",
    nk_warmwasser: 0,
    nk_warmwasser_typ: "akonto",
    nk_hauswart: 0,
    nk_hauswart_typ: "akonto",
    nk_allgemeinstrom: 0,
    nk_allgemeinstrom_typ: "akonto",
    nk_abwasser: 0,
    nk_wasser: 0,
    nk_kehricht: 0,
    nk_garten: 0,
    nk_schnee: 0,
    bruttomietzins: 0,
    referenzzinssatz: "1.75%",
    landesindex: "",
    kostenstand: "",
    besondere_vereinbarungen: "– Nichtraucherwohnung\n– Keine Haustiere ohne ausdrückliche Bewilligung des Vermieters\n– Haftpflichtversicherung obligatorisch\n– Hausordnung ist Bestandteil dieses Vertrages",
    ort_datum_vermieter: today(),
    ort_datum_mieter: today(),
  });

  // ── Nebenraum form state
  const [nf, setNf] = useState<MietvertragNebenraumInput>({
    vermieter_name: "",
    vermieter_adresse: "",
    mieter_namen: [""],
    liegenschaft_strasse: "",
    liegenschaft_plz_ort: "",
    raumbezeichnung: "Hobbyraum",
    raum_nr: "",
    stockwerk: "UG",
    flaeche_m2: undefined,
    mietbeginn: "",
    kuendigungsfrist_monate: 3,
    kuendigungstermine: "Ende März / Ende Juni / Ende September / Ende Dezember",
    mindestdauer_bis: "",
    mietzins_monat: 0,
    besondere_vereinbarungen: "",
    ort_datum_vermieter: today(),
    ort_datum_mieter: today(),
  });

  const upW = useCallback(<K extends keyof MietvertragWohnraumInput>(k: K, v: MietvertragWohnraumInput[K]) => {
    setWf(f => ({ ...f, [k]: v }));
  }, []);

  const upN = useCallback(<K extends keyof MietvertragNebenraumInput>(k: K, v: MietvertragNebenraumInput[K]) => {
    setNf(f => ({ ...f, [k]: v }));
  }, []);

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const [{ data: prof }, { data: wohn }] = await Promise.all([
        supabase.from("profiles").select("full_name,firma,adresse,plz,ort").eq("id", user.id).single(),
        supabase.from("wohnungen").select(`
          id, bezeichnung, etage, zimmer, flaeche_m2, nettomiete, nebenkosten_akonto, bruttomiete, status,
          liegenschaft:liegenschaften(id, name, strasse, hausnummer, plz, ort),
          mietverhaeltnisse(id, mietbeginn, mietende, kaution_chf, mieter:mieter(vorname, nachname))
        `).order("bezeichnung"),
      ]);

      if (prof) {
        setProfile(prof);
        const vermName = prof.firma || prof.full_name;
        const vermAdr = [prof.adresse, prof.plz && prof.ort ? `${prof.plz} ${prof.ort}` : ""].filter(Boolean).join(", ");
        setWf(f => ({ ...f, vermieter_name: vermName, vermieter_adresse: vermAdr }));
        setNf(f => ({ ...f, vermieter_name: vermName, vermieter_adresse: vermAdr }));
      }

      if (wohn) setWohnungen(wohn as unknown as WohnungRow[]);
      setDataLoaded(true);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function applyWohnung(id: string) {
    setSelectedId(id);
    const w = wohnungen.find(x => x.id === id);
    if (!w) return;
    const lg = w.liegenschaft;
    const mv = w.mietverhaeltnisse?.[0];
    const strasse = lg ? `${lg.strasse} ${lg.hausnummer}` : "";
    const plzOrt = lg ? `${lg.plz} ${lg.ort}` : "";
    const bezeichnung = `${w.zimmer} Zi. Wohnung`;
    const stockwerk = etageLabel(w.etage ?? 0);
    const mieterNamen = mv?.mieter ? [`${mv.mieter.vorname} ${mv.mieter.nachname}`] : [""];
    const mietbeginn = mv?.mietbeginn ? new Date(mv.mietbeginn).toLocaleDateString("de-CH") : "";
    const brutto = w.bruttomiete ?? (w.nettomiete + w.nebenkosten_akonto);
    const depot = mv?.kaution_chf ?? w.nettomiete * 3;

    setWf(f => ({
      ...f,
      liegenschaft_strasse: strasse,
      liegenschaft_plz_ort: plzOrt,
      mietobjekt_bezeichnung: bezeichnung,
      stockwerk,
      mieter_namen: mieterNamen,
      mietbeginn,
      nettomietzins: w.nettomiete,
      nk_heizung: Math.round(w.nebenkosten_akonto * 0.5),
      nk_warmwasser: Math.round(w.nebenkosten_akonto * 0.2),
      nk_hauswart: Math.round(w.nebenkosten_akonto * 0.15),
      nk_allgemeinstrom: Math.round(w.nebenkosten_akonto * 0.1),
      nk_kehricht: Math.round(w.nebenkosten_akonto * 0.05),
      bruttomietzins: brutto,
      depot_chf: depot,
    }));

    setNf(f => ({
      ...f,
      liegenschaft_strasse: strasse,
      liegenschaft_plz_ort: plzOrt,
      mieter_namen: mieterNamen,
      mietbeginn,
    }));
  }

  async function generatePdf(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const endpoint = tab === "wohnraum" ? "/api/mietvertrag/wohnraum" : "/api/mietvertrag/nebenraum";
      const body = tab === "wohnraum" ? wf : nf;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error ?? "PDF-Generierung fehlgeschlagen");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const fname = tab === "wohnraum"
        ? `Mietvertrag_${(wf.mieter_namen[0] || "Mieter").replace(/\s/g, "_")}.pdf`
        : `Nebenraum_${(nf.mieter_namen[0] || "Mieter").replace(/\s/g, "_")}.pdf`;
      a.download = fname;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("PDF erstellt und heruntergeladen");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Fehler");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Mietvertrag</h1>
          <p className="text-white/50 text-sm mt-1">HEV-Vorlage automatisch ausfüllen und als PDF herunterladen</p>
        </div>
      </div>

      {/* Wohnung auswählen */}
      <div className="card p-4">
        <label className={lbl}>Wohnung vorausfüllen</label>
        <select
          className={inp}
          value={selectedId}
          onChange={e => applyWohnung(e.target.value)}
          disabled={!dataLoaded}
        >
          <option value="">– Wohnung auswählen (optional) –</option>
          {wohnungen.map(w => (
            <option key={w.id} value={w.id}>
              {w.liegenschaft?.name ? `${w.liegenschaft.name} · ` : ""}{w.bezeichnung} ({etageLabel(w.etage ?? 0)})
            </option>
          ))}
        </select>
        {!dataLoaded && <p className="text-white/30 text-xs mt-1">Lade Wohnungen...</p>}
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(["wohnraum", "nebenraum"] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? "bg-[hsl(214,76%,49%)] text-white" : "bg-white/5 text-white/60 hover:bg-white/10"}`}
          >
            {t === "wohnraum" ? "Wohnraum (HEV Zürich 2023)" : "Nebenraum (HEV Schweiz 2025)"}
          </button>
        ))}
      </div>

      <form onSubmit={generatePdf} className="space-y-5">
        {tab === "wohnraum" ? (
          <WohnraumForm wf={wf} upW={upW} />
        ) : (
          <NebenraumForm nf={nf} upN={upN} />
        )}

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-[hsl(214,76%,49%)] hover:bg-[hsl(214,76%,42%)] text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? "PDF wird generiert..." : "PDF generieren & herunterladen"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ── Wohnraum form ────────────────────────────────────────────────────────────

function WohnraumForm({ wf, upW }: {
  wf: MietvertragWohnraumInput;
  upW: <K extends keyof MietvertragWohnraumInput>(k: K, v: MietvertragWohnraumInput[K]) => void;
}) {
  return (
    <div className="space-y-4">
      <Section title="Vermieter">
        <div className={row}>
          <Field label="Name / Firma" value={wf.vermieter_name} onChange={v => upW("vermieter_name", v)} required />
          <Field label="Adresse" value={wf.vermieter_adresse ?? ""} onChange={v => upW("vermieter_adresse", v)} />
        </div>
        <div className={row}>
          <Field label="Ref.-Nr." value={wf.ref_nr ?? ""} onChange={v => upW("ref_nr", v)} />
          <FieldNum label="Depot CHF" value={wf.depot_chf} onChange={v => upW("depot_chf", v)} required />
        </div>
      </Section>

      <Section title="Mieter">
        {wf.mieter_namen.map((m, i) => (
          <div key={i} className="flex gap-2">
            <div className="flex-1">
              <Field
                label={`Mieter ${i + 1}`}
                value={m}
                onChange={v => {
                  const arr = [...wf.mieter_namen];
                  arr[i] = v;
                  upW("mieter_namen", arr);
                }}
                required={i === 0}
              />
            </div>
            {i > 0 && (
              <button type="button" className="mt-5 text-red-400 text-sm" onClick={() => {
                upW("mieter_namen", wf.mieter_namen.filter((_, j) => j !== i));
              }}>✕</button>
            )}
          </div>
        ))}
        {wf.mieter_namen.length < 3 && (
          <button type="button" className="text-xs text-[hsl(214,76%,60%)] hover:underline" onClick={() => upW("mieter_namen", [...wf.mieter_namen, ""])}>
            + Weiteren Mieter hinzufügen
          </button>
        )}
      </Section>

      <Section title="Mietobjekt">
        <div className={row}>
          <Field label="Liegenschaft Strasse" value={wf.liegenschaft_strasse} onChange={v => upW("liegenschaft_strasse", v)} required />
          <Field label="PLZ Ort" value={wf.liegenschaft_plz_ort} onChange={v => upW("liegenschaft_plz_ort", v)} required />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <Field label="Mietobjekt (z.B. 2.5 Zi Wohnung)" value={wf.mietobjekt_bezeichnung} onChange={v => upW("mietobjekt_bezeichnung", v)} required />
          <Field label="Stockwerk" value={wf.stockwerk} onChange={v => upW("stockwerk", v)} />
          <Field label="Benützung als" value={wf.benutzung_als} onChange={v => upW("benutzung_als", v)} />
        </div>
        <div className={row}>
          <FieldNum label="Max. Personenzahl" value={wf.personenzahl_max} onChange={v => upW("personenzahl_max", v)} />
          <div />
        </div>

        <p className="text-xs text-white/40 mt-1 mb-1">Mitbenützung / Nebenräume</p>
        <div className="grid grid-cols-4 gap-3">
          {([
            ["mitbenuetzung_waschkueche", "Waschküche"],
            ["mitbenuetzung_trockenraum", "Trockenraum"],
            ["mitbenuetzung_einstellraum_velo", "Einstellraum Velo"],
            ["mitbenuetzung_garten", "Garten"],
            ["garage", "Garage"],
          ] as [keyof MietvertragWohnraumInput, string][]).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm text-white/70 cursor-pointer">
              <input
                type="checkbox"
                checked={wf[key] as boolean}
                onChange={e => upW(key, e.target.checked as MietvertragWohnraumInput[typeof key])}
                className="accent-[hsl(214,76%,49%)]"
              />
              {label}
            </label>
          ))}
        </div>
        <div className={row + " mt-2"}>
          <Field label="Keller Nr." value={wf.keller_nr ?? ""} onChange={v => upW("keller_nr", v)} />
          <Field label="Autoabstellplatz Nr." value={wf.autoabstellplatz_nr ?? ""} onChange={v => upW("autoabstellplatz_nr", v)} />
        </div>
      </Section>

      <Section title="Mietbeginn & Kündigung">
        <div className={row}>
          <Field label="Mietbeginn (TT.MM.JJJJ)" value={wf.mietbeginn} onChange={v => upW("mietbeginn", v)} required placeholder="01.06.2026" />
          <FieldNum label="Kündigungsfrist (Monate)" value={wf.kuendigungsfrist_monate} onChange={v => upW("kuendigungsfrist_monate", v)} />
        </div>
        <div className={row}>
          <Field label="Kündigungstermine" value={wf.kuendigungstermine} onChange={v => upW("kuendigungstermine", v)} />
          <Field label="Mindestdauer bis (optional)" value={wf.mindestdauer_bis ?? ""} onChange={v => upW("mindestdauer_bis", v)} placeholder="01.06.2029" />
        </div>
      </Section>

      <Section title="Mietzins">
        <div className={row}>
          <FieldNum label="Nettomietzins CHF" value={wf.nettomietzins} onChange={v => upW("nettomietzins", v)} required />
          <FieldNum label="Garage/Abstellplatz CHF" value={wf.garage_mietzins ?? 0} onChange={v => upW("garage_mietzins", v)} />
        </div>
        <p className="text-xs text-white/40 mt-2 mb-1">Nebenkosten (akonto/Monat)</p>
        <div className="grid grid-cols-3 gap-3">
          <FieldNum label="Heizkosten CHF" value={wf.nk_heizung ?? 0} onChange={v => upW("nk_heizung", v)} />
          <FieldNum label="Warmwasser CHF" value={wf.nk_warmwasser ?? 0} onChange={v => upW("nk_warmwasser", v)} />
          <FieldNum label="Hauswartung CHF" value={wf.nk_hauswart ?? 0} onChange={v => upW("nk_hauswart", v)} />
          <FieldNum label="Allgemeinstrom CHF" value={wf.nk_allgemeinstrom ?? 0} onChange={v => upW("nk_allgemeinstrom", v)} />
          <FieldNum label="Abwasser CHF" value={wf.nk_abwasser ?? 0} onChange={v => upW("nk_abwasser", v)} />
          <FieldNum label="Kaltwasser CHF" value={wf.nk_wasser ?? 0} onChange={v => upW("nk_wasser", v)} />
          <FieldNum label="Kehrichtgebühren CHF" value={wf.nk_kehricht ?? 0} onChange={v => upW("nk_kehricht", v)} />
          <FieldNum label="Gartenpflege CHF" value={wf.nk_garten ?? 0} onChange={v => upW("nk_garten", v)} />
          <FieldNum label="Schneeräumung CHF" value={wf.nk_schnee ?? 0} onChange={v => upW("nk_schnee", v)} />
        </div>
        <div className={row + " mt-3"}>
          <FieldNum label="Bruttomietzins CHF (Total)" value={wf.bruttomietzins} onChange={v => upW("bruttomietzins", v)} required />
          <div />
        </div>
      </Section>

      <Section title="Berechnungsgrundlagen">
        <div className="grid grid-cols-3 gap-4">
          <Field label="Referenzzinssatz" value={wf.referenzzinssatz ?? ""} onChange={v => upW("referenzzinssatz", v)} placeholder="1.75%" />
          <Field label="Landesindex (LIK)" value={wf.landesindex ?? ""} onChange={v => upW("landesindex", v)} placeholder="106.2" />
          <Field label="Kostenstand" value={wf.kostenstand ?? ""} onChange={v => upW("kostenstand", v)} placeholder="Jan. 2024" />
        </div>
      </Section>

      <Section title="Besondere Vereinbarungen">
        <textarea
          className={inp + " min-h-[120px] resize-y"}
          value={wf.besondere_vereinbarungen}
          onChange={e => upW("besondere_vereinbarungen", e.target.value)}
          placeholder="Eine Vereinbarung pro Zeile..."
        />
      </Section>

      <Section title="Ort & Datum (Unterschriften)">
        <div className={row}>
          <Field label="Ort, Datum Vermieter" value={wf.ort_datum_vermieter} onChange={v => upW("ort_datum_vermieter", v)} required />
          <Field label="Ort, Datum Mieter" value={wf.ort_datum_mieter} onChange={v => upW("ort_datum_mieter", v)} required />
        </div>
      </Section>
    </div>
  );
}

// ── Nebenraum form ────────────────────────────────────────────────────────────

function NebenraumForm({ nf, upN }: {
  nf: MietvertragNebenraumInput;
  upN: <K extends keyof MietvertragNebenraumInput>(k: K, v: MietvertragNebenraumInput[K]) => void;
}) {
  return (
    <div className="space-y-4">
      <Section title="Vermieter">
        <div className={row}>
          <Field label="Name / Firma" value={nf.vermieter_name} onChange={v => upN("vermieter_name", v)} required />
          <Field label="Adresse" value={nf.vermieter_adresse ?? ""} onChange={v => upN("vermieter_adresse", v)} />
        </div>
      </Section>

      <Section title="Mieter">
        {nf.mieter_namen.map((m, i) => (
          <div key={i} className="flex gap-2">
            <div className="flex-1">
              <Field
                label={`Mieter ${i + 1}`}
                value={m}
                onChange={v => {
                  const arr = [...nf.mieter_namen];
                  arr[i] = v;
                  upN("mieter_namen", arr);
                }}
                required={i === 0}
              />
            </div>
            {i > 0 && (
              <button type="button" className="mt-5 text-red-400 text-sm" onClick={() => upN("mieter_namen", nf.mieter_namen.filter((_, j) => j !== i))}>✕</button>
            )}
          </div>
        ))}
        {nf.mieter_namen.length < 3 && (
          <button type="button" className="text-xs text-[hsl(214,76%,60%)] hover:underline" onClick={() => upN("mieter_namen", [...nf.mieter_namen, ""])}>
            + Weiteren Mieter hinzufügen
          </button>
        )}
      </Section>

      <Section title="Liegenschaft">
        <div className={row}>
          <Field label="Strasse" value={nf.liegenschaft_strasse} onChange={v => upN("liegenschaft_strasse", v)} required />
          <Field label="PLZ Ort" value={nf.liegenschaft_plz_ort} onChange={v => upN("liegenschaft_plz_ort", v)} required />
        </div>
      </Section>

      <Section title="Nebenraum">
        <div className="grid grid-cols-3 gap-4">
          <Field label="Bezeichnung (z.B. Hobbyraum)" value={nf.raumbezeichnung} onChange={v => upN("raumbezeichnung", v)} required />
          <Field label="Raum-Nr." value={nf.raum_nr ?? ""} onChange={v => upN("raum_nr", v)} />
          <Field label="Stockwerk" value={nf.stockwerk ?? ""} onChange={v => upN("stockwerk", v)} placeholder="UG" />
        </div>
        <div className={row}>
          <FieldNum label="Fläche m² (optional)" value={nf.flaeche_m2 ?? 0} onChange={v => upN("flaeche_m2", v || undefined)} />
          <div />
        </div>
      </Section>

      <Section title="Mietbeginn & Kündigung">
        <div className={row}>
          <Field label="Mietbeginn (TT.MM.JJJJ)" value={nf.mietbeginn} onChange={v => upN("mietbeginn", v)} required placeholder="01.06.2026" />
          <FieldNum label="Kündigungsfrist (Monate)" value={nf.kuendigungsfrist_monate} onChange={v => upN("kuendigungsfrist_monate", v)} />
        </div>
        <div className={row}>
          <Field label="Kündigungstermine" value={nf.kuendigungstermine} onChange={v => upN("kuendigungstermine", v)} />
          <Field label="Mindestdauer bis (optional)" value={nf.mindestdauer_bis ?? ""} onChange={v => upN("mindestdauer_bis", v || undefined)} />
        </div>
      </Section>

      <Section title="Mietzins">
        <div className={row}>
          <FieldNum label="Mietzins pro Monat CHF" value={nf.mietzins_monat} onChange={v => upN("mietzins_monat", v)} required />
          <div />
        </div>
      </Section>

      <Section title="Besondere Vereinbarungen">
        <textarea
          className={inp + " min-h-[80px] resize-y"}
          value={nf.besondere_vereinbarungen ?? ""}
          onChange={e => upN("besondere_vereinbarungen", e.target.value)}
          placeholder="z.B. Hobbyraum ist nur für Bastelarbeiten bestimmt, keine Lagerung von Brennstoffen."
        />
      </Section>

      <Section title="Ort & Datum (Unterschriften)">
        <div className={row}>
          <Field label="Ort, Datum Vermieter" value={nf.ort_datum_vermieter} onChange={v => upN("ort_datum_vermieter", v)} required />
          <Field label="Ort, Datum Mieter" value={nf.ort_datum_mieter} onChange={v => upN("ort_datum_mieter", v)} required />
        </div>
      </Section>
    </div>
  );
}

// ── Shared components ────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card p-5 space-y-3">
      <h3 className="text-sm font-semibold text-white/80 border-b border-white/10 pb-2">{title}</h3>
      {children}
    </div>
  );
}

function Field({ label: fieldLabel, value, onChange, required, placeholder }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className={lbl}>{fieldLabel}{required && <span className="text-red-400 ml-0.5">*</span>}</label>
      <input
        type="text"
        className={inp}
        value={value}
        onChange={e => onChange(e.target.value)}
        required={required}
        placeholder={placeholder}
      />
    </div>
  );
}

function FieldNum({ label: fieldLabel, value, onChange, required }: {
  label: string;
  value: number | undefined;
  onChange: (v: number) => void;
  required?: boolean;
}) {
  return (
    <div>
      <label className={lbl}>{fieldLabel}{required && <span className="text-red-400 ml-0.5">*</span>}</label>
      <input
        type="number"
        className={inp}
        value={value ?? ""}
        min={0}
        step="0.01"
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        required={required}
      />
    </div>
  );
}
