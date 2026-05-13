"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export default function ImpersonateButton({ userId, userName }: { userId: string; userName: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function startImpersonation() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/impersonate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        toast.error(error ?? "Fehler");
        return;
      }
      toast.success(`Ansicht als "${userName}" gestartet`);
      router.push("/dashboard");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={startImpersonation}
      disabled={loading}
      className="text-xs px-3 py-1.5 rounded-lg bg-[hsl(214,100%,97%)] text-[hsl(214,76%,49%)] font-semibold hover:bg-[hsl(214,76%,49%)] hover:text-white transition-colors disabled:opacity-50"
    >
      {loading ? "…" : "👁 Anzeigen als"}
    </button>
  );
}
