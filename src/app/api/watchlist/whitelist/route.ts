import { appendAudit, getDatabase, getRequestUser, mutateDatabase, newId, nowIso } from "@/lib/db";
import { fail, ok, requireRole } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const database = getDatabase();
  const user = getRequestUser(request, database);
  const roleError = requireRole(user.role_code, ["APPROVER_HEAD"]);
  if (roleError) return roleError;

  try {
    const body = (await request.json()) as {
      entity_id?: string;
      customer_cif?: string;
      reason?: string;
    };
    const entityId = body.entity_id?.trim();
    const customerCif = body.customer_cif?.trim();
    const reason = body.reason?.trim();

    if (!entityId || !customerCif || !reason) {
      return fail("Entitas, CIF nasabah, dan alasan whitelist wajib diisi.");
    }
    if (reason.length < 20) {
      return fail("Alasan whitelist minimal 20 karakter.");
    }

    const result = mutateDatabase((db) => {
      const entity = db.watchlist_entities.find((item) => item.id === entityId);
      const customer = db.staged_customers.find(
        (item) => item.cif_number === customerCif,
      );
      if (!entity || !customer) {
        throw new Error("Entitas watchlist atau nasabah tidak ditemukan.");
      }
      const duplicate = db.whitelist_records.find(
        (item) =>
          item.entity_id === entityId && item.customer_cif === customerCif,
      );
      if (duplicate) {
        throw new Error("Pasangan entitas dan nasabah ini sudah di-whitelist.");
      }
      const record = {
        id: newId("whitelist"),
        entity_id: entityId,
        customer_cif: customerCif,
        reason,
        approved_by_user_id: user.id,
        whitelisted_at: nowIso(),
      };
      db.whitelist_records.push(record);
      for (const match of db.screening_matches) {
        if (
          match.watchlist_entity_id === entityId &&
          db.staged_customers.find(
            (item) =>
              item.id === match.staged_customer_id &&
              item.cif_number === customerCif,
          )
        ) {
          match.is_whitelisted = true;
        }
      }
      appendAudit(db, user, {
        action_name: "APPROVE_WHITELIST",
        module_name: "WATCHLIST",
        description: `Whitelist false positive untuk ${customer.raw_full_name} terhadap ${entity.primary_name}.`,
        state_before: { is_whitelisted: false },
        state_after: {
          is_whitelisted: true,
          entity_id: entityId,
          customer_cif: customerCif,
          reason,
        },
      });
      return record;
    });

    return ok({ record: result, message: "Whitelist berhasil disetujui." }, 201);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal menyimpan whitelist.";
    return fail(message, 422);
  }
}
