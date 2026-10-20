import { getDatabase } from "@/lib/db";
import { fail, ok, requireRole } from "@/lib/api";
import { getRequestUser } from "@/lib/db";
import { ingestWatchlistFile } from "@/lib/watchlist-import";
import type { SourceCode } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const database = getDatabase();
  const user = getRequestUser(request, database);
  const roleError = requireRole(user.role_code, [
    "MAKER_ANALYST",
    "CHECKER_SUPERVISOR",
    "APPROVER_HEAD",
    "ADMIN",
  ]);
  if (roleError) return roleError;

  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return fail("File Excel watchlist belum dipilih.");
    }
    const sourceCode = String(formData.get("sourceCode") ?? "DTTOT") as SourceCode;
    const versionLabel = String(
      formData.get("versionLabel") ?? file.name.replace(/\.[^.]+$/, ""),
    );
    const publishedBy = String(formData.get("publishedBy") ?? "PPATK");
    const effectiveDate = String(formData.get("effectiveDate") ?? "");
    const expiryDate = String(formData.get("expiryDate") ?? "");
    const legalBasis = String(formData.get("legalBasis") ?? "");
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = ingestWatchlistFile({
      buffer,
      filename: file.name,
      user,
      sourceCode,
      versionLabel,
      publishedBy,
      effectiveDate,
      expiryDate,
      legalBasis,
    });
    return ok(result, 201);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal mengimpor watchlist.";
    return fail(message, 422);
  }
}
