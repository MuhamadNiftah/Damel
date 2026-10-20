import { getDatabase } from "@/lib/db";
import { ok } from "@/lib/api";
import { toApprovalListItem, toCaseListItem } from "@/lib/view";
import type { CaseListItem, CaseStatus } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const database = getDatabase();
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").toLowerCase().trim();
  const status = url.searchParams.get("status") ?? "all";

  const allCases = database.investigation_cases
    .map((item) => toCaseListItem(database, item.id))
    .filter((item): item is CaseListItem => Boolean(item));

  const cases = allCases
    .filter((item) => {
      if (status !== "all" && item.status !== status) return false;
      if (query) {
        const haystack = [
          item.case_number,
          item.customer_name,
          item.customer_cif,
          item.entity_name,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    })
    .sort((a, b) => {
      const priority = Number(b.priority === "HIGH") - Number(a.priority === "HIGH");
      if (priority !== 0) return priority;
      return b.opened_at.localeCompare(a.opened_at);
    });

  const approvals = database.approval_requests
    .map((item) => toApprovalListItem(database, item.id))
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((a, b) => b.submitted_at.localeCompare(a.submitted_at));

  const freezes = database.account_freeze_orders
    .map((freeze) => {
      const investigation = database.investigation_cases.find(
        (item) => item.id === freeze.case_id,
      );
      const customer = database.staged_customers.find(
        (item) => item.cif_number === freeze.cif_number,
      );
      return {
        ...freeze,
        account_number: `•••• •••• ${freeze.account_number.slice(-4)}`,
        case_number: investigation?.case_number ?? "—",
        customer_name: customer?.raw_full_name ?? "—",
      };
    })
    .sort((a, b) => b.frozen_at.localeCompare(a.frozen_at));

  const statusOrder: CaseStatus[] = [
    "OPEN",
    "IN_ANALYSIS",
    "PENDING_APPROVAL",
    "CLOSED",
  ];

  return ok({
    cases,
    approvals,
    freezes,
    metrics: {
      total: allCases.length,
      open: allCases.filter((item) => item.status !== "CLOSED").length,
      pendingApproval: allCases.filter(
        (item) => item.status === "PENDING_APPROVAL",
      ).length,
      confirmed: approvals.filter(
        (item) => item.final_verdict === "CONFIRMED_TERRORIST_HIT",
      ).length,
      falsePositive: approvals.filter(
        (item) => item.final_verdict === "FALSE_POSITIVE_CLEAR",
      ).length,
      frozenAccounts: freezes.filter(
        (item) => item.freeze_status === "ACTIVE_FROZEN",
      ).length,
      frozenBalance: freezes
        .filter((item) => item.freeze_status === "ACTIVE_FROZEN")
        .reduce((sum, item) => sum + item.total_balance_frozen, 0),
      pipeline: statusOrder.map((stage) => ({
        stage,
        count: allCases.filter((item) => item.status === stage).length,
      })),
    },
    users: database.users
      .filter((user) => user.is_active)
      .map((user) => ({
        id: user.id,
        full_name: user.full_name,
        role_code: user.role_code,
        branch_code: user.branch_code,
      })),
  });
}
