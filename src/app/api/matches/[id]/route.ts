import { appendAudit, getDatabase, getRequestUser } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { toMatchDetail } from "@/lib/view";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const database = getDatabase();
  const match = database.screening_matches.find((item) => item.id === id);
  if (!match) return fail("Hasil screening tidak ditemukan.", 404);
  const detail = toMatchDetail(database, match);
  if (!detail) return fail("Data pendukung match tidak lengkap.", 422);
  const user = getRequestUser(request, database);
  appendAudit(database, user, {
    action_name: "VIEW_MATCH",
    module_name: "SCREENING",
    description: `Membuka detail hasil screening ${match.id}.`,
    state_before: null,
    state_after: { match_id: match.id, score: match.total_confidence_score },
  });
  return ok({ match: detail });
}
