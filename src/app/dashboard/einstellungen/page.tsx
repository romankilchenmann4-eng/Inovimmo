"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";

export default function EinstellungenPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({ full_name:"", phone:"", firma:"", adresse:"", plz:"", ort:"" });
  const up = (k:string,v:string) => setForm(f=>({...f,[k]:v}));
  const inp = "w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[hsl(214,76%,49%)] focus:ring-2 focus:ring-blue-100";

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      supabase.from("profiles").select("*").eq("id", user.id).single().then(({ data }) => {
        if (data) setForm({ full_name: data.full_name ?? "", phone: data.phone ?? "", firma: data.firma ?? "", adresse: data.adresse ?? "", plz: data.plz ?? "", ort: data.ort ?? "" });
      });
    });
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("profiles").update(form).eq("id", user!.id);
      if (error) throw error;
      toast.success("Profil gespeichert!");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Fehler");
    } finally { setLoading(false); }
  }

  async function logout() {
    await supabase.auth.signOut();
    window.location.href = "/auth/login";
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h2 className="text-xl font-bold text-gray-900">Einstellungen</h2>

      <form onSubmit={save} className="space-y-5">
        <div className="form-section space-y-4">
          <h3 className="text-sm font-semibold text-gray-700">Profil</h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Name</label>
              <input value={form.full_name} onChange={e=>up("full_name",e.target.value)} className={inp} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Telefon</label>
              <input value={form.phone} onChange={e=>up("phone",e.target.value)} placeholder="+41 79 123 45 67" className={inp} />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Firma / Organisation</label>
              <input value={form.firma} onChange={e=>up("firma",e.target.value)} className={inp} />
            </div>
          </div>
        </div>

        <div className="form-section space-y-4">
          <h3 className="text-sm font-semibold text-gray-700">Adresse</h3>
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Strasse</label>
            <input value={form.adresse} onChange={e=>up("adresse",e.target.value)} className={inp} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">PLZ</label>
              <input value={form.plz} onChange={e=>up("plz",e.target.value)} className={inp} />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-400 uppercase mb-1.5">Ort</label>
              <input value={form.ort} onChange={e=>up("ort",e.target.value)} className={inp} />
            </div>
          </div>
        </div>

        <button type="submit" disabled={loading} className="w-full py-2.5 bg-[hsl(214,76%,49%)] text-white font-semibold rounded-xl disabled:opacity-50 text-sm">
          {loading ? "Speichern…" : "Profil speichern"}
        </button>
      </form>

      <div className="form-section">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Konto</h3>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-xs text-yellow-700 mb-3">
          ⚠️ Inovimmo befindet sich in der Beta-Phase. Ihre Daten werden sicher in der Schweiz gespeichert (Supabase CH, DSGVO-konform).
        </div>
        <button onClick={logout} className="w-full py-2.5 border border-red-200 text-red-600 font-semibold rounded-xl hover:bg-red-50 text-sm transition-colors">
          Abmelden
        </button>
      </div>
    </div>
  );
}
