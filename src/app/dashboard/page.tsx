'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function DashboardPage() {
  const supabase = createClient()

  const [user, setUser] = useState<any>(null)
  const [profile, setProfile] = useState<any>(null)
  const [liegenschaften, setLiegenschaften] = useState<any[]>([])
  const [mieten, setMieten] = useState<any[]>([])
  const [totalWohnungen, setTotalWohnungen] = useState(0)
  const [belegteWohnungen, setBelegteWohnungen] = useState(0)

  useEffect(() => {
    const load = async () => {
      // 👤 User holen
      const { data: userRes } = await supabase.auth.getUser()
      const currentUser = userRes?.user
      setUser(currentUser)

      if (!currentUser) return

      // 👤 Profil
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single()

      setProfile(profile)

      // 👤 Rolle prüfen
      const { data: profileData } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', currentUser.id)
        .single()
      const isAdmin = profileData?.role === 'admin'

      // 🏢 Liegenschaften
      let liegQuery = supabase
        .from('liegenschaften')
        .select('id,name,ort,anzahl_wohnungen')
      if (!isAdmin) liegQuery = liegQuery.eq('verwalter_id', currentUser.id)
      const { data: lieg } = await liegQuery

      setLiegenschaften(lieg || [])

      // 🏠 Wohnungen + Mieten
      let whgQuery = supabase
        .from('wohnungen')
        .select('status, nettomiete, nebenkosten_akonto')
      if (!isAdmin) whgQuery = whgQuery.eq('verwalter_id', currentUser.id)
      const { data: wohnungen } = await whgQuery

      setMieten(wohnungen || [])

      // 📊 KPIs
      const total = wohnungen?.length || 0
      const belegt =
        wohnungen?.filter((w) => w.status === 'vermietet').length || 0

      setTotalWohnungen(total)
      setBelegteWohnungen(belegt)
    }

    load()
  }, [])

  // 💰 Berechnungen
  const jahresErtrag =
    (mieten.reduce((sum, w) => sum + (w.nettomiete ?? 0) + (w.nebenkosten_akonto ?? 0), 0) || 0) * 12

  const leerstandQuote =
    totalWohnungen > 0
      ? (((totalWohnungen - belegteWohnungen) / totalWohnungen) * 100).toFixed(1)
      : '0.0'

  return (
    <div className="space-y-6 max-w-7xl mx-auto p-4">
      {/* Welcome */}
      <div>
        <h2 className="text-xl font-bold">
          Guten Tag, {profile?.full_name?.split(' ')[0] ?? ''} 👋
        </h2>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card">
          <p>Wohnungen</p>
          <p className="text-2xl font-bold">{totalWohnungen}</p>
          <p>{belegteWohnungen} belegt</p>
        </div>

        <div className="stat-card">
          <p>Leerstand</p>
          <p className="text-2xl font-bold">{leerstandQuote}%</p>
        </div>

        <div className="stat-card">
          <p>Jahresertrag</p>
          <p className="text-2xl font-bold">
            CHF {jahresErtrag.toLocaleString('de-CH')}
          </p>
        </div>

        <div className="stat-card">
          <p>Liegenschaften</p>
          <p className="text-2xl font-bold">{liegenschaften.length}</p>
        </div>
      </div>

      {/* Liegenschaften Liste */}
      <div className="bg-white rounded-xl border shadow-sm">
        <div className="flex justify-between p-4 border-b">
          <h3 className="font-semibold">Meine Liegenschaften</h3>
          <Link href="/dashboard/objekte">Alle anzeigen →</Link>
        </div>

        {liegenschaften.length === 0 ? (
          <div className="p-6 text-gray-400">Keine Daten</div>
        ) : (
          liegenschaften.map((l) => (
            <Link
              key={l.id}
              href={`/dashboard/objekte/${l.id}`}
              className="block p-4 border-b hover:bg-gray-50 transition"
            >
              <div className="font-medium">{l.name}</div>
              <div className="text-sm text-gray-400">
                {l.ort} · {l.anzahl_wohnungen} Wohnungen
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  )
}
