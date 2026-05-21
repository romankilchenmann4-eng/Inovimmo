import { NextRequest } from "next/server";
import { createClient as createSupabaseClient, type SupabaseClient } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { timingSafeEqual } from "crypto";

export type AutomationJobName = "monatssoll" | "mahnungen" | "vertrag-reminder" | "nk-abrechnung";
export type AutomationTrigger = "cron" | "manual" | "status";

export function getAutomationAdminClient(): SupabaseClient {
  return createAdminClient();
}

export function isCronAuthorized(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  const auth = req.headers.get("authorization");
  const token = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return false;
  try {
    return timingSafeEqual(Buffer.from(token), Buffer.from(secret));
  } catch {
    return false;
  }
}

export async function startAutomationRun(
  supabase: SupabaseClient,
  jobName: AutomationJobName,
  trigger: AutomationTrigger,
  triggeredBy?: string | null
) {
  const startedAt = new Date();
  const { data, error } = await supabase
    .from("automation_runs")
    .insert({
      job_name: jobName,
      status: "running",
      trigger,
      started_at: startedAt.toISOString(),
      triggered_by: triggeredBy ?? null,
    })
    .select("id,started_at")
    .single();

  if (error) {
    console.error("automation_runs insert failed:", error.message);
    return { id: null as string | null, startedAt };
  }

  return { id: data.id as string, startedAt: new Date(data.started_at as string) };
}

export async function finishAutomationRun(
  supabase: SupabaseClient,
  run: { id: string | null; startedAt: Date },
  status: "success" | "failed",
  summary: Record<string, unknown>,
  errorMessage?: string
) {
  if (!run.id) return;

  const finishedAt = new Date();
  const durationMs = finishedAt.getTime() - run.startedAt.getTime();

  const { error } = await supabase
    .from("automation_runs")
    .update({
      status,
      finished_at: finishedAt.toISOString(),
      duration_ms: durationMs,
      summary_json: summary,
      error_message: errorMessage ?? null,
    })
    .eq("id", run.id);

  if (error) {
    console.error("automation_runs update failed:", error.message);
  }
}

export function getAutomationTrigger(req: NextRequest): AutomationTrigger {
  return req.headers.get("x-inovimmo-trigger") === "manual" ? "manual" : "cron";
}
