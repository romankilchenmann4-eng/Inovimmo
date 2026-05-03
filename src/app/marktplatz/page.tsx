export default function MarktplatzPage() {
  const services = [
    { icon:"🏦", title:"Gebäudeversicherung", desc:"Vergleich & Abschluss von Gebäude-, Haftpflicht- und Mietausfallversicherungen. Partnerrabatt bis 15%.", badge:"Bis 15% günstiger", badgeCls:"badge-green", cta:"Vergleichen" },
    { icon:"🏛", title:"Hypothek vergleichen", desc:"Aktuelle Hypothekarzinsen von 12 Schweizer Banken. Valiant, Raiffeisen, Migros Bank und weitere.", badge:"Partnerbanken", badgeCls:"badge-blue", cta:"Jetzt vergleichen" },
    { icon:"🔍", title:"Mieter-Screening", desc:"Betreibungsauszug, Bonitätsprüfung und ID-Verifizierung in einer Anfrage. Ergebnis in 24h.", badge:"CHF 25/Check", badgeCls:"badge-amber", cta:"Screening starten" },
    { icon:"⚡", title:"Energie-Monitoring", desc:"IoT-Anbindung und CO₂-Reporting für GEAK-Zertifizierung und Nachhaltigkeitsnachweis.", badge:"ESG-konform", badgeCls:"badge-blue", cta:"Mehr erfahren" },
    { icon:"📈", title:"KI-Mietpreisanalyse", desc:"Automatische Marktpreisempfehlung für alle Ihre Wohnungen basierend auf Echtzeitdaten.", badge:"CHF 9/Mt.", badgeCls:"badge-amber", cta:"Premium aktivieren" },
    { icon:"🚛", title:"Umzugs-Services", desc:"Bis zu 5 kostenlose Offerten von geprüften Umzugsfirmen für Ihre Mieter.", badge:"Für Mieter", badgeCls:"badge-gray", cta:"Weiterleiten" },
    { icon:"🔨", title:"Renovations-Finanzierung", desc:"Buy-now-pay-later für grössere Aufträge über CHF 2\'000. 0% Zinsen bis 12 Monate.", badge:"0% bis 12 Mt.", badgeCls:"badge-blue", cta:"Berechnen" },
    { icon:"📑", title:"Digitale Wohnungsübergabe", desc:"Tablet-basierte Abnahme mit Fotos, Unterschrift und automatischem PDF-Protokoll.", badge:"CHF 12/Übergabe", badgeCls:"badge-amber", cta:"Aktivieren" },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Marktplatz & Services</h2>
        <p className="text-sm text-gray-500">Alle Zusatzleistungen direkt aus Inovimmo — kein Kontowechsel nötig.</p>
      </div>

      <div className="info-box-blue">
        <p className="text-sm font-semibold text-blue-800">ℹ️ Wie funktioniert der Marktplatz?</p>
        <p className="text-xs text-blue-700 mt-1">
          Inovimmo vermittelt Sie an geprüfte Partner. Die Plattform ist für Sie kostenlos — Inovimmo erhält eine Vermittlungsprovision vom Partner. Kein Aufpreis für Sie.
        </p>
      </div>

      <div className="grid md:grid-cols-2 xl:grid-cols-4 gap-4">
        {services.map(s => (
          <div key={s.title} className="bg-white rounded-xl border border-border shadow-sm hover:shadow-md hover:border-[hsl(214,76%,49%)] transition-all p-5 flex flex-col">
            <div className="text-3xl mb-3">{s.icon}</div>
            <h3 className="font-bold text-gray-900 text-sm mb-1">{s.title}</h3>
            <p className="text-xs text-gray-500 leading-relaxed flex-1">{s.desc}</p>
            <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
              <span className={`${s.badgeCls} text-xs`}>{s.badge}</span>
              <button className="text-xs text-[hsl(214,76%,49%)] font-semibold hover:underline">{s.cta} →</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
