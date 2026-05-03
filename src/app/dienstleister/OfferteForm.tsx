"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export default function OfferteForm({ ticketId }: { ticketId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const [form, setForm] = useState({ betrag:"", beschreibung:"", verfuegbar_ab:"", garantie_monate:"" });
  const up = (k:string,v:string) => setForm(f=>({...f,[k]:v}));
  const inp = "w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[hsl(214,76%,49%)]";

  async function submit() {
    if (!form.betrag || !form.verfuegbar_ab) { toast.error("Betrag und Verfügbarkeit angeben"); return; }
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("offerten").insert({
        ticket_id: ticketId,
        dienstleister_id: user!.id,
        betrag: parseFloat(form.betrag),
        beschreibung: form.beschreibung,
        verfuegbar_ab: form.verfuegbar_ab,
        garantie_monate: form.garantie_monate ? parseInt(form.garantie_monate) : null,
        status: "eingegangen",
      });
      if (error) throw error;
      // Update ticket status
      await supabase.from("tickets").update({ status: "offerten_eingegangen" }).eq("id", ticketId).in("status",["ausgeschrieben"]);
      toast.success("Offerte eingereicht! Sie wird nach Einreichen versiegelt.");
      setOpen(false);
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Fehler");
    } finally { setLoading(false); }
  }

  if (!open) return (
    <button onClick={()=>setOpen(true)} className="w-full py-2 bg-[hsl(214,76%,49%)] text-white text-xs font-semibold rounded-lg hover:bg-[hsl(214,76%,44%)] transition-colors">
      Offerte einreichen
    </button>
  );

  return (
    <div className="bg-blue-50 rounded-lg p-3 space-y-2 border border-blue-200">
      <p className="text-xs font-semibold text-blue-800">Offerte einreichen (wird nach Einreichen versiegelt)</p>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-xs text-gray-500 mb-0.5 block">Betrag CHF *</label>
          <input type="number" required value={form.betrag} onChange={e=>up("betrag",e.target.value)} placeholder="850" className={inp} />
        </div>
        <div>
          <label className="text-xs text-gray-500 mb-0.5 block">Verfügbar ab *</label>
          <input type="date" required value={form.verfuegbar_ab} onChange={e=>up("verfuegbar_ab",e.target.value)} className={inp} />
        </div>
      </div>
      <div>
        <label className="text-xs text-gray-500 mb-0.5 block">Leistungsbeschreibung</label>
        <textarea rows={2} value={form.beschreibung} onChange={e=>up("beschreibung",e.target.value)} placeholder="Was ist im Preis inbegriffen?" className={`${inp} resize-none`} />
      </div>
      <div>
        <label className="text-xs text-gray-500 mb-0.5 block">Garantie (Monate)</label>
        <input type="number" min="0" max="60" value={form.garantie_monate} onChange={e=>up("garantie_monate",e.target.value)} placeholder="12" className={inp} />
      </div>
      <div className="flex gap-2">
        <button onClick={()=>setOpen(false)} className="flex-1 py-1.5 border border-gray-200 rounded-lg text-xs text-gray-600">Abbrechen</button>
        <button onClick={submit} disabled={loading} className="flex-1 py-1.5 bg-[hsl(214,76%,49%)] text-white text-xs font-semibold rounded-lg disabled:opacity-50">
          {loading ? "…" : "Verbindlich einreichen"}
        </button>
      </div>
    </div>
  );
}
