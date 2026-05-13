'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'

type Liegenschaft = {
  id: string
  name: string
  strasse: string
  hausnummer: string
  plz: string
  ort: string
  kanton: string
  baujahr?: number
  objekttyp: string
  notizen?: string
  externe_referenz?: string
}

type Wohnung = {
  id: string
  bezeichnung: string
  whg_nr?: string
  etage: number
  zimmer: number
  flaeche_m2?: number
  nettomiete: number
  nebenkosten_akonto: number
  status: string
  wohnungstyp: string
  beheizt: boolean
  position?: string
  kuendigungstermine?: string
  verteilschluessel_prozent?: number
}

type Mieter = {
  id: string
  vorname: string
  nachname: string
  telefon_mobil?: string
  telefon_festnetz?: string
  email?: string
}

type Mietverhaeltnis = {
  wohnung_id: string
  ist_vertragspartner: boolean
  ist_hauptperson: boolean
  mieter: Mieter
}

const TYP_OPTIONS = [
  { value: 'wohnung',           label: 'Wohnung',          icon: '🏠' },
  { value: 'gewerbe',           label: 'Gewerbe',           icon: '🏢' },
  { value: 'bastelraum',        label: 'Bastelraum',        icon: '🔧' },
  { value: 'parkplatz_aussen',  label: 'Parkplatz',         icon: '🚗' },
  { value: 'einstellgarage',    label: 'Einstellgarage',    icon: '🏘️' },
  { value: 'lager',             label: 'Lager',             icon: '📦' },
  { value: 'sonstiges',         label: 'Sonstiges',         icon: '📌' },
]

const TYP_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  wohnung:          { label: 'Wohnungen',       icon: '🏠', color: 'bg-blue-50' },
  bastelraum:       { label: 'Bastelräume',     icon: '🔧', color: 'bg-amber-50' },
  parkplatz_aussen: { label: 'Parkplätze',      icon: '🚗', color: 'bg-gray-50' },
  einstellgarage:   { label: 'Einstellgaragen', icon: '🏘️', color: 'bg-slate-50' },
  gewerbe:          { label: 'Gewerbe',         icon: '🏢', color: 'bg-purple-50' },
  lager:            { label: 'Lager',           icon: '📦', color: 'bg-stone-50' },
  sonstiges:        { label: 'Sonstiges',       icon: '📌', color: 'bg-neutral-50' },
}

const fmt = (n: number) =>
  n.toLocaleString('de-CH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

const fmt0 = (n: number) =>
  n.toLocaleString('de-CH', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })

