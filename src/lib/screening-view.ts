import type { BatchUpload, DatabaseSchema } from "@/lib/types";
import { getBatchHits } from "@/lib/view";

export interface BatchView {
  id: string;
  batch_number: string;
  original_filename: string;
  total_records: number;
  valid_records: number;
  error_records: number;
  upload_status: BatchUpload["upload_status"];
  uploaded_by_user_id: string;
  created_at: string;
  completed_at: string | null;
  uploader_name: string;
  hits: number;
  job_status: string | null;
  job_id: string | null;
}

export function toBatchListItem(
  database: DatabaseSchema,
  batch: BatchUpload,
): BatchView {
  const job = database.screening_jobs.find((item) => item.batch_id === batch.id);
  return {
    ...batch,
    uploader_name:
      database.users.find((user) => user.id === batch.uploaded_by_user_id)
        ?.full_name ?? "—",
    hits: getBatchHits(database, batch.id),
    job_status: job?.job_status ?? null,
    job_id: job?.id ?? null,
  };
}
