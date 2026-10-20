import type { ApprovalRequest } from "@/lib/types";
import {
  appendAudit,
  getDatabase,
  getRequestUser,
  mutateDatabase,
  newId,
  nowIso,
} from "@/lib/db";
import { fail, ok, requireRole } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const database = getDatabase();
  const user = getRequestUser(request, database);
  const roleError = requireRole(user.role_code, ["MAKER_ANALYST"]);
  if (roleError) return roleError;

  try {
    const body = (await request.json().catch(() => ({}))) as {
      decision_reason?: string;
    };
    const reason =
      body.decision_reason?.trim() ||
      "Pengajuan maker-checker setelah analisis dan kelengkapan bukti.";

    const approval = mutateDatabase((db) => {
      const investigation = db.investigation_cases.find((item) => item.id === id);
      if (!investigation) throw new Error("Kasus tidak ditemukan.");
      if (investigation.assigned_analyst_id !== user.id) {
        throw new Error("Hanya analis yang ditugaskan dapat mengajukan kasus ini.");
      }
      if (investigation.case_status === "CLOSED") {
        throw new Error("Kasus sudah ditutup.");
      }
      if (investigation.case_status === "PENDING_APPROVAL") {
        throw new Error("Kasus sudah dalam proses persetujuan.");
      }
      if (!investigation.analyst_recommendation) {
        throw new Error("Rekomendasi analis wajib diisi sebelum pengajuan.");
      }
      const activeApproval = db.approval_requests.find(
        (item) =>
          item.case_id === id &&
          (item.current_step === "CHECKER_REVIEW" ||
            item.current_step === "APPROVER_SIGN_OFF"),
      );
      if (activeApproval) {
        throw new Error("Sudah ada approval aktif untuk kasus ini.");
      }

      const checker = db.users.find(
        (item) => item.role_code === "CHECKER_SUPERVISOR" && item.is_active,
      );
      const approver = db.users.find(
        (item) => item.role_code === "APPROVER_HEAD" && item.is_active,
      );
      if (!checker || !approver) {
        throw new Error("Konfigurasi pejabat checker/approver belum lengkap.");
      }

      const record: ApprovalRequest = {
        id: newId("approval"),
        case_id: id,
        maker_user_id: user.id,
        checker_user_id: checker.id,
        approver_user_id: approver.id,
        current_step: "CHECKER_REVIEW",
        final_verdict: null,
        decision_reason: reason,
        submitted_at: nowIso(),
        decided_at: null,
      };
      db.approval_requests.push(record);
      const previousStatus = investigation.case_status;
      investigation.case_status = "PENDING_APPROVAL";
      appendAudit(db, user, {
        action_name: "SUBMIT_APPROVAL",
        module_name: "CASE_MGMT",
        description: `Mengajukan approval maker-checker untuk ${investigation.case_number}.`,
        state_before: { case_status: previousStatus },
        state_after: {
          case_status: "PENDING_APPROVAL",
          step: "CHECKER_REVIEW",
          checker: checker.full_name,
          approver: approver.full_name,
        },
      });
      return {
        ...record,
        maker_name: user.full_name,
        checker_name: checker.full_name,
        approver_name: approver.full_name,
      };
    });

    return ok({ approval }, 201);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal mengajukan approval.";
    return fail(message, 422);
  }
}
