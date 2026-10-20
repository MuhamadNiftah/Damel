import { getDatabase } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { toBatchListItem } from "@/lib/screening-view";
import { maskAccount, maskNIK } from "@/lib/crypto";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const database = getDatabase();
  const batch = database.batch_uploads.find((item) => item.id === id);
  if (!batch) return fail("Batch tidak ditemukan.", 404);
  const job = database.screening_jobs.find((item) => item.batch_id === id);
  const errors = database.upload_errors
    .filter((item) => item.batch_id === id)
    .slice(0, 100)
    .map((item) => ({
      id: item.id,
      row_number: item.row_number,
      column_name: item.column_name,
      error_reason: item.error_reason,
    }));
  const customers = database.staged_customers
    .filter((item) => item.batch_id === id)
    .slice(0, 100)
    .map((item) => ({
      id: item.id,
      cif_number: item.cif_number,
      account_number_masked: maskAccount(item.account_number),
      full_name: item.raw_full_name,
      national_id_masked: maskNIK(item.national_id_number),
      date_of_birth: item.date_of_birth,
      customer_type: item.customer_type,
    }));
  return ok({
    batch: toBatchListItem(database, batch),
    job: job ?? null,
    errors,
    customers,
  });
}
