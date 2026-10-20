import { getDatabase } from "@/lib/db";
import { asNumber, ok } from "@/lib/api";
import { toMatchListItem } from "@/lib/view";
import type { MatchListItem, SourceCode } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const database = getDatabase();
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").toLowerCase().trim();
  const severity = url.searchParams.get("severity") ?? "all";
  const source = url.searchParams.get("source") ?? "all";
  const status = url.searchParams.get("status") ?? "all";
  const whitelist = url.searchParams.get("whitelist") ?? "exclude";
  const minScore = asNumber(url.searchParams.get("minScore"), 0);
  const sort = url.searchParams.get("sort") ?? "score_desc";
  const page = Math.max(1, asNumber(url.searchParams.get("page"), 1));
  const pageSize = Math.min(100, Math.max(5, asNumber(url.searchParams.get("pageSize"), 20)));

  const all = database.screening_matches
    .map((match) => toMatchListItem(database, match))
    .filter((item): item is MatchListItem => Boolean(item));

  const filtered = all.filter((match) => {
    if (whitelist === "exclude" && match.is_whitelisted) return false;
    if (whitelist === "only" && !match.is_whitelisted) return false;
    if (severity !== "all" && match.severity !== severity) return false;
    if (source !== "all" && match.source.code !== (source as SourceCode)) return false;
    if (match.score < minScore) return false;
    if (status !== "all") {
      if (status === "unhandled" && match.case) return false;
      if (status === "handled" && !match.case) return false;
      if (status === "open" && (!match.case || match.case.status === "CLOSED")) return false;
      if (status === "closed" && match.case?.status !== "CLOSED") return false;
      if (
        ["OPEN", "IN_ANALYSIS", "PENDING_APPROVAL", "CLOSED"].includes(status) &&
        match.case?.status !== status
      )
        return false;
    }
    if (query) {
      const haystack = [
        match.customer.full_name,
        match.customer.cif_number,
        match.entity.primary_name,
        match.case?.case_number,
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    return true;
  });

  filtered.sort((a, b) => {
    if (sort === "score_asc") return a.score - b.score;
    if (sort === "date_desc") return b.matched_at.localeCompare(a.matched_at);
    if (sort === "name_asc") return a.customer.full_name.localeCompare(b.customer.full_name);
    return b.score - a.score;
  });

  const total = filtered.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const items = filtered.slice((page - 1) * pageSize, page * pageSize);

  return ok({
    items,
    total,
    page,
    pageSize,
    pageCount,
    metrics: {
      all: all.length,
      critical: all.filter((match) => match.severity === "CRITICAL").length,
      high: all.filter((match) => match.severity === "HIGH").length,
      medium: all.filter((match) => match.severity === "MEDIUM").length,
      whitelisted: all.filter((match) => match.is_whitelisted).length,
      unhandled: all.filter((match) => !match.case && !match.is_whitelisted).length,
      openCases: all.filter(
        (match) => match.case && match.case.status !== "CLOSED",
      ).length,
      averageScore:
        all.length > 0
          ? Math.round(
              (all.reduce((sum, match) => sum + match.score, 0) / all.length) * 10,
            ) / 10
          : 0,
    },
    filters: { query, severity, source, status, whitelist, minScore, sort },
  });
}
