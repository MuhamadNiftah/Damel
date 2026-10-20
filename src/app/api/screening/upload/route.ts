import { getDatabase, getRequestUser } from "@/lib/db";
import { fail, ok, requireRole } from "@/lib/api";
import { ingestCustomerFile } from "@/lib/screening";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const database = getDatabase();
  const user = getRequestUser(request, database);
  const roleError = requireRole(user.role_code, [
    "MAKER_ANALYST",
    "CHECKER_SUPERVISOR",
  ]);
  if (roleError) return roleError;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return fail("File nasabah belum dipilih.");
    }
    if (file.size > 50 * 1024 * 1024) {
      return fail("Ukuran file maksimal 50 MB.");
    }
    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!extension || !["xlsx", "xls", "csv"].includes(extension)) {
      return fail("Format file harus .xlsx, .xls, atau .csv.");
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = ingestCustomerFile(buffer, file.name, user);
    return ok(result, 201);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal memproses file nasabah.";
    return fail(message, 422);
  }
}
