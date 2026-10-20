import { getDatabase } from "@/lib/db";
import { ok } from "@/lib/api";
import { getCustomerMetrics, toCustomerListItem } from "@/lib/customers";
import type { CustomerQuality } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RISK_RANK: Record<string, number> = { HIGH: 3, MEDIUM: 2, LOW: 1 };
const SEVERITY_RANK: Record<string, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

export async function GET(request: Request) {
  const database = getDatabase();
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").toLowerCase().trim();
  const risk = url.searchParams.get("risk") ?? "";
  const status = url.searchParams.get("status") ?? "";
  const grade = url.searchParams.get("grade") ?? "";
  const severity = url.searchParams.get("severity") ?? "";
  const limit = Math.min(200, Math.max(1, Number(url.searchParams.get("limit") ?? 50)));
  const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
  const sort = url.searchParams.get("sort") ?? "name";

  let items = database.staged_customers.map((customer) =>
    toCustomerListItem(database, customer),
  );

  if (query) {
    items = items.filter((item) => {
      const haystack = [
        item.full_name,
        item.cif_number,
        item.occupation,
        item.employer_name,
        item.branch_code,
        item.address,
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }
  if (risk) items = items.filter((item) => item.risk_rating === risk);
  if (status) items = items.filter((item) => item.profile_status === status);
  if (grade) items = items.filter((item) => item.quality.grade === grade);
  if (severity) {
    items = items.filter(
      (item) =>
        item.highest_severity === severity ||
        (severity === "NONE" && !item.highest_severity),
    );
  }

  items.sort((a, b) => {
    switch (sort) {
      case "quality":
        return b.quality.score - a.quality.score;
      case "risk":
        return RISK_RANK[b.risk_rating] - RISK_RANK[a.risk_rating];
      case "severity":
        return (
          (SEVERITY_RANK[b.highest_severity ?? ""] ?? 0) -
          (SEVERITY_RANK[a.highest_severity ?? ""] ?? 0)
        );
      case "recent":
        return (b.last_transaction_at ?? "").localeCompare(
          a.last_transaction_at ?? "",
        );
      case "onboarded":
        return b.onboarded_at.localeCompare(a.onboarded_at);
      default:
        return a.full_name.localeCompare(b.full_name);
    }
  });

  const total = items.length;
  const start = (page - 1) * limit;
  const paged = items.slice(start, start + limit);
  const metrics = getCustomerMetrics(database);

  const gradeCounts: Record<CustomerQuality["grade"], number> = {
    A: 0,
    B: 0,
    C: 0,
    D: 0,
  };
  for (const item of items) gradeCounts[item.quality.grade] += 1;

  return ok({
    items: paged,
    total,
    page,
    limit,
    totalPages: Math.max(1, Math.ceil(total / limit)),
    metrics,
    gradeCounts,
    options: {
      branches: [...new Set(database.staged_customers.map((c) => c.branch_code).filter(Boolean))],
    },
  });
}
