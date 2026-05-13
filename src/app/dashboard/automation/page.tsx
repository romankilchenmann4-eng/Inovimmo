import { createClient } from "@/lib/supabase/server";
import AutomationRunButtons from "./run-buttons";

const JOBS = [
  {
    id: "monatssoll",
    title: "Monatssoll",
    cadence: "Monatlich am 1. um 05:00 UTC",
    description: "Erzeugt Mietzins- und Nebenkosten-Sollbuchungen für vermietete Wohnungen.",
  },
  {
    id: "mahnungen",
    title: "Mahnwesen",
    cadence: "Täglich um 07:00 UTC",
    description: "Prüft überfällige Sollbuchungen und erstellt Mahnungen mit E-Mail-Versand.",
  },
  {
    id: "vertrag-reminder",
    title: "Vertragsfristen",
    cadence: "Monatlich am 1. um 06:30 UTC",
    description: "Informiert über Mietverträge, die in 30 bis 60 Tagen enden.",
  },
] as const;

type AutomationRun = {
  id: string;
  job_name: string;
  status: "running" | "success" | "failed";
  trigger: "cron" | "manual" | "status";
  started_at: string;
  finished_at: string | null;
  duration_ms: number | null;
  summary_json: Record<string, unknown> | null;
  error_message: string | null;
};

export default async function AutomationPage() {
  const supabase = await createClient();

  const { data: runs, error } = await supabase
    .from("automation_runs")
    .select("id,job_name,status,trigger,started_at,finished_at,duration_ms,summary_json,error_message")
    .order("started_at", { ascending: false })
    .limit(30);

  const typedRuns = (runs ?? []) as AutomationRun[];
  const latestByJob = new Map<string, AutomationRun>();
  for (const run of typedRuns) {
    if (!latestByJob.has(run.job_name)) latestByJob.set(run.job_name, run);
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Automation</h1>
          <p className="text-sm text-gray-500">
            Hintergrundläufe für eine weitgehend selbstständige Immobilienverwaltung.
          </p>
        </div>
        <span className="badge-blue">Vercel Cron aktiv</span>
      </div>

      {error && (
        <div className="info-box-amber text-sm text-amber-800">
          Automation-Logs sind noch nicht verfügbar. Migration <code>009_automation_runs.sql</code> ausführen.
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4">
        {JOBS.map((job) => {
          const latest = latestByJob.get(job.id);
          return (
            <div key={job.id} className="bg-white rounded-xl border border-border shadow-sm p-5 space-y-4">
              <div>
                <div className="flex items-center justify-between gap-2">
                  <h2 className="font-semibold text-gray-900">{job.title}</h2>
                  <StatusBadge status={latest?.status} />
                </div>
                <p className="text-xs text-gray-400 mt-1">{job.cadence}</p>
                <p className="text-sm text-gray-600 mt-3">{job.description}</p>
              </div>

              <div className="border-t border-gray-100 pt-3 text-xs text-gray-500 space-y-1.5">
                <p>
                  Letzter Lauf:{" "}
                  <span className="font-medium text-gray-700">
                    {latest ? formatDate(latest.started_at) : "Noch kein Lauf"}
                  </span>
                </p>
                <p>
                  Dauer:{" "}
                  <span className="font-medium text-gray-700">
                    {latest?.duration_ms ? `${Math.round(latest.duration_ms / 1000)}s` : "–"}
                  </span>
                </p>
                <p>
                  Trigger: <span className="font-medium text-gray-700">{latest?.trigger ?? "–"}</span>
                </p>
              </div>

              {latest?.summary_json && Object.keys(latest.summary_json).length > 0 && (
                <pre className="bg-gray-50 rounded-lg p-3 text-[11px] text-gray-600 overflow-x-auto">
                  {JSON.stringify(latest.summary_json, null, 2)}
                </pre>
              )}

              {latest?.error_message && (
                <div className="text-xs bg-red-50 text-red-700 border border-red-100 rounded-lg p-3">
                  {latest.error_message}
                </div>
              )}

              <AutomationRunButtons job={job.id} />
            </div>
          );
        })}
      </div>

      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Letzte Automationsläufe</h2>
        </div>

        {!typedRuns.length ? (
          <div className="py-12 text-center text-gray-400">
            <p className="text-3xl mb-2">⚙️</p>
            <p className="text-sm">Noch keine Läufe protokolliert.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="table-header">Job</th>
                  <th className="table-header">Status</th>
                  <th className="table-header">Trigger</th>
                  <th className="table-header">Start</th>
                  <th className="table-header">Dauer</th>
                  <th className="table-header">Zusammenfassung</th>
                </tr>
              </thead>
              <tbody>
                {typedRuns.map((run) => (
                  <tr key={run.id} className="table-row">
                    <td className="table-cell font-medium">{labelFor(run.job_name)}</td>
                    <td className="table-cell"><StatusBadge status={run.status} /></td>
                    <td className="table-cell text-sm">{run.trigger}</td>
                    <td className="table-cell text-sm">{formatDate(run.started_at)}</td>
                    <td className="table-cell text-sm">
                      {run.duration_ms ? `${Math.round(run.duration_ms / 1000)}s` : "–"}
                    </td>
                    <td className="table-cell text-xs text-gray-500 max-w-[360px] truncate">
                      {run.error_message || JSON.stringify(run.summary_json ?? {})}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status?: AutomationRun["status"] }) {
  if (status === "success") return <span className="badge-green">Erfolgreich</span>;
  if (status === "failed") return <span className="badge-red">Fehler</span>;
  if (status === "running") return <span className="badge-blue">Läuft</span>;
  return <span className="badge-gray">Noch nie</span>;
}

function formatDate(value: string) {
  return new Date(value).toLocaleString("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function labelFor(jobName: string) {
  return JOBS.find((job) => job.id === jobName)?.title ?? jobName;
}
