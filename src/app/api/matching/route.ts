import { getDatabase, getRequestUser } from "@/lib/db";
import { fail, ok, requireRole } from "@/lib/api";
import { getMatchingSnapshot, runMatchingSync } from "@/lib/matching-sync";
import { toMatchListItem } from "@/lib/view";
import type { SourceCode } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SOURCE_LABELS: Record<SourceCode, string> = {
  DTTOT: "DTTOT",
  DPPSPM: "DPPSPM",
  PEP: "PEP",
  UN_SANCTION: "UN Sanctions",
};

export async function GET() {
  const database = getDatabase();
  const snapshot = getMatchingSnapshot(database);

  const recentJobs = database.screening_jobs
    .slice()
    .sort((a, b) =>
      (b.finished_at ?? b.started_at ?? "").localeCompare(
        a.finished_at ?? a.started_at ?? "",
      ),
    )
    .slice(0, 8)
    .map((job) => {
      const batch = database.batch_uploads.find(
        (item) => item.id === job.batch_id,
      );
      const user = database.users.find(
        (item) => item.id === job.triggered_by_user_id,
      );
      return {
        id: job.id,
        batch_id: job.batch_id,
        batch_number: batch?.batch_number ?? job.batch_id,
        file_name: batch?.original_filename ?? "—",
        status: job.job_status,
        evaluated: job.total_evaluated,
        hits: job.total_hits,
        threshold: job.min_threshold_used,
        started_at: job.started_at,
        finished_at: job.finished_at,
        triggered_by: user?.full_name ?? "Sistem",
      };
    });

  const recentMatches = database.screening_matches
    .slice()
    .sort((a, b) => b.matched_at.localeCompare(a.matched_at))
    .slice(0, 6)
    .map((match) => toMatchListItem(database, match))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .map((item) => ({
      id: item.id,
      score: item.score,
      severity: item.severity,
      matched_at: item.matched_at,
      customer_name: item.customer.full_name,
      customer_cif: item.customer.cif_number,
      entity_name: item.entity.primary_name,
      source_code: item.source.code,
      source_label: SOURCE_LABELS[item.source.code],
      is_whitelisted: item.is_whitelisted,
    }));

  return ok({ snapshot, recentJobs, recentMatches });
}

export async function POST(request: Request) {
  const database = getDatabase();
  const user = getRequestUser(request, database);
  const roleError = requireRole(user.role_code, ["MAKER_ANALYST", "ADMIN"]);
  if (roleError) return roleError;

  try {
    const summary = runMatchingSync(user);
    const refreshed = getDatabase();
    return ok({ summary, snapshot: getMatchingSnapshot(refreshed) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Sinkronisasi gagal dijalankan.";
    return fail(message, 500);
  }
}
