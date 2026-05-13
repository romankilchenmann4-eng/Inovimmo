"use client";

import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { Profile } from "@/types";

const PAGE_TITLES: Record<string, { title: string; sub?: string }> = {
  "/dashboard":                        { title: "Dashboard" },
  "/dashboard/objekte":                { title: "Liegenschaften" },
  "/dashboard/tickets":                { title: "Aufträge", sub: "Tickets" },
  "/dashboard/offerten":               { title: "Aufträge", sub: "Offerten" },
  "/dashboard/escrow":                 { title: "Aufträge", sub: "Escrow & Zahlung" },
  "/dashboard/buchhaltung":            { title: "Finanzen", sub: "Buchhaltung" },
  "/dashboard/nebkosten":              { title: "Finanzen", sub: "Nebenkosten" },
  "/dashboard/mahnungen":              { title: "Finanzen", sub: "Mahnwesen" },
  "/dashboard/qr-rechnung":            { title: "Finanzen", sub: "QR-Rechnung" },
  "/dashboard/dokumente":              { title: "Dokumente & Recht" },
  "/dashboard/mietvertrag":            { title: "Dokumente & Recht", sub: "Mietvertrag" },
  "/dashboard/mietzinserhoehung":      { title: "Dokumente & Recht", sub: "Mietzinserhöhung" },
  "/dashboard/screening":              { title: "Tools", sub: "Screening" },
  "/dashboard/uebergabe":              { title: "Tools", sub: "Übergabe" },
  "/dashboard/kalender":               { title: "Tools", sub: "Kalender" },
  "/dashboard/ki-assistent":           { title: "KI-Assistent" },
  "/dashboard/stwe":                   { title: "STWE" },
  "/dashboard/mieter":                 { title: "Meine Wohnung" },
  "/dashboard/dienstleister":          { title: "Mein Betrieb" },
  "/dashboard/eigentuemerportal":      { title: "Eigentümer-Portal" },
  "/dashboard/einstellungen":          { title: "Einstellungen" },
  "/dashboard/einstellungen/abo":      { title: "Einstellungen", sub: "Abo & Pläne" },
  "/dashboard/admin/benutzer":         { title: "Admin", sub: "Benutzerverwaltung" },
};

function getTitle(pathname: string) {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  for (const [key, val] of Object.entries(PAGE_TITLES)) {
    if (pathname.startsWith(key + "/")) return val;
  }
  return { title: "Inovimmo" };
}

function initials(name?: string | null) {
  return name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2) ?? "??";
}

export default function Topbar({
  profile,
  adminProfile,
}: {
  profile: Profile | null;
  adminProfile?: Profile | null;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const { title, sub } = getTitle(pathname);
  const today = new Date().toLocaleDateString("de-CH", { weekday: "long", day: "numeric", month: "long" });

  async function handleLogout() {
    await supabase.auth.signOut();
    toast.success("Abgemeldet");
    router.push("/auth/login");
    router.refresh();
  }

  const displayProfile = profile;

  return (
    <header className="h-14 bg-white border-b border-border flex items-center px-6 gap-4 flex-shrink-0 z-30">
      {/* Breadcrumb title */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 text-sm">
          <span className="font-semibold text-foreground truncate">{title}</span>
          {sub && (
            <>
              <span className="text-muted-foreground">/</span>
              <span className="text-muted-foreground truncate">{sub}</span>
            </>
          )}
        </div>
        <p className="text-[11px] text-muted-foreground">{today}</p>
      </div>

      {/* Search placeholder */}
      <div className="hidden md:flex items-center gap-2 bg-gray-50 border border-border rounded-xl px-3 py-1.5 w-44 cursor-pointer hover:border-gray-300 transition-colors">
        <span className="text-gray-400 text-xs">🔍</span>
        <span className="text-xs text-gray-400">Suchen…</span>
      </div>

      {/* Notifications */}
      <button className="relative w-8 h-8 rounded-xl border border-border bg-white flex items-center justify-center hover:bg-gray-50 transition-colors text-sm flex-shrink-0">
        🔔
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-white" />
      </button>

      {/* If impersonating: show admin avatar + back link */}
      {adminProfile && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground border border-border rounded-xl px-2.5 py-1.5">
          <div className="w-5 h-5 rounded-full bg-amber-500 flex items-center justify-center text-white text-[9px] font-bold flex-shrink-0">
            {initials(adminProfile.full_name)}
          </div>
          <span className="hidden md:block">Admin</span>
        </div>
      )}

      {/* Avatar + logout */}
      <button
        onClick={handleLogout}
        className="flex items-center gap-2 hover:bg-gray-50 rounded-xl px-2.5 py-1.5 transition-colors flex-shrink-0"
        title="Abmelden"
      >
        <div className="w-7 h-7 rounded-full bg-[hsl(214,76%,49%)] flex items-center justify-center text-white text-[11px] font-bold">
          {initials(displayProfile?.full_name)}
        </div>
        <div className="hidden md:block text-left min-w-0">
          <p className="text-xs font-medium text-foreground truncate max-w-[90px]">
            {displayProfile?.full_name ?? "Benutzer"}
          </p>
          <p className="text-[10px] text-muted-foreground capitalize">{displayProfile?.role}</p>
        </div>
      </button>
    </header>
  );
}
