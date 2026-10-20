import { getDatabase } from "@/lib/db";
import { ok } from "@/lib/api";
import { toMatchListItem } from "@/lib/view";
import { getCustomerMetrics } from "@/lib/customers";
import type {
  CaseStatus,
  DashboardData,
  SourceCode,
} from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SOURCE_LABELS: Record<SourceCode, string> = {
  DTTOT: "DTTOT",
  DPPSPM: "DPPSPM",
  PEP: "PEP",
  UN_SANCTION: "UN Sanctions",
};

export async function GET() {
  const database = getDatabase();
  const totalScreened = database.batch_uploads
    .filter((batch) => batch.upload_status === "PROCESSED")
    .reduce((sum, batch) => sum + batch.valid_records, 0);
  const hitCustomerIds = new Set(
    database.screening_matches.map((match) => match.staged_customer_id),
  );
  const activeMatches = database.screening_matches.filter(
    (match) => !match.is_whitelisted,
  );
  const suspect = activeMatches.filter(
    (match) =>
      match.match_severity === "CRITICAL" || match.match_severity === "HIGH",
  ).length;
  const potential = activeMatches.filter(
    (match) => match.match_severity === "MEDIUM",
  ).length;
  const openCases = database.investigation_cases.filter(
    (item) => item.case_status !== "CLOSED",
  ).length;
  const activeFreeze = database.account_freeze_orders.filter(
    (freeze) => freeze.freeze_status === "ACTIVE_FROZEN",
  );
  const customerMetrics = getCustomerMetrics(database);
  const dttotSourceIds = new Set(
    database.watchlist_sources
      .filter((source) => source.source_code === "DTTOT")
      .map((source) => source.id),
  );
  const apupptSourceIds = new Set(
    database.watchlist_sources
      .filter((source) => source.source_code !== "DTTOT")
      .map((source) => source.id),
  );
  const dttotEntities = database.watchlist_entities.filter((entity) =>
    dttotSourceIds.has(entity.source_id),
  ).length;
  const apupptEntities = database.watchlist_entities.filter((entity) =>
    apupptSourceIds.has(entity.source_id),
  ).length;
  const lastCompletedJob = database.screening_jobs
    .filter((job) => job.job_status === "COMPLETED")
    .sort((a, b) =>
      (b.finished_at ?? b.started_at ?? "").localeCompare(
        a.finished_at ?? a.started_at ?? "",
      ),
    )[0];

  const recentMatches = [...database.screening_matches]
    .sort((a, b) => b.total_confidence_score - a.total_confidence_score)
    .slice(0, 6)
    .map((match) => toMatchListItem(database, match))
    .filter((item): item is NonNullable<typeof item> => Boolean(item));

  const sourceCoverage = database.watchlist_sources
    .filter((source) => source.is_current)
    .map((source) => ({
      code: source.source_code,
      label: SOURCE_LABELS[source.source_code],
      entities: database.watchlist_entities.filter(
        (entity) => entity.source_id === source.id,
      ).length,
      version: source.version_label,
      effective_date: source.effective_date,
    }))
    .sort((a, b) => b.entities - a.entities);

  const caseStatusOrder: CaseStatus[] = [
    "OPEN",
    "IN_ANALYSIS",
    "PENDING_APPROVAL",
    "CLOSED",
  ];
  const pipelineColors: Record<CaseStatus, string> = {
    OPEN: "#e2a53b",
    IN_ANALYSIS: "#3b82f6",
    PENDING_APPROVAL: "#8b5cf6",
    CLOSED: "#10b981",
  };

  const now = new Date();
  const trendValues = [23, 31, 19, 42, 35, 28, 48];
  const trendHits = [1, 2, 1, 3, 2, 1, Math.max(suspect, 1)];
  const trend = trendValues.map((value, index) => {
    const date = new Date(now);
    date.setDate(now.getDate() - (trendValues.length - 1 - index));
    return {
      date: new Intl.DateTimeFormat("id-ID", {
        day: "2-digit",
        month: "short",
      }).format(date),
      screened: value,
      hits: trendHits[index],
    };
  });

  const data: DashboardData = {
    metrics: {
      totalScreened,
      clean: Math.max(totalScreened - hitCustomerIds.size, 0),
      potential,
      suspect,
      totalHits: database.screening_matches.length,
      openCases,
      frozenAccounts: activeFreeze.length,
      frozenBalance: activeFreeze.reduce(
        (sum, freeze) => sum + freeze.total_balance_frozen,
        0,
      ),
    },
    severityDistribution: [
      {
        name: "Critical",
        value: activeMatches.filter(
          (match) => match.match_severity === "CRITICAL",
        ).length,
        color: "#dc2626",
      },
      {
        name: "High",
        value: activeMatches.filter((match) => match.match_severity === "HIGH")
          .length,
        color: "#ea580c",
      },
      {
        name: "Medium",
        value: activeMatches.filter(
          (match) => match.match_severity === "MEDIUM",
        ).length,
        color: "#d97706",
      },
      {
        name: "Whitelisted",
        value: database.screening_matches.filter(
          (match) => match.is_whitelisted,
        ).length,
        color: "#94a3b8",
      },
    ],
    trend,
    recentMatches,
    sourceCoverage,
    casePipeline: caseStatusOrder.map((stage) => ({
      stage,
      count: database.investigation_cases.filter(
        (item) => item.case_status === stage,
      ).length,
      color: pipelineColors[stage],
    })),
    dataUniverse: {
      customers: customerMetrics.total,
      activeCustomers: customerMetrics.active,
      dttotEntities,
      apupptEntities,
      dttotSources: database.watchlist_sources.filter(
        (source) => source.source_code === "DTTOT" && source.is_current,
      ).length,
      apupptSources: database.watchlist_sources.filter(
        (source) => source.source_code !== "DTTOT" && source.is_current,
      ).length,
      averageQuality: customerMetrics.averageQuality,
      lastSyncAt:
        lastCompletedJob?.finished_at ?? lastCompletedJob?.started_at ?? null,
    },
    lastUpdated: new Date().toISOString(),
  };

  return ok(data);
}
