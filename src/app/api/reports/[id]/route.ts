import {
  appendAudit,
  getDatabase,
  getRequestUser,
  mutateDatabase,
  nowIso,
} from "@/lib/db";
import { fail, ok, requireRole } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const database = getDatabase();
  const user = getRequestUser(request, database);

  try {
    const body = (await request.json()) as {
      action?: "MARK_READY" | "SUBMIT";
    };
    if (!body.action || !["MARK_READY", "SUBMIT"].includes(body.action)) {
      return fail("Aksi laporan tidak valid.");
    }
    if (body.action === "SUBMIT") {
      const roleError = requireRole(user.role_code, ["APPROVER_HEAD"]);
      if (roleError) return roleError;
    } else {
      const roleError = requireRole(user.role_code, [
        "MAKER_ANALYST",
        "CHECKER_SUPERVISOR",
        "APPROVER_HEAD",
      ]);
      if (roleError) return roleError;
    }

    const report = mutateDatabase((db) => {
      const record = db.regulatory_reports.find((item) => item.id === id);
      if (!record) throw new Error("Laporan tidak ditemukan.");
      if (record.submission_status === "SUBMITTED") {
        throw new Error("Laporan sudah dikirim.");
      }
      if (body.action === "MARK_READY") {
        if (record.submission_status !== "DRAFT") {
          throw new Error("Hanya draft yang dapat ditandai siap kirim.");
        }
        record.submission_status = "READY_TO_SEND";
        appendAudit(db, user, {
          action_name: "MARK_REPORT_READY",
          module_name: "REPORTING",
          description: `Menandai laporan ${record.reference_number} siap dikirim.`,
          state_before: { status: "DRAFT" },
          state_after: { status: "READY_TO_SEND" },
        });
      } else {
        if (record.submission_status !== "READY_TO_SEND") {
          throw new Error("Laporan harus berstatus siap kirim sebelum submit.");
        }
        record.submission_status = "SUBMITTED";
        record.submitted_at = nowIso();
        appendAudit(db, user, {
          action_name: "SUBMIT_REPORT",
          module_name: "REPORTING",
          description: `Mengirim laporan ${record.reference_number} ke regulator.`,
          state_before: { status: "READY_TO_SEND" },
          state_after: { status: "SUBMITTED", submitted_at: record.submitted_at },
        });
      }
      return record;
    });

    return ok({
      report,
      message:
        body.action === "SUBMIT"
          ? "Laporan ditandai telah dikirim ke regulator."
          : "Laporan siap dikirim.",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal memperbarui laporan.";
    return fail(message, 422);
  }
}
