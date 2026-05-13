"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { AutomationJobName } from "@/lib/automation/server";

export default function AutomationRunButtons({ job }: { job: AutomationJobName }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function runNow() {
    if (!confirm("Automation jetzt ausführen? Je nach Job können Buchungen, Mahnungen oder E-Mails erzeugt werden.")) {
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/automation/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Automation fehlgeschlagen");
      toast.success(data.message ?? "Automation abgeschlossen");
      router.refresh();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Automation fehlgeschlagen");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      type="button"
      onClick={runNow}
      disabled={loading}
      className="w-full py-2.5 bg-[hsl(214,76%,49%)] text-white text-sm font-semibold rounded-lg disabled:opacity-50 hover:bg-[hsl(214,76%,44%)] transition-colors"
    >
      {loading ? "Wird ausgeführt…" : "Jetzt ausführen"}
    </button>
  );
}
