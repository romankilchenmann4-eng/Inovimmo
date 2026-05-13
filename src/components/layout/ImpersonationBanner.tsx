"use client";

import { useRouter } from "next/navigation";
import type { Profile } from "@/types";

export default function ImpersonationBanner({ profile }: { profile: Profile | null }) {
  const router = useRouter();

  async function endImpersonation() {
    await fetch("/api/admin/impersonate", { method: "DELETE" });
    router.push("/dashboard/admin/benutzer");
    router.refresh();
  }

  return (
    <div className="impersonation-banner">
      <span className="text-lg">👁</span>
      <span>
        Du siehst die App als{" "}
        <strong>{profile?.full_name ?? "Benutzer"}</strong>
        {" "}· Rolle: <strong>{profile?.role}</strong>
      </span>
      <button
        onClick={endImpersonation}
        className="ml-auto text-white border border-white/40 hover:bg-white/20 px-3 py-1 rounded-lg text-xs font-semibold transition-colors"
      >
        × Beenden
      </button>
    </div>
  );
}
