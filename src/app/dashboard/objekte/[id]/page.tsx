'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ObjektDetail() {
  const { id } = useParams()
  const supabase = createClient()

  const [liegenschaft, setLiegenschaft] = useState<any>(null)
  const [wohnungen, setWohnungen] = useState<any[]>([])

  useEffect(() => {
    const load = async () => {
      // 🏢 Liegenschaft
      const { data: l } = await supabase
        .from('liegenschaften')
        .select('*')
        .eq('id', id)
        .single()

      setLiegenschaft(l)

      // 🏠 Wohnungen
      const { data: w } = await supabase
        .from('wohnungen')
        .select('*')
        .eq('liegenschaft_id', id)

      setWohnungen(w || [])
    }

    load()
  }, [id])

  // 💰 Berechnung
  const monat = wohnungen.reduce(
    (sum, w) => sum + (w.brutto_miete ?? 0),
    0
  )

  const jahr = monat * 12

  return (
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">
          {liegenschaft?.name}
        </h1>
        <p className="text-gray-400">{liegenschaft?.ort}</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <div className="stat-card">
          <p>Wohnungen</p>
          <p className="text-xl font-bold">{wohnungen.length}</p>
        </div>

        <div className="stat-card">
          <p>Monat</p>
          <p className="text-xl font-bold">
            CHF {monat.toLocaleString('de-CH')}
          </p>
        </div>

        <div className="stat-card">
          <p>Jahr</p>
          <p className="text-xl font-bold">
            CHF {jahr.toLocaleString('de-CH')}
          </p>
        </div>
      </div>

      {/* Wohnungen */}
      <div className="bg-white rounded-xl border">
        <div className="p-4 border-b font-semibold">
          Wohnungen
        </div>

        {wohnungen.length === 0 ? (
          <div className="p-6 text-gray-400">
            Keine Wohnungen vorhanden
          </div>
        ) : (
          wohnungen.map((w) => (
            <div
              key={w.id}
              className="p-4 border-b flex justify-between"
            >
              <div>
                <div className="font-medium">
                  {w.bezeichnung}
                </div>
                <div className="text-sm text-gray-400">
                  {w.zimmer} Zimmer
                </div>
              </div>

              <div className="font-semibold">
                CHF {w.brutto_miete}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