export default function ObjektDetail() {
  const { id } = useParams()
  const router = useRouter()
  const supabase = createClient()

  const [liegenschaft, setLiegenschaft] = useState<Liegenschaft | null>(null)
  const [wohnungen, setWohnungen] = useState<Wohnung[]>([])
  const [mietverhaeltnisse, setMietverhaeltnisse] = useState<Mietverhaeltnis[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddWohnung, setShowAddWohnung] = useState(false)
  const [savingWohnung, setSavingWohnung] = useState(false)
  const [newWohnung, setNewWohnung] = useState({
    whg_nr: '',
    bezeichnung: '',
    etage: '0',
    zimmer: '3.5',
    flaeche_m2: '',
    nettomiete: '',
    nebenkosten_akonto: '',
    wohnungstyp: 'wohnung',
    mieterHinterlegen: true,
  })

  useEffect(() => {
    const load = async () => {
      setLoading(true)

      const { data: l } = await supabase
        .from('liegenschaften')
        .select('*')
        .eq('id', id)
        .single()

      setLiegenschaft(l)

      const { data: w } = await supabase
        .from('wohnungen')
        .select('*')
        .eq('liegenschaft_id', id)
        .order('whg_nr', { ascending: true })

      setWohnungen(w || [])

      if (w && w.length > 0) {
        const wohnungIds = w.map((x) => x.id)

        const { data: mv } = await supabase
          .from('mietverhaeltnisse')
          .select(`
            wohnung_id,
            ist_vertragspartner,
            ist_hauptperson,
            mieter:mieter_id (
              id, vorname, nachname,
              telefon_mobil, telefon_festnetz, email
            )
          `)
          .in('wohnung_id', wohnungIds)

        setMietverhaeltnisse((mv as any) || [])
      } else {
        setMietverhaeltnisse([])
      }

      setLoading(false)
    }

    if (id) load()
  }, [id, supabase])

  const wohnungenOnly = wohnungen.filter((w) => w.wohnungstyp === 'wohnung')

  const wohnungenBelegt = wohnungenOnly.filter((w) =>
    mietverhaeltnisse.some((mv) => mv.wohnung_id === w.id)
  )

  const mieteMonat = wohnungen.reduce(
    (sum, w) => sum + Number(w.nettomiete || 0),
    0
  )

  const nkMonat = wohnungen.reduce(
    (sum, w) => sum + Number(w.nebenkosten_akonto || 0),
    0
  )

  const totalMonat = mieteMonat + nkMonat
  const totalJahr = totalMonat * 12

  const belegungProzent =
    wohnungenOnly.length > 0
      ? Math.round((wohnungenBelegt.length / wohnungenOnly.length) * 100)
      : 0

  const getMieterFor = (wohnungId: string) =>
    mietverhaeltnisse
      .filter((mv) => mv.wohnung_id === wohnungId)
      .sort((a, b) => Number(b.ist_hauptperson) - Number(a.ist_hauptperson))

  async function createWohnung(e: React.FormEvent) {
    e.preventDefault()
    if (!id) return
    setSavingWohnung(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Nicht eingeloggt')

      const bezeichnung = newWohnung.bezeichnung.trim() || newWohnung.whg_nr.trim()
      if (!bezeichnung) throw new Error('Bezeichnung oder Wohnungs-Nr. erfassen')

      const { data, error } = await supabase
        .from('wohnungen')
        .insert({
          liegenschaft_id: id,
          verwalter_id: user.id,
          whg_nr: newWohnung.whg_nr.trim() || null,
          bezeichnung,
          etage: Number(newWohnung.etage || 0),
          zimmer: Number(newWohnung.zimmer || 0),
          flaeche_m2: newWohnung.flaeche_m2 ? Number(newWohnung.flaeche_m2) : null,
          nettomiete: Number(newWohnung.nettomiete || 0),
          nebenkosten_akonto: Number(newWohnung.nebenkosten_akonto || 0),
          wohnungstyp: newWohnung.wohnungstyp,
          status: 'leer',
        })
        .select('*')
        .single()

      if (error) throw error

      toast.success('Wohnung hinzugefügt')
      setWohnungen((prev) => [...prev, data as Wohnung])
      setShowAddWohnung(false)
      setNewWohnung({
        whg_nr: '',
        bezeichnung: '',
        etage: '0',
        zimmer: '3.5',
        flaeche_m2: '',
        nettomiete: '',
        nebenkosten_akonto: '',
        wohnungstyp: 'wohnung',
        mieterHinterlegen: true,
      })

      if (newWohnung.mieterHinterlegen) {
        router.push(`/dashboard/objekte/${id}/wohnungen/${data.id}/einzug`)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Wohnung konnte nicht erstellt werden')
    } finally {
      setSavingWohnung(false)
    }
  }

  const grouped: Record<string, Wohnung[]> = {}

  wohnungen.forEach((w) => {
    const typ = w.wohnungstyp || 'sonstiges'

    if (!grouped[typ]) grouped[typ] = []

    grouped[typ].push(w)
  })

  const typReihenfolge = [
    'wohnung',
    'gewerbe',
    'bastelraum',
    'parkplatz_aussen',
    'einstellgarage',
    'lager',
    'sonstiges',
  ]

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-1/3" />
          <div className="h-32 bg-gray-200 rounded" />
        </div>
      </div>
    )
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 bg-blue-50 rounded-lg flex items-center justify-center text-2xl">
            🏢
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold">
                {liegenschaft?.name}
              </h1>

              <span className="text-xs bg-gray-100 text-gray-700 px-2 py-0.5 rounded">
                {liegenschaft?.objekttyp}
              </span>

              {liegenschaft?.externe_referenz && (
                <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded">
                  Ref. {liegenschaft.externe_referenz}
                </span>
              )}
            </div>

            <p className="text-sm text-gray-500 mt-0.5">
              {liegenschaft?.strasse} {liegenschaft?.hausnummer},{' '}
              {liegenschaft?.plz} {liegenschaft?.ort}
            </p>

            {liegenschaft?.baujahr && (
              <p className="text-xs text-gray-400 mt-0.5">
                Baujahr {liegenschaft.baujahr}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowAddWohnung(true)}
            className="px-4 py-2 bg-[hsl(214,76%,49%)] text-white text-sm font-semibold rounded-xl hover:bg-[hsl(214,76%,44%)] transition-colors"
          >
            + Wohnung hinzufügen
          </button>
          <button
            onClick={() => router.back()}
            className="text-sm text-gray-500 hover:text-gray-900"
          >
            ← Zurück
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard
          label="Wohnungen"
          value={wohnungenOnly.length.toString()}
          sublabel={`+ ${wohnungen.length - wohnungenOnly.length} Nebenobjekte`}
        />

        <KpiCard
          label="Belegt"
          value={`${wohnungenBelegt.length}/${wohnungenOnly.length}`}
        />

        <KpiCard
          label="Belegung"
          value={`${belegungProzent}%`}
          highlight={
            belegungProzent === 100
              ? 'green'
              : belegungProzent > 0
                ? 'blue'
                : 'gray'
          }
        />

        <KpiCard
          label="Bruttomiete/Mt."
          value={`CHF ${fmt0(totalMonat)}`}
          sublabel={`Jahr: CHF ${fmt0(totalJahr)}`}
        />
      </div>

      {typReihenfolge.map((typ) => {
        const items = grouped[typ]

        if (!items || items.length === 0) return null

        const cfg = TYP_CONFIG[typ] || TYP_CONFIG.sonstiges

        const sumMiete = items.reduce(
          (s, w) =>
            s + Number(w.nettomiete || 0) + Number(w.nebenkosten_akonto || 0),
          0
        )

        return (
          <div key={typ} className="bg-white rounded-xl border overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
              <div className="font-semibold flex items-center gap-2">
                <span>{cfg.icon}</span>
                <span>{cfg.label}</span>
                <span className="text-xs text-gray-500 font-normal">
                  ({items.length})
                </span>
              </div>

              {sumMiete > 0 && (
                <div className="text-sm text-gray-600">
                  Total: CHF {fmt(sumMiete)}/Mt.
                </div>
              )}
            </div>

            <div className="divide-y">
              {items.map((w) => {
                const mvs = getMieterFor(w.id)

                return (
                  <div
                    key={w.id}
                    onClick={() =>
                      router.push(`/dashboard/objekte/${id}/wohnungen/${w.id}`)
                    }
                    className="p-4 hover:bg-gray-50 transition cursor-pointer"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {w.whg_nr && (
                            <span className="text-xs font-mono bg-gray-100 px-1.5 py-0.5 rounded">
                              {w.whg_nr}
                            </span>
                          )}

                          <span className="font-medium">
                            {w.bezeichnung}
                          </span>

                          <select
                            value={w.wohnungstyp || 'wohnung'}
                            onClick={(e) => e.stopPropagation()}
                            onChange={async (e) => {
                              e.stopPropagation()
                              const newTyp = e.target.value
                              await supabase
                                .from('wohnungen')
                                .update({ wohnungstyp: newTyp })
                                .eq('id', w.id)
                              setWohnungen((prev) =>
                                prev.map((x) =>
                                  x.id === w.id ? { ...x, wohnungstyp: newTyp } : x
                                )
                              )
                            }}
                            className="text-xs border border-gray-200 rounded px-1.5 py-0.5 text-gray-600 bg-white hover:border-gray-400 focus:outline-none focus:border-blue-400 cursor-pointer"
                          >
                            {TYP_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.icon} {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="text-xs text-gray-500 flex gap-3 mb-2 flex-wrap">
                          {w.zimmer > 0 && <span>{w.zimmer} Zimmer</span>}

                          {w.flaeche_m2 && Number(w.flaeche_m2) > 0 && (
                            <span>{w.flaeche_m2} m²</span>
                          )}

                          {w.verteilschluessel_prozent && (
                            <span>
                              {w.verteilschluessel_prozent}% Anteil
                            </span>
                          )}

                          {w.kuendigungstermine && (
                            <span>
                              Kündigung: {formatKuendigungstermine(w.kuendigungstermine)}
                            </span>
                          )}
                        </div>

                        {mvs.length > 0 ? (
                          <div className="space-y-0.5">
                            {mvs.map((mv, i) => {
                              const m = mv.mieter

                              if (!m) return null

                              return (
                                <div
                                  key={i}
                                  className="text-sm flex items-center gap-2"
                                >
                                  <span className="text-xs">
                                    {mv.ist_hauptperson
                                      ? '⭐'
                                      : mv.ist_vertragspartner
                                        ? '📝'
                                        : '·'}
                                  </span>

                                  <span
                                    className={
                                      mv.ist_hauptperson
                                        ? 'font-medium'
                                        : 'text-gray-600'
                                    }
                                  >
                                    {[m.vorname, m.nachname]
                                      .filter(Boolean)
                                      .join(' ')}
                                  </span>

                                  {mv.ist_hauptperson &&
                                    mvs.some(
                                      (x) =>
                                        x.ist_vertragspartner &&
                                        !x.ist_hauptperson
                                    ) && (
                                      <span className="text-xs text-gray-400">
                                        (Hauptperson)
                                      </span>
                                    )}

                                  {mv.ist_vertragspartner &&
                                    !mv.ist_hauptperson && (
                                      <span className="text-xs text-gray-400">
                                        (Vertragspartner)
                                      </span>
                                    )}
                                </div>
                              )
                            })}
                          </div>
                        ) : (
                          <div className="flex items-center gap-3">
                            <span className="text-sm text-gray-400 italic">
                              Kein Mieter zugeordnet
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                router.push(`/dashboard/objekte/${id}/wohnungen/${w.id}/einzug`)
                              }}
                              className="text-xs px-2.5 py-1 rounded-lg border border-[hsl(214,76%,49%)] text-[hsl(214,76%,49%)] font-semibold hover:bg-blue-50"
                            >
                              Mieter hinterlegen
                            </button>
                          </div>
                        )}
                      </div>

                      <div className="text-right flex-shrink-0">
                        {Number(w.nettomiete) > 0 ? (
                          <>
                            <div className="font-semibold">
                              CHF{' '}
                              {fmt(
                                Number(w.nettomiete) +
                                  Number(w.nebenkosten_akonto)
                              )}
                            </div>

                            <div className="text-xs text-gray-400">
                              Netto {fmt(Number(w.nettomiete))}

                              {Number(w.nebenkosten_akonto) > 0 && (
                                <> + NK {fmt(Number(w.nebenkosten_akonto))}</>
                              )}
                            </div>
                          </>
                        ) : (
                          <span className="text-xs text-gray-400">–</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {wohnungen.length === 0 && (
        <div className="bg-white rounded-xl border p-12 text-center">
          <div className="text-4xl mb-2">🏠</div>
          <p className="text-gray-500">Noch keine Wohnungen.</p>
          <button
            onClick={() => setShowAddWohnung(true)}
            className="mt-4 px-4 py-2 bg-[hsl(214,76%,49%)] text-white text-sm font-semibold rounded-xl hover:bg-[hsl(214,76%,44%)] transition-colors"
          >
            Erste Wohnung hinzufügen
          </button>
        </div>
      )}

      {showAddWohnung && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Wohnung hinzufügen</h2>
                <p className="text-sm text-gray-500">Einheit erfassen und optional direkt den Mieter hinterlegen.</p>
              </div>
              <button
                onClick={() => setShowAddWohnung(false)}
                className="w-8 h-8 rounded-lg hover:bg-gray-100 text-gray-400"
              >
                ×
              </button>
            </div>

            <form onSubmit={createWohnung} className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Wohnungs-Nr.</label>
                  <input
                    value={newWohnung.whg_nr}
                    onChange={(e) => setNewWohnung((f) => ({ ...f, whg_nr: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                    placeholder="1001 EG li"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Bezeichnung *</label>
                  <input
                    required
                    value={newWohnung.bezeichnung}
                    onChange={(e) => setNewWohnung((f) => ({ ...f, bezeichnung: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                    placeholder="3.5-Zimmerwohnung"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Typ</label>
                  <select
                    value={newWohnung.wohnungstyp}
                    onChange={(e) => setNewWohnung((f) => ({ ...f, wohnungstyp: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    {TYP_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.icon} {opt.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Etage</label>
                  <input
                    type="number"
                    value={newWohnung.etage}
                    onChange={(e) => setNewWohnung((f) => ({ ...f, etage: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Zimmer</label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    value={newWohnung.zimmer}
                    onChange={(e) => setNewWohnung((f) => ({ ...f, zimmer: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Fläche m²</label>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    value={newWohnung.flaeche_m2}
                    onChange={(e) => setNewWohnung((f) => ({ ...f, flaeche_m2: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Nettomiete CHF</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newWohnung.nettomiete}
                    onChange={(e) => setNewWohnung((f) => ({ ...f, nettomiete: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase mb-1.5">Nebenkosten CHF</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={newWohnung.nebenkosten_akonto}
                    onChange={(e) => setNewWohnung((f) => ({ ...f, nebenkosten_akonto: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={newWohnung.mieterHinterlegen}
                  onChange={(e) => setNewWohnung((f) => ({ ...f, mieterHinterlegen: e.target.checked }))}
                  className="rounded"
                />
                Nach dem Speichern direkt Mieter hinterlegen
              </label>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddWohnung(false)}
                  className="px-4 py-2 border border-gray-200 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50"
                >
                  Abbrechen
                </button>
                <button
                  type="submit"
                  disabled={savingWohnung}
                  className="flex-1 py-2.5 bg-[hsl(214,76%,49%)] text-white font-semibold rounded-xl text-sm disabled:opacity-50"
                >
                  {savingWohnung ? 'Wird gespeichert…' : 'Wohnung speichern'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

function KpiCard({
  label,
  value,
  sublabel,
  highlight,
}: {
  label: string
  value: string
  sublabel?: string
  highlight?: 'green' | 'blue' | 'gray'
}) {
  const valueColor =
    highlight === 'green'
      ? 'text-green-600'
      : highlight === 'blue'
        ? 'text-blue-600'
        : 'text-gray-900'

  return (
    <div className="bg-white rounded-xl border p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${valueColor}`}>{value}</p>

      {sublabel && (
        <p className="text-xs text-gray-400 mt-1">
          {sublabel}
        </p>
      )}
    </div>
  )
}

function formatKuendigungstermine(value?: string | null) {
  if (!value) {
    return '-'
  }

  const monate: Record<string, string> = {
    '01': 'Januar',
    '02': 'Februar',
    '03': 'März',
    '04': 'April',
    '05': 'Mai',
    '06': 'Juni',
    '07': 'Juli',
    '08': 'August',
    '09': 'September',
    '10': 'Oktober',
    '11': 'November',
    '12': 'Dezember',
  }

  const cleaned = value.replace(/\D/g, '')
  const parts = cleaned.match(/.{1,2}/g) ?? []

  const formatted = parts
    .map((m) => monate[m])
    .filter(Boolean)
    .join(', ')

  return formatted || value
}
