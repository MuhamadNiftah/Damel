import type { AccountFreezeOrder, FinalVerdict } from "@/lib/types";
import {
  appendAudit,
  getDatabase,
  getRequestUser,
  mutateDatabase,
  newId,
  nowIso,
} from "@/lib/db";
import { fail, ok } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const database = getDatabase();
  const user = getRequestUser(request, database);

  try {
    const body = (await request.json()) as {
      action?: "APPROVE" | "REJECT";
      decision_reason?: string;
      legal_warrant_number?: string;
      total_balance_frozen?: number;
    };
    if (!body.action || !["APPROVE", "REJECT"].includes(body.action)) {
      return fail("Aksi keputusan tidak valid.");
    }
    const reason = body.decision_reason?.trim();
    if (!reason || reason.length < 10) {
      return fail("Alasan keputusan minimal 10 karakter.");
    }

    const result = mutateDatabase((db) => {
      const approval = db.approval_requests.find((item) => item.id === id);
      if (!approval) throw new Error("Permintaan approval tidak ditemukan.");
      const investigation = db.investigation_cases.find(
        (item) => item.id === approval.case_id,
      );
      if (!investigation) throw new Error("Kasus tidak ditemukan.");
      if (user.id === approval.maker_user_id) {
        throw new Error(
          "Prinsip four-eyes: maker tidak dapat menyetujui pengajuannya sendiri.",
        );
      }
      if (
        approval.current_step === "COMPLETED" ||
        approval.current_step === "REJECTED"
      ) {
        throw new Error("Approval ini sudah selesai diproses.");
      }

      const isCheckerStep = approval.current_step === "CHECKER_REVIEW";
      if (isCheckerStep) {
        if (user.role_code !== "CHECKER_SUPERVISOR" || user.id !== approval.checker_user_id) {
          throw new Error("Tahap ini hanya dapat diputuskan oleh Checker yang ditunjuk.");
        }
      } else {
        if (user.role_code !== "APPROVER_HEAD" || user.id !== approval.approver_user_id) {
          throw new Error("Tahap ini hanya dapat diputuskan oleh Approver yang ditunjuk.");
        }
      }

      if (body.action === "REJECT") {
        approval.current_step = "REJECTED";
        approval.decision_reason = reason;
        approval.decided_at = nowIso();
        approval.final_verdict = null;
        investigation.case_status = "IN_ANALYSIS";
        appendAudit(db, user, {
          action_name: isCheckerStep ? "CHECKER_REJECT" : "APPROVER_REJECT",
          module_name: "CASE_MGMT",
          description: `Menolak approval ${investigation.case_number} pada tahap ${isCheckerStep ? "Checker" : "Approver"}.`,
          state_before: { current_step: isCheckerStep ? "CHECKER_REVIEW" : "APPROVER_SIGN_OFF" },
          state_after: { current_step: "REJECTED", reason },
        });
        return {
          approval,
          case: investigation,
          freeze: null,
          message: "Approval ditolak dan kasus dikembalikan ke analis.",
        };
      }

      if (isCheckerStep) {
        approval.current_step = "APPROVER_SIGN_OFF";
        approval.decision_reason = reason;
        appendAudit(db, user, {
          action_name: "CHECKER_APPROVE",
          module_name: "CASE_MGMT",
          description: `Checker menyetujui kelengkapan bukti ${investigation.case_number}.`,
          state_before: { current_step: "CHECKER_REVIEW" },
          state_after: { current_step: "APPROVER_SIGN_OFF", reason },
        });
        return {
          approval,
          case: investigation,
          freeze: null,
          message: "Checker menyetujui. Diteruskan ke Approver.",
        };
      }

      const recommendation = investigation.analyst_recommendation;
      const verdict: FinalVerdict =
        recommendation === "DISMISS_FALSE_POSITIVE"
          ? "FALSE_POSITIVE_CLEAR"
          : "CONFIRMED_TERRORIST_HIT";
      approval.current_step = "COMPLETED";
      approval.final_verdict = verdict;
      approval.decision_reason = reason;
      approval.decided_at = nowIso();
      investigation.case_status = "CLOSED";
      investigation.closed_at = nowIso();

      let freeze: AccountFreezeOrder | null = null;
      if (verdict === "CONFIRMED_TERRORIST_HIT") {
        const match = db.screening_matches.find(
          (item) => item.id === investigation.screening_match_id,
        );
        const customer = match
          ? db.staged_customers.find(
              (item) => item.id === match.staged_customer_id,
            )
          : undefined;
        if (!customer) throw new Error("Data rekening nasabah tidak ditemukan.");
        const existingFreeze = db.account_freeze_orders.find(
          (item) => item.case_id === investigation.id && item.freeze_status === "ACTIVE_FROZEN",
        );
        if (!existingFreeze) {
          const date = new Date();
          freeze = {
            id: newId("freeze"),
            case_id: investigation.id,
            cif_number: customer.cif_number,
            account_number: customer.account_number,
            legal_warrant_number:
              body.legal_warrant_number?.trim() ||
              `SPRIN/DMB/${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, "0")}/${String(db.account_freeze_orders.length + 1).padStart(3, "0")}`,
            total_balance_frozen:
              Number(body.total_balance_frozen) > 0
                ? Number(body.total_balance_frozen)
                : 0,
            freeze_status: "ACTIVE_FROZEN",
            frozen_at: nowIso(),
            lifted_at: null,
            freeze_reason:
              "Confirmed hit DTTOT — pemblokiran serta-merta berdasarkan keputusan Approver.",
          };
          db.account_freeze_orders.push(freeze);
          appendAudit(db, user, {
            action_name: "APPROVE_FREEZE",
            module_name: "CASE_MGMT",
            description: `Menerbitkan pemblokiran rekening ${customer.cif_number}.`,
            state_before: { freeze_status: null },
            state_after: {
              freeze_status: "ACTIVE_FROZEN",
              legal_warrant_number: freeze.legal_warrant_number,
              total_balance_frozen: freeze.total_balance_frozen,
            },
          });
        }
      } else {
        const match = db.screening_matches.find(
          (item) => item.id === investigation.screening_match_id,
        );
        if (match) {
          match.is_whitelisted = true;
          const customer = db.staged_customers.find(
            (item) => item.id === match.staged_customer_id,
          );
          const existing = db.whitelist_records.find(
            (item) =>
              item.entity_id === match.watchlist_entity_id &&
              (!customer || item.customer_cif === customer.cif_number),
          );
          if (!existing) {
            db.whitelist_records.push({
              id: newId("whitelist"),
              entity_id: match.watchlist_entity_id,
              customer_cif: customer?.cif_number ?? "—",
              reason: `False positive disetujui melalui ${investigation.case_number}. ${reason}`,
              approved_by_user_id: user.id,
              whitelisted_at: nowIso(),
            });
          }
        }
      }

      appendAudit(db, user, {
        action_name: "FINAL_APPROVAL",
        module_name: "CASE_MGMT",
        description: `Approver menetapkan ${verdict} untuk ${investigation.case_number}.`,
        state_before: { current_step: "APPROVER_SIGN_OFF", case_status: "PENDING_APPROVAL" },
        state_after: {
          current_step: "COMPLETED",
          verdict,
          case_status: "CLOSED",
          freeze_created: Boolean(freeze),
        },
      });

      return {
        approval,
        case: investigation,
        freeze,
        message:
          verdict === "CONFIRMED_TERRORIST_HIT"
            ? "Confirmed Hit disetujui. Perintah pemblokiran rekening telah diterbitkan."
            : "Kasus ditutup sebagai false positive dan nasabah masuk whitelist.",
      };
    });

    return ok(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal memproses keputusan.";
    return fail(message, 422);
  }
}
