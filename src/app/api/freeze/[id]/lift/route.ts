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

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const database = getDatabase();
  const user = getRequestUser(request, database);
  const roleError = requireRole(user.role_code, ["APPROVER_HEAD"]);
  if (roleError) return roleError;

  try {
    const body = (await request.json()) as { reason?: string };
    const reason = body.reason?.trim();
    if (!reason || reason.length < 10) {
      return fail("Alasan pencabutan pemblokiran minimal 10 karakter.");
    }
    const freeze = mutateDatabase((db) => {
      const order = db.account_freeze_orders.find((item) => item.id === id);
      if (!order) throw new Error("Perintah pemblokiran tidak ditemukan.");
      if (order.freeze_status === "LIFTED") {
        throw new Error("Pemblokiran sudah dicabut.");
      }
      order.freeze_status = "LIFTED";
      order.lifted_at = nowIso();
      order.freeze_reason = `${order.freeze_reason}\nPencabutan: ${reason}`;
      appendAudit(db, user, {
        action_name: "LIFT_FREEZE",
        module_name: "CASE_MGMT",
        description: `Mencabut pemblokiran rekening ${order.cif_number}.`,
        state_before: { freeze_status: "ACTIVE_FROZEN" },
        state_after: { freeze_status: "LIFTED", reason },
      });
      return order;
    });
    return ok({ freeze, message: "Pemblokiran rekening berhasil dicabut." });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal mencabut pemblokiran.";
    return fail(message, 422);
  }
}
