"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Profile } from "@/types";

type Role = "admin" | "verwalter" | "eigentümer" | "dienstleister" | "mieter";

type NavItem = {
  href: string;
  label: string;
  icon: string;
  roles: Role[];
  section?: string;
  badge?: string;
  activeFor?: string[];
};

const NAV: NavItem[] = [
  {
    href: "/dashboard",
    label: "Dashboard",
    icon: "📊",
    roles: ["admin", "verwalter", "eigentümer", "dienstleister", "mieter"],
    section: "Hauptmenü",
  },

  {
    href: "/dashboard/objekte",
    label: "Liegenschaften",
    icon: "🏢",
    roles: ["admin", "verwalter", "eigentümer"],
  },

  {
    href: "/dashboard/tickets",
    label: "Aufträge",
    icon: "🔨",
    roles: ["admin", "verwalter", "dienstleister", "mieter"],
    activeFor: ["/dashboard/offerten", "/dashboard/escrow"],
  },

  {
    href: "/dashboard/buchhaltung",
    label: "Finanzen",
    icon: "💶",
    roles: ["admin", "verwalter"],
    activeFor: ["/dashboard/nebkosten", "/dashboard/mahnungen", "/dashboard/qr-rechnung"],
  },

  {
    href: "/dashboard/dokumente",
    label: "Dokumente & Recht",
    icon: "📁",
    roles: ["admin", "verwalter", "eigentümer"],
    activeFor: [
      "/dashboard/mietvertrag",
      "/dashboard/mietzinserhoehung",
      "/dashboard/dokumente/jahresbericht",
    ],
  },

  {
    href: "/dashboard/screening",
    label: "Tools",
    icon: "🛠",
    roles: ["admin", "verwalter"],
    activeFor: ["/dashboard/uebergabe", "/dashboard/kalender"],
  },

  {
    href: "/dashboard/ki-assistent",
    label: "KI",
    icon: "🤖",
    roles: ["admin", "verwalter", "eigentümer", "mieter"],
    activeFor: ["/dashboard/ki-analyse"],
  },

  {
    href: "/dashboard/stwe",
    label: "Erweitert",
    icon: "🏛",
    roles: ["admin", "verwalter"],
    activeFor: ["/dashboard/marktplatz"],
  },

  // ── Mieter ─────────────────────────────────────────────────
  {
    href: "/dashboard/mieter",
    label: "Meine Wohnung",
    icon: "🏠",
    roles: ["mieter"],
    section: "Mein Bereich",
  },
  {
    href: "/dashboard/mieter/anpassungen",
    label: "Mietzinsanpassungen",
    icon: "🧾",
    roles: ["mieter"],
  },
  {
    href: "/dashboard/tickets",
    label: "Tickets",
    icon: "🎫",
    roles: ["mieter"],
  },

  // ── Dienstleister ───────────────────────────────────────────
  {
    href: "/dashboard/dienstleister",
    label: "Mein Betrieb",
    icon: "🔧",
    roles: ["dienstleister"],
    section: "Mein Betrieb",
  },
  {
    href: "/dashboard/offerten",
    label: "Ausschreibungen",
    icon: "📋",
    roles: ["dienstleister"],
  },

  // ── Admin ───────────────────────────────────────────────────
  {
    href: "/dashboard/admin/benutzer",
    label: "Benutzerverwaltung",
    icon: "👥",
    roles: ["admin"],
    section: "Admin",
  },

  // ── Konto ───────────────────────────────────────────────────
  {
    href: "/dashboard/einstellungen",
    label: "Einstellungen",
    icon: "⚙️",
    roles: ["admin", "verwalter", "eigentümer", "dienstleister", "mieter"],
    section: "Konto",
  },
  {
    href: "/dashboard/einstellungen/abo",
    label: "Abo & Pläne",
    icon: "💳",
    roles: ["admin", "verwalter"],
  },
];

export default function Sidebar({ profile }: { profile: Profile | null }) {
  const pathname = usePathname();
  const role = normalizeRole(profile?.role);
  const filtered = NAV.filter((n) => n.roles.includes(role));

  const initials =
    profile?.full_name
      ?.split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2) || "??";

  let lastSection = "";

  return (
    <aside className="sidebar overflow-y-auto" style={{ width: 240 }}>
      <div className="px-4 py-5 border-b border-white/10 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-[hsl(214,76%,49%)] rounded-lg flex items-center justify-center text-base flex-shrink-0">
            🏛
          </div>
          <span className="text-lg font-bold tracking-tight">Inovimmo</span>
        </div>
        <p className="text-white/30 text-xs mt-0.5 ml-10">
          Swiss Property Intelligence
        </p>
      </div>

      <nav className="flex-1 py-2 px-2">
        {filtered.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href)) ||
            (item.activeFor?.some((p) => pathname.startsWith(p)) ?? false);

          const showSection = item.section && item.section !== lastSection;
          if (showSection) lastSection = item.section!;

          return (
            <div key={item.href + item.label}>
              {showSection && (
                <p className="text-white/30 text-[10px] font-semibold uppercase tracking-wider px-3 pt-4 pb-1">
                  {item.section}
                </p>
              )}

              <Link
                href={item.href}
                className={`sidebar-item ${isActive ? "active" : ""}`}
              >
                <span className="text-base w-5 text-center flex-shrink-0">
                  {item.icon}
                </span>

                <span className="flex-1 text-sm truncate">{item.label}</span>

                {item.badge && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[hsl(214,76%,49%)] text-white flex-shrink-0">
                    {item.badge}
                  </span>
                )}
              </Link>
            </div>
          );
        })}
      </nav>

      <div className="px-4 py-3 border-t border-white/10 flex-shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-[hsl(214,76%,49%)] flex items-center justify-center text-xs font-bold flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-white truncate">
              {profile?.full_name || "Benutzer"}
            </p>
            <p className="text-xs text-white/40 truncate">
              {profile?.firma || role}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}

function normalizeRole(role?: string | null): Role {
  if (
    role === "admin" ||
    role === "verwalter" ||
    role === "eigentümer" ||
    role === "dienstleister" ||
    role === "mieter"
  ) {
    return role;
  }
  return "mieter";
}
