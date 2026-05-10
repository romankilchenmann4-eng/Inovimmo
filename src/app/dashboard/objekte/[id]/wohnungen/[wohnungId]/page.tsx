'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

type Wohnung = {
  id: string
  liegenschaft_id: string
  bezeichnung?: string
  whg_nr?: string
  etage?: number
  zimmer?: number
  flaeche_m2?: number
  nettomiete?: number
  nebenkosten_akonto?: number
  status?: string
  wohnungstyp?: string
  beheizt?: boolean
  position?: string
  kuendigungstermine?: string
  verteilschluessel_prozent?: number
}

type Mieter = {
  id: string
  vorname?: string
  nachname?: string
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

const fmt = (n: number) =>
  n.toLocaleString('de-CH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })

export default function WohnungDetailPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()

  const objektId = params.id as string
  const wohnungId = params.wohnungId as string

  const [wohnung, setWohnung] = useState<Wohnung | null>(null)
  const [mietverhaeltnisse, setMietverhaeltnisse] = useState<Mietverhaeltnis[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      setLoading(true)

      const { data: w } = await supabase
        .from('wohnungen')
        .select('*')
        .eq('id', wohnungId)
        .maybeSingle()

      setWohnung(w)

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
        .eq('wohnung_id', wohnungId)

      setMietverhaeltnisse((mv as any) || [])
      setLoading(false)
    }

    if (wohnungId) load()
  }, [wohnungId, supabase])

  if (loading) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        <div className="animate-pulse h-32 bg-gray-200 rounded" />
      </div>
    )
  }

  if (!wohnung) {
    return (
      <div className="p-6 max-w-5xl mx-auto">
        Wohnung nicht gefunden.
      </div>
    )
  }

  const netto = Number(wohnung.nettomiete || 0)
  const nk = Number(wohnung.nebenkosten_akonto || 0)
  const brutto = netto + nk

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <button
        onClick={() => router.push(`/dashboard/objekte/${objektId}`)}
        className="text-sm text-gray-500 hover:text-gray-900"
      >
        ← Zurück zur Liegenschaft
      </button>

      <div className="bg-white rounded-xl border p-6">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-2xl font-bold">
              {wohnung.whg_nr && `${wohnung.whg_nr} · `}
              {wohnung.bezeichnung || 'Wohnung'}
            </h1>

            <p className="text-sm text-gray-500 mt-1">
              {wohnung.wohnungstyp || 'Wohnung'} · Status: {wohnung.status || '-'}
            </p>
          </div>

          <div className="text-right">
            <div className="text-2xl font-bold">
              CHF {fmt(brutto)}
            </div>

            <div className="text-xs text-gray-500">
              Netto CHF {fmt(netto)} + NK CHF {fmt(nk)}
            </div>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <InfoCard label="Zimmer" value={wohnung.zimmer ? `${wohnung.zimmer}` : '-'} />
        <InfoCard label="Fläche" value={wohnung.flaeche_m2 ? `${wohnung.flaeche_m2} m²` : '-'} />
        <InfoCard label="Verteilschlüssel" value={wohnung.verteilschluessel_prozent ? `${wohnung.verteilschluessel_prozent}%` : '-'} />
        <InfoCard label="Etage" value={wohnung.etage !== undefined ? `${wohnung.etage}` : '-'} />
        <InfoCard label="Beheizt" value={wohnung.beheizt ? 'Ja' : 'Nein'} />
        <InfoCard label="Kündigung" value={wohnung.kuendigungstermine || '-'} />
      </div>

      <div className="bg-white rounded-xl border p-6">
        <h2 className="font-semibold mb-4">Mieter</h2>

        {mietverhaeltnisse.length === 0 ? (
          <p className="text-sm text-gray-500">
            Kein Mieter zugeordnet.
          </p>
        ) : (
          <div className="space-y-3">
            {mietverhaeltnisse.map((mv, index) => {
              const m = mv.mieter

              return (
                <div key={index} className="border rounded-lg p-4">
                  <div className="font-medium">
                    {[m?.vorname, m?.nachname].filter(Boolean).join(' ') || 'Mieter'}
                  </div>

                  <div className="text-sm text-gray-500">
                    {mv.ist_hauptperson && 'Hauptperson'}
                    {mv.ist_vertragspartner && !mv.ist_hauptperson && 'Vertragspartner'}
                    {!mv.ist_hauptperson && !mv.ist_vertragspartner && 'Mieter'}
                  </div>

                  {m?.email && (
                    <div className="text-sm text-gray-500 mt-1">
                      E-Mail: {m.email}
                    </div>
                  )}

                  {m?.telefon_mobil && (
                    <div className="text-sm text-gray-500">
                      Mobil: {m.telefon_mobil}
                    </div>
                  )}

                  {m?.telefon_festnetz && (
                    <div className="text-sm text-gray-500">
                      Festnetz: {m.telefon_festnetz}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <div className="bg-blue-50 rounded-xl border border-blue-100 p-6">
        <h2 className="font-semibold mb-2">
          Grundlage für Mietzinserhöhung
        </h2>

        <div className="grid md:grid-cols-2 gap-3 text-sm">
          <div>Aktuelle Nettomiete: CHF {fmt(netto)}</div>
          <div>Nebenkosten Akonto: CHF {fmt(nk)}</div>
          <div>Bruttomiete: CHF {fmt(brutto)}</div>
          <div>Verteilschlüssel: {wohnung.verteilschluessel_prozent ?? '-'}%</div>
          <div>Fläche: {wohnung.flaeche_m2 ?? '-'} m²</div>
          <div>Beheizt: {wohnung.beheizt ? 'Ja' : 'Nein'}</div>
          <div>Kündigungstermine: {wohnung.kuendigungstermine || '-'}</div>
          <div>Wohnungstyp: {wohnung.wohnungstyp || '-'}</div>
        </div>
      </div>
    </div>
  )
}

function InfoCard({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <div className="bg-white rounded-xl border p-4">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className="text-xl font-bold">{value}</p>
    </div>
  )
}
