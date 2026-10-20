import type { AnalystRecommendation } from "@/lib/types";
import {
  appendAudit,
  getDatabase,
  getRequestUser,
  mutateDatabase,
} from "@/lib/db";
import { fail, ok, requireRole } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RECOMMENDATIONS: AnalystRecommendation[] = [
  "DISMISS_FALSE_POSITIVE",
  "CONFIRM_HIT",
  "ESCALATE_EDD",
];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const database = getDatabase();
  const user = getRequestUser(request, database);
  const roleError = requireRole(user.role_code, ["MAKER_ANALYST"]);
  if (roleError) return roleError;

  try {
    const body = (await request.json()) as {
      recommendation?: AnalystRecommendation;
    };
    if (!body.recommendation || !RECOMMENDATIONS.includes(body.recommendation)) {
      return fail("Rekomendasi tidak valid.");
    }
    const recommendation = body.recommendation;
    const result = mutateDatabase((db) => {
      const investigation = db.investigation_cases.find((item) => item.id === id);
      if (!investigation) throw new Error("Kasus tidak ditemukan.");
      if (investigation.case_status === "CLOSED") {
        throw new Error("Kasus sudah ditutup.");
      }
      if (investigation.case_status === "PENDING_APPROVAL") {
        throw new Error("Kasus sedang menunggu persetujuan.");
      }
      const previous = investigation.analyst_recommendation;
      investigation.analyst_recommendation = recommendation;
      if (investigation.case_status === "OPEN") {
        investigation.case_status = "IN_ANALYSIS";
      }
      appendAudit(db, user, {
        action_name: "UPDATE_RECOMMENDATION",
        module_name: "CASE_MGMT",
        description: `Memperbarui rekomendasi ${investigation.case_number}.`,
        state_before: { recommendation: previous },
        state_after: { recommendation },
      });
      return investigation;
    });
    return ok({ case: result });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal memperbarui rekomendasi.";
    return fail(message, 422);
  }
}
