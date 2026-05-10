'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

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

const TYP_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  wohnung: { label: 'Wohnungen', icon: '🏠', color: 'bg-blue-50' },
  bastelraum: { label: 'Bastelräume', icon: '🔧', color: 'bg-amber-50' },
  parkplatz_aussen: { label: 'Parkplätze', icon: '🚗', color: 'bg-gray-50' },
  einstellgarage: { label: 'Einstellgaragen', icon: '🏘️', color: 'bg-slate-50' },
  gewerbe: { label: 'Gewerbe', icon: '🏢', color: 'bg-purple-50' },
  lager: { label: 'Lager', icon: '📦', color: 'bg-stone-50' },
  sonstiges: { label: 'Sonstiges', icon: '📌', color: 'bg-neutral-50' },
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

        <button
          onClick={() => router.back()}
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          ← Zurück
        </button>
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

                          {!w.beheizt && typ === 'wohnung' && (
                            <span className="text-xs text-orange-600">
                              ❄️ unbeheizt
                            </span>
                          )}
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
                              Kündigung: {w.kuendigungstermine}
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
                          <div className="text-sm text-gray-400 italic">
                            Kein Mieter zugeordnet
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
