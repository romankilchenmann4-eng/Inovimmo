import Link from "next/link";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-[hsl(214,62%,17%)] to-[hsl(214,55%,23%)] flex items-center justify-center p-6">
      <div className="max-w-2xl w-full text-center text-white animate-fade-in">
        {/* Logo */}
        <div className="flex items-center justify-center gap-3 mb-8">
          <div className="w-12 h-12 bg-[hsl(214,76%,49%)] rounded-xl flex items-center justify-center text-2xl">
            🏛
          </div>
          <span className="text-4xl font-bold tracking-tight">Inovimmo</span>
        </div>

        <p className="text-white/70 text-lg mb-2">Swiss Property Intelligence</p>
        <p className="text-white/50 text-sm mb-10">
          Die erste kostenlose, vollintegrierte Immobilienverwaltungsplattform der Schweiz.
        </p>

        {/* Feature pills */}
        <div className="flex flex-wrap gap-2 justify-center mb-10">
          {["Kostenlos", "Handwerker-Marktplatz", "Escrow-Sicherheit", "Multi-Tenant", "Schweiz-spezifisch"].map((f) => (
            <span key={f} className="px-3 py-1 bg-white/10 rounded-full text-xs text-white/80 border border-white/20">
              ✓ {f}
            </span>
          ))}
        </div>

        {/* CTA */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/auth/register"
            className="px-6 py-3 bg-[hsl(214,76%,49%)] hover:bg-[hsl(214,76%,44%)] text-white font-semibold rounded-xl transition-colors"
          >
            Kostenlos registrieren
          </Link>
          <Link
            href="/auth/login"
            className="px-6 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-xl border border-white/20 transition-colors"
          >
            Einloggen
          </Link>
        </div>

        <p className="text-white/30 text-xs mt-8">
          © 2026 Inovimmo · Zürich, Schweiz
        </p>
      </div>
    </main>
  );
}
