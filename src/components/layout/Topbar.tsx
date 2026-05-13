"use client";

import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import type { Profile } from "@/types";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard":                  "Dashboard",
  "/dashboard/objekte":          "Objekte & Mieter",
  "/dashboard/tickets":          "Tickets",
  "/dashboard/offerten":         "Offerten & Aufträge",
  "/dashboard/escrow":           "Escrow & Zahlung",
  "/dashboard/nebkosten":        "Nebenkostenabrechnung",
  "/dashboard/mieter":           "Meine Wohnung",
  "/dashboard/dienstleister":    "Mein Betrieb",
  "/dashboard/marktplatz":       "Marktplatz",
  "/dashboard/einstellungen":    "Einstellungen",
};

interface TopbarProps {
  profile: Profile | null;
  onMenuToggle?: () => void;
}

export default function Topbar({ profile, onMenuToggle }: TopbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const title = PAGE_TITLES[pathname] ?? "Inovimmo";
  const today = new Date().toLocaleDateString("de-CH", { weekday: "long", day: "numeric", month: "long" });

  async function handleLogout() {
    await supabase.auth.signOut();
    toast.success("Abgemeldet");
    router.push("/auth/login");
    router.refresh();
  }

  return (
    <header className="h-14 bg-white border-b border-border flex items-center px-4 md:px-6 gap-3 flex-shrink-0">
      {/* Hamburger – mobile only */}
      <button
        className="md:hidden flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
        onClick={onMenuToggle}
        aria-label="Menü öffnen"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M2 4h12M2 8h12M2 12h12" stroke="#6b7280" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>

      <div className="flex-1 min-w-0">
        <h1 className="text-base font-semibold text-gray-900 truncate">{title}</h1>
        <p className="text-xs text-gray-400 hidden sm:block">{today}</p>
      </div>

      {/* Search */}
      <div className="hidden md:flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 text-sm text-gray-400 cursor-pointer hover:border-gray-300 transition-colors w-48">
        <span className="text-xs">🔍</span>
        <span className="text-xs">Suchen…</span>
      </div>

      {/* Notifications */}
      <button className="relative w-8 h-8 rounded-lg border border-gray-200 bg-white flex items-center justify-center hover:bg-gray-50 transition-colors text-sm flex-shrink-0">
        🔔
        <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white" />
      </button>

      {/* Avatar + logout */}
      <button
        onClick={handleLogout}
        className="flex items-center gap-2 hover:bg-gray-50 rounded-lg px-2 py-1 transition-colors flex-shrink-0"
        title="Abmelden"
      >
        <div className="w-7 h-7 rounded-full bg-[hsl(214,76%,49%)] flex items-center justify-center text-white text-xs font-bold">
          {profile?.full_name?.split(" ").map(n => n[0]).join("").toUpperCase().slice(0,2) ?? "??"}
        </div>
        <span className="text-xs text-gray-600 hidden md:block max-w-[100px] truncate">
          {profile?.full_name ?? "Benutzer"}
        </span>
      </button>
    </header>
  );
}
