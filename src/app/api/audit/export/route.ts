import { appendAudit, getDatabase, getRequestUser, saveDatabase } from "@/lib/db";
import { createWorkbook } from "@/lib/excel";
import { formatDateTimeId } from "@/lib/normalize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const database = getDatabase();
  const user = getRequestUser(request, database);
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").toLowerCase().trim();
  const moduleFilter = url.searchParams.get("module") ?? "all";
  const actionFilter = url.searchParams.get("action") ?? "all";
  const userFilter = url.searchParams.get("user") ?? "all";

  const logs = database.audit_logs
    .slice()
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .filter((log) => {
      if (moduleFilter !== "all" && log.module_name !== moduleFilter) return false;
      if (actionFilter !== "all" && log.action_name !== actionFilter) return false;
      if (userFilter !== "all" && log.user_id !== userFilter) return false;
      if (query) {
        const haystack = [
          log.description,
          log.action_name,
          log.module_name,
          log.ip_address,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    });

  const rows = logs.map((log) => {
    const actor = database.users.find((item) => item.id === log.user_id);
    const role = actor?.role_code ?? "SYSTEM";
    return {
      Waktu: formatDateTimeId(log.timestamp),
      Pengguna: actor?.full_name ?? "Sistem",
      Role: role,
      Modul: log.module_name,
      Aksi: log.action_name,
      Deskripsi: log.description,
      IP: log.ip_address,
      "User Agent": log.user_agent,
      "State Before": log.state_before ? JSON.stringify(log.state_before) : "—",
      "State After": log.state_after ? JSON.stringify(log.state_after) : "—",
      "Log ID": log.id,
    };
  });

  const buffer = createWorkbook([
    { name: "Audit Trail", rows },
    {
      name: "Metadata",
      rows: [
        {
          Dokumen: "Audit Trail APU-PPT & DTTOT",
          Institusi: "PT DIDI MAX BERJANGKA",
          "Kode Dokumen": "DMB-ERD-DaMeL-IT-2410",
          "Dibuat Oleh": user.full_name,
          "Dibuat Pada": formatDateTimeId(new Date().toISOString()),
          "Jumlah Baris": rows.length,
          "Filter Modul": moduleFilter,
          "Filter Aksi": actionFilter,
          "Filter Pengguna": userFilter,
          "Kata Kunci": query || "—",
          Retensi: "WORM — tidak dapat diubah / dihapus",
        },
      ],
    },
  ]);

  appendAudit(database, user, {
    action_name: "EXPORT_AUDIT_TRAIL",
    module_name: "AUDIT",
    description: `Mengekspor ${rows.length} baris audit trail ke Excel.`,
    state_before: null,
    state_after: {
      export_type: "XLSX",
      rows: rows.length,
      filters: {
        module: moduleFilter,
        action: actionFilter,
        user: userFilter,
        query: query || null,
      },
    },
  });
  saveDatabase(database);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Audit_Trail_DMB_${new Date().toISOString().slice(0, 10)}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
