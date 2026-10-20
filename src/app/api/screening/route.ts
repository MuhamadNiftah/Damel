import { getDatabase } from "@/lib/db";
import { ok } from "@/lib/api";
import { toBatchListItem } from "@/lib/screening-view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const database = getDatabase();
  const batches = database.batch_uploads
    .map((batch) => toBatchListItem(database, batch))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
  const jobs = database.screening_jobs
    .slice()
    .sort((a, b) => (b.started_at ?? "").localeCompare(a.started_at ?? ""))
    .slice(0, 8);
  const totalRecords = batches.reduce((sum, batch) => sum + batch.total_records, 0);
  const validRecords = batches.reduce((sum, batch) => sum + batch.valid_records, 0);
  const errorRecords = batches.reduce((sum, batch) => sum + batch.error_records, 0);

  return ok({
    batches,
    jobs,
    metrics: {
      totalBatches: batches.length,
      totalRecords,
      validRecords,
      errorRecords,
      totalHits: database.screening_matches.length,
      threshold: 70,
      lastScreened: batches[0]?.completed_at ?? null,
    },
  });
}
