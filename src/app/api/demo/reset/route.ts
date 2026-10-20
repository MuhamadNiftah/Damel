import { resetDatabase } from "@/lib/db";
import { ok } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST() {
  resetDatabase();
  return ok({
    message:
      "Data demo berhasil di-reset ke kondisi awal. Seluruh alur dapat diuji ulang.",
  });
}
