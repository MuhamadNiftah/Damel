import { getDatabase, getRequestUser, mutateDatabase } from "@/lib/db";
import { fail, ok, requireRole } from "@/lib/api";
import { createReport, REPORT_LABELS, reportSummaryRows } from "@/lib/reports";
import { toCaseListItem } from "@/lib/view";
import type { ReportListItem, ReportType } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const database = getDatabase();
  const items: ReportListItem[] = database.regulatory_reports
    .map((report) => {
      const investigation = database.investigation_cases.find(
        (item) => item.id === report.case_id,
      );
      const match = investigation
        ? database.screening_matches.find(
            (item) => item.id === investigation.screening_match_id,
          )
        : undefined;
      const customer = match
        ? database.staged_customers.find(
            (item) => item.id === match.staged_customer_id,
          )
        : undefined;
      const entity = match
        ? database.watchlist_entities.find(
            (item) => item.id === match.watchlist_entity_id,
          )
        : undefined;
      return {
        ...report,
        case_number: investigation?.case_number ?? "—",
        customer_name: customer?.raw_full_name ?? "—",
        entity_name: entity?.primary_name ?? "—",
        score: match?.total_confidence_score ?? 0,
        generated_by_name:
          database.users.find((user) => user.id === report.reported_by_user_id)
            ?.full_name ?? "—",
      };
    })
    .sort((a, b) => b.generated_at.localeCompare(a.generated_at));

  const confirmedCases = database.investigation_cases
    .map((investigation) => {
      const approval = database.approval_requests.find(
        (item) => item.case_id === investigation.id,
      );
      if (approval?.final_verdict !== "CONFIRMED_TERRORIST_HIT") return null;
      const base = toCaseListItem(database, investigation.id);
      if (!base) return null;
      const freeze = database.account_freeze_orders.find(
        (item) => item.case_id === investigation.id,
      );
      return {
        ...base,
        freeze_status: freeze?.freeze_status ?? null,
        balance_frozen: freeze?.total_balance_frozen ?? 0,
        legal_warrant_number: freeze?.legal_warrant_number ?? null,
        existing_reports: database.regulatory_reports
          .filter((item) => item.case_id === investigation.id)
          .map((item) => ({
            id: item.id,
            type: item.report_type,
            status: item.submission_status,
            reference: item.reference_number,
          })),
      };
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  return ok({
    items,
    summaryRows: reportSummaryRows(database),
    labels: REPORT_LABELS,
    confirmedCases,
    metrics: {
      total: items.length,
      drafts: items.filter((item) => item.submission_status === "DRAFT").length,
      ready: items.filter((item) => item.submission_status === "READY_TO_SEND")
        .length,
      submitted: items.filter((item) => item.submission_status === "SUBMITTED")
        .length,
      confirmedCases: confirmedCases.length,
      generatedThisMonth: items.filter((item) =>
        item.generated_at.startsWith(new Date().toISOString().slice(0, 7)),
      ).length,
      frozenBalance: database.account_freeze_orders
        .filter((item) => item.freeze_status === "ACTIVE_FROZEN")
        .reduce((sum, item) => sum + item.total_balance_frozen, 0),
    },
  });
}

export async function POST(request: Request) {
  const database = getDatabase();
  const user = getRequestUser(request, database);
  const roleError = requireRole(user.role_code, [
    "MAKER_ANALYST",
    "CHECKER_SUPERVISOR",
    "APPROVER_HEAD",
  ]);
  if (roleError) return roleError;

  try {
    const body = (await request.json()) as {
      case_id?: string;
      report_type?: ReportType;
    };
    if (!body.case_id || !body.report_type) {
      return fail("Kasus dan jenis laporan wajib dipilih.");
    }
    if (
      !["LTKM_PPATK", "SIPESAT_PEMBLOKIRAN", "BERKALA_OJK"].includes(
        body.report_type,
      )
    ) {
      return fail("Jenis laporan tidak valid.");
    }
    const report = mutateDatabase((db) =>
      createReport(db, body.case_id!, body.report_type!, user),
    );
    return ok(
      {
        report,
        message: `Draft ${REPORT_LABELS[report.report_type]} berhasil dibuat.`,
      },
      201,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal membuat laporan.";
    return fail(message, 422);
  }
}
