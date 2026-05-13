"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import SubNav from "@/components/ui/SubNav";

const TOOLS_NAV = [
  { href: "/dashboard/screening", label: "Screening" },
  { href: "/dashboard/uebergabe", label: "Übergabe" },
  { href: "/dashboard/kalender",  label: "Kalender" },
];

type Event = { id: string; titel: string; typ: string; datum: string; zeit_von: string; zeit_bis: string; notiz?: string; liegenschaft?: string; status: string; };

const TYPEN = [
  { value: "besichtigung",  label: "🏠 Besichtigung",       color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "uebergabe",     label: "🔑 Wohnungsübergabe",   color: "bg-green-100 text-green-700 border-green-200" },
  { value: "handwerker",    label: "🔧 Handwerker-Termin",  color: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "wartung",       label: "⚙️ Wartung",            color: "bg-purple-100 text-purple-700 border-purple-200" },
  { value: "kuendigung",    label: "📋 Kündigung",          color: "bg-red-100 text-red-700 border-red-200" },
  { value: "sonstiges",     label: "📅 Sonstiges",          color: "bg-gray-100 text-gray-600 border-gray-200" },
];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

export default function KalenderPage() {
  const supabase = createClient();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [events, setEvents] = useState<Event[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [form, setForm] = useState({ titel: "", typ: "besichtigung", datum: "", zeit_von: "09:00", zeit_bis: "10:00", notiz: "", liegenschaft: "" });
  const up = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  useEffect(() => { loadEvents(); }, [year, month]);

  async function loadEvents() {
    const { data: { user } } = await supabase.auth.getUser();
    const from = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const to = `${year}-${String(month + 1).padStart(2, "0")}-${getDaysInMonth(year, month)}`;
    const { data } = await supabase.from("kalender_events").select("*").eq("erstellt_von", user!.id).gte("datum", from).lte("datum", to).order("datum").order("zeit_von");
    setEvents(data ?? []);
  }

  async function addEvent() {
    if (!form.titel || !form.datum) { toast.error("Titel und Datum angeben"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase.from("kalender_events").insert({ ...form, erstellt_von: user!.id, status: "geplant" });
    if (error) { toast.error(error.message); return; }
    toast.success("Termin gespeichert");
    setShowForm(false);
    setForm(f => ({ ...f, titel: "", notiz: "" }));
    loadEvents();
  }

  const days = getDaysInMonth(year, month);
  const firstDay = new Date(year, month, 1).getDay();
  const MONTHS = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];
  const WEEKDAYS = ["Mo","Di","Mi","Do","Fr","Sa","So"];

  function getEventsForDay(day: number) {
    const dateStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    return events.filter(e => e.datum === dateStr);
  }

  const typMap = Object.fromEntries(TYPEN.map(t => [t.value, t]));
  const inp = "w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-[hsl(214,76%,49%)]";

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <SubNav items={TOOLS_NAV} />
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Kalender</h2>
          <p className="text-sm text-gray-500">Termine, Besichtigungen, Übergaben</p>
        </div>
        <button onClick={() => { setShowForm(true); setForm(f => ({ ...f, datum: `${year}-${String(month+1).padStart(2,"0")}-${String(now.getDate()).padStart(2,"0")}` })); }}
          className="px-4 py-2 bg-[hsl(214,76%,49%)] text-white text-sm font-semibold rounded-xl">
          + Termin
        </button>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Calendar Grid */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-border shadow-sm p-5">
          {/* Nav */}
          <div className="flex items-center justify-between mb-5">
            <button onClick={() => { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); }}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">‹</button>
            <h3 className="font-bold text-gray-900">{MONTHS[month]} {year}</h3>
            <button onClick={() => { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); }}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100">›</button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 mb-2">
            {WEEKDAYS.map(d => <div key={d} className="text-center text-xs font-semibold text-gray-400 py-1">{d}</div>)}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7 gap-1">
            {Array.from({ length: (firstDay === 0 ? 6 : firstDay - 1) }).map((_, i) => <div key={`empty-${i}`} />)}
            {Array.from({ length: days }).map((_, i) => {
              const day = i + 1;
              const dayEvents = getEventsForDay(day);
              const isToday = day === now.getDate() && month === now.getMonth() && year === now.getFullYear();
              const isSelected = day === selectedDay;
              return (
                <div key={day} onClick={() => setSelectedDay(day)}
                  className={`min-h-[52px] p-1 rounded-lg cursor-pointer transition-colors ${isSelected ? "bg-blue-50 ring-2 ring-[hsl(214,76%,49%)]" : "hover:bg-gray-50"}`}>
                  <span className={`text-xs font-medium block text-center mb-1 w-6 h-6 flex items-center justify-center rounded-full mx-auto ${isToday ? "bg-[hsl(214,76%,49%)] text-white" : "text-gray-700"}`}>
                    {day}
                  </span>
                  {dayEvents.slice(0, 2).map(e => (
                    <div key={e.id} className={`text-[10px] px-1 py-0.5 rounded mb-0.5 truncate border ${typMap[e.typ]?.color ?? "bg-gray-100 text-gray-600 border-gray-200"}`}>
                      {e.titel}
                    </div>
                  ))}
                  {dayEvents.length > 2 && <div className="text-[10px] text-gray-400 text-center">+{dayEvents.length - 2}</div>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Sidebar: selected day events or upcoming */}
        <div className="space-y-4">
          {selectedDay && (
            <div className="bg-white rounded-xl border border-border shadow-sm p-4">
              <h4 className="font-semibold text-sm text-gray-900 mb-3">
                {selectedDay}. {MONTHS[month]}
              </h4>
              {getEventsForDay(selectedDay).length === 0 ? (
                <p className="text-xs text-gray-400">Keine Termine</p>
              ) : getEventsForDay(selectedDay).map(e => (
                <div key={e.id} className={`p-3 rounded-lg border mb-2 ${typMap[e.typ]?.color ?? ""}`}>
                  <p className="font-medium text-sm">{e.titel}</p>
                  <p className="text-xs mt-0.5">{e.zeit_von} – {e.zeit_bis}</p>
                  {e.notiz && <p className="text-xs mt-1 opacity-75">{e.notiz}</p>}
                </div>
              ))}
              <button onClick={() => { setShowForm(true); setForm(f => ({ ...f, datum: `${year}-${String(month+1).padStart(2,"0")}-${String(selectedDay).padStart(2,"0")}` })); }}
                className="w-full mt-2 py-1.5 text-xs text-[hsl(214,76%,49%)] hover:bg-blue-50 rounded-lg">
                + Termin hinzufügen
              </button>
            </div>
          )}

          <div className="bg-white rounded-xl border border-border shadow-sm p-4">
            <h4 className="font-semibold text-sm text-gray-900 mb-3">Nächste Termine</h4>
            {events.filter(e => e.datum >= now.toISOString().split("T")[0]).slice(0, 5).length === 0 ? (
              <p className="text-xs text-gray-400">Keine kommenden Termine</p>
            ) : events.filter(e => e.datum >= now.toISOString().split("T")[0]).slice(0, 5).map(e => (
              <div key={e.id} className="flex items-start gap-2 py-2 border-b border-gray-50 last:border-0">
                <span className="text-lg">{typMap[e.typ]?.label?.split(" ")[0] ?? "📅"}</span>
                <div>
                  <p className="text-sm font-medium text-gray-900">{e.titel}</p>
                  <p className="text-xs text-gray-400">{new Date(e.datum).toLocaleDateString("de-CH")} · {e.zeit_von}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Add event modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <h3 className="font-bold text-gray-900">Neuer Termin</h3>
              <button onClick={() => setShowForm(false)} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 text-gray-400">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Titel *</label>
                <input value={form.titel} onChange={e => up("titel", e.target.value)} placeholder="z.B. Besichtigung Müller" className={inp} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Typ</label>
                  <select value={form.typ} onChange={e => up("typ", e.target.value)} className={inp}>
                    {TYPEN.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Datum *</label>
                  <input type="date" value={form.datum} onChange={e => up("datum", e.target.value)} className={inp} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Von</label>
                  <input type="time" value={form.zeit_von} onChange={e => up("zeit_von", e.target.value)} className={inp} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Bis</label>
                  <input type="time" value={form.zeit_bis} onChange={e => up("zeit_bis", e.target.value)} className={inp} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 uppercase mb-1">Notizen</label>
                <textarea rows={2} value={form.notiz} onChange={e => up("notiz", e.target.value)} className={`${inp} resize-none`} />
              </div>
            </div>
            <div className="flex gap-3 mt-4">
              <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium">Abbrechen</button>
              <button onClick={addEvent} disabled={!form.titel || !form.datum} className="flex-1 py-2.5 bg-[hsl(214,76%,49%)] text-white font-semibold rounded-xl text-sm disabled:opacity-50">Speichern</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
