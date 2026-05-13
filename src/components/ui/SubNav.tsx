"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type SubNavItem = { href: string; label: string };

export default function SubNav({ items }: { items: SubNavItem[] }) {
  const pathname = usePathname();

  return (
    <div className="flex gap-1 border-b border-white/10 mb-6 -mt-2">
      {items.map(item => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              active
                ? "border-[hsl(214,76%,49%)] text-white"
                : "border-transparent text-white/50 hover:text-white/80"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </div>
  );
}
