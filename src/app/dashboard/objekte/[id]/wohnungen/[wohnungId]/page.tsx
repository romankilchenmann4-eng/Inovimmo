'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
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
  mietbeginn?: string
  mietende?: string
  mieter: Mieter
}

const fmt = (n: number) =>
  n.toLocaleString('de-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  vermietet: { label: 'Vermietet', cls: 'badge-green' },
  leer:      { label: 'Leer',      cls: 'badge-gray' },
  reserviert:{ label: 'Reserviert',cls: 'badge-amber' },
}

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
        .from('wohnungen').select('*').eq('id', wohnungId).maybeSingle()
      setWohnung(w)

      const { data: mv } = await supabase
        .from('mietverhaeltnisse')
        .select('wohnung_id, ist_vertragspartner, ist_hauptperson, mietbeginn, mietende, mieter:mieter_id(id, vorname, nachname, telefon_mobil, telefon_festnetz, email)')
        .eq('wohnung_id', wohnungId)
      setMietverhaeltnisse((mv as any) || [])
      setLoading(false)
    }
    if (wohnungId) load()
  }, [wohnungId])

  if (loading) return <div className="p-8"><div className="animate-pulse h-24 bg-gray-100 rounded-xl" /></div>
  if (!wohnung) return <div className="p-8 text-sm text-gray-500">Wohnung nicht gefunden.</div>

  const netto = Number(wohnung.nettomiete || 0)
  const nk = Number(wohnung.nebenkosten_akonto || 0)
  const brutto = netto + nk
  const status = STATUS_LABEL[wohnung.status ?? ''] ?? { label: wohnung.status ?? '—', cls: 'badge-gray' }
  const base = `/dashboard/objekte/${objektId}/wohnungen/${wohnungId}`

  const actions = [
    { href: `${base}/einzug`,     label: 'Einzug erfassen',       sub: 'Mieter anlegen und Mietverhältnis starten' },
    { href: `${base}/auszug`,     label: 'Auszug erfassen',       sub: 'Auszug, Rückgabe und Kaution dokumentieren' },
    { href: `${base}/mietvertrag`,label: 'Mietvertrag hochladen', sub: 'Vertrag oder Nachtrag ablegen' },
    { href: `${base}/uebergabe`,  label: 'Übergabeprotokoll',     sub: 'Einzugs- oder Auszugsprotokoll erstellen' },
    { href: `${base}/inserat`,    label: 'Inserat erstellen',     sub: 'Leerstand vermarkten' },
    { href: `${base}/historie`,   label: 'Historie',              sub: 'Frühere Mieter und Ereignisse' },
  ]

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Breadcrumb */}
      <button
        onClick={() => router.push(`/dashboard/objekte/${objektId}`)}
        className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
      >
        ← Zurück zur Liegenschaft
      </button>

      {/* Header */}
      <div className="bg-white rounded-xl border border-border shadow-sm p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold text-gray-900">
                {wohnung.whg_nr ? `${wohnung.whg_nr} · ` : ''}{wohnung.bezeichnung || 'Wohnung'}
              </h1>
              <span className={status.cls}>{status.label}</span>
            </div>
            <p className="text-sm text-gray-400 mt-1">
              {wohnung.wohnungstyp === 'wohnung' || !wohnung.wohnungstyp ? 'Wohnung' : wohnung.wohnungstyp}
              {wohnung.etage !== undefined ? ` · ${wohnung.etage}. Etage` : ''}
            </p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-semibold text-gray-900">CHF {fmt(brutto)}</p>
            <p className="text-xs text-gray-400 mt-0.5">Netto {fmt(netto)} + NK {fmt(nk)}</p>
          </div>
        </div>

        {/* Kennzahlen */}
        <div className="grid grid-cols-6 gap-4 mt-5 pt-5 border-t border-gray-100">
          {[
            { label: 'Zimmer', value: wohnung.zimmer ? `${wohnung.zimmer}` : '—' },
            { label: 'Fläche', value: wohnung.flaeche_m2 ? `${wohnung.flaeche_m2} m²` : '—' },
            { label: 'Verteilschlüssel', value: wohnung.verteilschluessel_prozent ? `${wohnung.verteilschluessel_prozent}%` : '—' },
            { label: 'Beheizt', value: wohnung.beheizt ? 'Ja' : 'Nein' },
            { label: 'Etage', value: wohnung.etage !== undefined ? `${wohnung.etage}` : '—' },
            { label: 'Kündigung', value: formatKuendigungstermine(wohnung.kuendigungstermine) },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-xs text-gray-400 mb-0.5">{label}</p>
              <p className="text-sm font-medium text-gray-800">{value}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        {/* Aktuelle Mieter */}
        <div className="bg-white rounded-xl border border-border shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Mietverhältnis</h2>
          {mietverhaeltnisse.length === 0 ? (
            <p className="text-sm text-gray-400">Kein aktiver Mieter zugeordnet.</p>
          ) : (
            <div className="space-y-4">
              {mietverhaeltnisse.map((mv, i) => {
                const m = mv.mieter
                return (
                  <div key={i} className="pb-4 border-b border-gray-100 last:border-0 last:pb-0">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {[m?.vorname, m?.nachname].filter(Boolean).join(' ') || '—'}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {mv.ist_hauptperson ? 'Hauptmieter' : mv.ist_vertragspartner ? 'Vertragspartner' : 'Mitmieter'}
                        </p>
                      </div>
                      {mv.mietbeginn && (
                        <p className="text-xs text-gray-400">
                          seit {new Date(mv.mietbeginn).toLocaleDateString('de-CH')}
                        </p>
                      )}
                    </div>
                    <div className="mt-2 space-y-0.5">
                      {m?.email && <p className="text-xs text-gray-500">{m.email}</p>}
                      {m?.telefon_mobil && <p className="text-xs text-gray-500">{m.telefon_mobil}</p>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Mietzins-Basis */}
        <div className="bg-white rounded-xl border border-border shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">Mietzins-Grundlage</h2>
          <div className="space-y-2">
            {[
              { label: 'Nettomiete',        value: `CHF ${fmt(netto)}` },
              { label: 'Nebenkosten Akonto',value: `CHF ${fmt(nk)}` },
              { label: 'Bruttomiete',        value: `CHF ${fmt(brutto)}`, bold: true },
              { label: 'Verteilschlüssel',  value: `${wohnung.verteilschluessel_prozent ?? '—'}%` },
              { label: 'Fläche',            value: wohnung.flaeche_m2 ? `${wohnung.flaeche_m2} m²` : '—' },
              { label: 'Wohnungstyp',       value: wohnung.wohnungstyp || '—' },
              { label: 'Kündigungstermine', value: formatKuendigungstermine(wohnung.kuendigungstermine) },
            ].map(({ label, value, bold }) => (
              <div key={label} className={`flex justify-between py-1.5 ${bold ? 'border-t border-gray-100 mt-1 pt-2.5' : ''}`}>
                <span className="text-xs text-gray-500">{label}</span>
                <span className={`text-xs ${bold ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Aktionen */}
      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Aktionen</h2>
        </div>
        <div className="divide-y divide-gray-100">
          {actions.map(({ href, label, sub }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors group"
            >
              <div>
                <p className="text-sm font-medium text-gray-900">{label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{sub}</p>
              </div>
              <span className="text-gray-300 group-hover:text-gray-500 transition-colors text-sm">→</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}

function formatKuendigungstermine(value?: string | null) {
  if (!value) return '—'
  const monate: Record<string, string> = {
    '01':'Jan','02':'Feb','03':'Mär','04':'Apr','05':'Mai','06':'Jun',
    '07':'Jul','08':'Aug','09':'Sep','10':'Okt','11':'Nov','12':'Dez',
  }
  const cleaned = value.replace(/\D/g, '')
  const parts = cleaned.match(/.{1,2}/g) ?? []
  const formatted = parts.map(m => monate[m]).filter(Boolean).join(', ')
  return formatted || value
}
