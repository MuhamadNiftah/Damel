import { getDatabase } from "@/lib/db";
import { asNumber, ok } from "@/lib/api";
import type { AuditLogView } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const database = getDatabase();
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").toLowerCase().trim();
  const moduleFilter = url.searchParams.get("module") ?? "all";
  const actionFilter = url.searchParams.get("action") ?? "all";
  const userFilter = url.searchParams.get("user") ?? "all";
  const page = Math.max(1, asNumber(url.searchParams.get("page"), 1));
  const pageSize = Math.min(100, Math.max(10, asNumber(url.searchParams.get("pageSize"), 20)));

  const all: AuditLogView[] = database.audit_logs
    .map((log) => {
      const user = database.users.find((item) => item.id === log.user_id);
      return {
        ...log,
        user_name: user?.full_name ?? "Sistem",
        user_role: user?.role_code ?? "AUDITOR",
      };
    })
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  const filtered = all.filter((log) => {
    if (moduleFilter !== "all" && log.module_name !== moduleFilter) return false;
    if (actionFilter !== "all" && log.action_name !== actionFilter) return false;
    if (userFilter !== "all" && log.user_id !== userFilter) return false;
    if (query) {
      const haystack = [
        log.description,
        log.action_name,
        log.module_name,
        log.user_name,
        log.ip_address,
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const items = filtered.slice((page - 1) * pageSize, page * pageSize);

  const modules = [...new Set(all.map((log) => log.module_name))].sort();
  const actions = [...new Set(all.map((log) => log.action_name))].sort();

  return ok({
    items,
    total,
    page,
    pageSize,
    pageCount,
    metrics: {
      total: all.length,
      today: all.filter((log) =>
        log.timestamp.startsWith(new Date().toISOString().slice(0, 10)),
      ).length,
      users: new Set(all.map((log) => log.user_id)).size,
      modules: modules.length,
      byModule: modules.map((module) => ({
        module,
        count: all.filter((log) => log.module_name === module).length,
      })),
    },
    options: {
      modules,
      actions,
      users: database.users
        .filter((user) => user.is_active)
        .map((user) => ({
          id: user.id,
          name: user.full_name,
          role: user.role_code,
        })),
    },
  });
}
