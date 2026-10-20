import type {
  CustomerDetail,
  CustomerListItem,
  CustomerMatchRef,
  CustomerRiskRating,
  DatabaseSchema,
  MatchSeverity,
  StagedCustomer,
} from "./types";
import { decryptPII, maskAccount, maskNIK } from "./crypto";
import { assessCustomerQuality } from "./customer-profile";

const SEVERITY_RANK: Record<MatchSeverity, number> = {
  CRITICAL: 4,
  HIGH: 3,
  MEDIUM: 2,
  LOW: 1,
};

const OPEN_CASE_STATUSES = new Set(["OPEN", "IN_ANALYSIS", "PENDING_APPROVAL"]);

function normalizedRisk(customer: StagedCustomer): CustomerRiskRating {
  return customer.risk_rating ?? "MEDIUM";
}

function matchesForCustomer(database: DatabaseSchema, customerId: string) {
  return database.screening_matches.filter(
    (match) => match.staged_customer_id === customerId,
  );
}

function highestSeverity(
  database: DatabaseSchema,
  customerId: string,
): MatchSeverity | null {
  const severities = matchesForCustomer(database, customerId)
    .filter((match) => !match.is_whitelisted)
    .map((match) => match.match_severity)
    .sort((a, b) => SEVERITY_RANK[b] - SEVERITY_RANK[a]);
  return severities[0] ?? null;
}

function openCaseCount(database: DatabaseSchema, customerId: string) {
  const matchIds = new Set(
    matchesForCustomer(database, customerId).map((match) => match.id),
  );
  return database.investigation_cases.filter(
    (investigation) =>
      matchIds.has(investigation.screening_match_id) &&
      OPEN_CASE_STATUSES.has(investigation.case_status),
  ).length;
}

export function toCustomerListItem(
  database: DatabaseSchema,
  customer: StagedCustomer,
): CustomerListItem {
  const matches = matchesForCustomer(database, customer.id);
  const severity = highestSeverity(database, customer.id);
  const openCases = openCaseCount(database, customer.id);
  const transactions = customer.transactions ?? [];
  const quality = assessCustomerQuality(customer, {
    highestSeverity: severity,
    openCaseCount: openCases,
  });

  return {
    id: customer.id,
    cif_number: customer.cif_number,
    full_name: customer.raw_full_name,
    national_id_masked: maskNIK(customer.national_id_number),
    account_number_masked: maskAccount(customer.account_number),
    customer_type: customer.customer_type,
    date_of_birth: customer.date_of_birth,
    place_of_birth: customer.place_of_birth,
    nationality: customer.nationality,
    address: customer.address,
    occupation: customer.occupation ?? "—",
    employer_name: customer.employer_name ?? "—",
    employment_status: customer.employment_status ?? null,
    risk_rating: normalizedRisk(customer),
    profile_status: customer.profile_status ?? "ACTIVE",
    branch_code: customer.branch_code ?? "—",
    onboarded_at: customer.onboarded_at ?? "",
    monthly_income: customer.monthly_income ?? 0,
    quality,
    transaction_count: transactions.length,
    last_transaction_at: transactions[0]?.transaction_date ?? null,
    highest_severity: severity,
    match_count: matches.length,
    open_case_count: openCases,
  };
}

export function toCustomerDetail(
  database: DatabaseSchema,
  customer: StagedCustomer,
): CustomerDetail {
  const base = toCustomerListItem(database, customer);
  const matches = matchesForCustomer(database, customer.id);
  const transactions = customer.transactions ?? [];
  const totalValue = transactions.reduce((sum, item) => sum + item.amount, 0);

  const matchRefs: CustomerMatchRef[] = matches.map((match) => {
    const entity = database.watchlist_entities.find(
      (item) => item.id === match.watchlist_entity_id,
    );
    const source = entity
      ? database.watchlist_sources.find((item) => item.id === entity.source_id)
      : undefined;
    const investigation = database.investigation_cases.find(
      (item) => item.screening_match_id === match.id,
    );
    return {
      match_id: match.id,
      entity_id: entity?.id ?? "",
      entity_name: entity?.primary_name ?? "Entitas tidak ditemukan",
      source_code: source?.source_code ?? "DTTOT",
      source_version: source?.version_label ?? "—",
      score: match.total_confidence_score,
      severity: match.match_severity,
      is_whitelisted: match.is_whitelisted,
      case_id: investigation?.id ?? null,
      case_number: investigation?.case_number ?? null,
      case_status: investigation?.case_status ?? null,
    };
  });

  const batch = database.batch_uploads.find(
    (item) => item.id === customer.batch_id,
  );

  return {
    ...base,
    national_id_number: decryptPII(customer.national_id_number) || "—",
    passport_number: customer.passport_number || "—",
    source_of_fund: customer.source_of_fund ?? "—",
    batch_id: customer.batch_id,
    batch_number: batch?.batch_number ?? customer.batch_id,
    employment_history: customer.employment_history ?? [],
    transactions,
    matches: matchRefs.sort((a, b) => b.score - a.score),
    total_transaction_value: totalValue,
    average_transaction_value: transactions.length
      ? totalValue / transactions.length
      : 0,
  };
}

export function getCustomerMetrics(
  database: DatabaseSchema,
): import("./types").CustomerDatasetMetrics {
  const items = database.staged_customers.map((customer) =>
    toCustomerListItem(database, customer),
  );
  const total = items.length;
  const active = items.filter((item) => item.profile_status === "ACTIVE").length;
  const dormant = items.filter((item) => item.profile_status === "DORMANT").length;
  const highRisk = items.filter((item) => item.risk_rating === "HIGH").length;
  const mediumRisk = items.filter((item) => item.risk_rating === "MEDIUM").length;
  const lowRisk = items.filter((item) => item.risk_rating === "LOW").length;
  const withNik = items.filter((item) => item.national_id_masked !== "—").length;
  const averageQuality = total
    ? Math.round(items.reduce((sum, item) => sum + item.quality.score, 0) / total)
    : 0;
  const totalTransactions = items.reduce(
    (sum, item) => sum + item.transaction_count,
    0,
  );
  return {
    total,
    active,
    dormant,
    highRisk,
    mediumRisk,
    lowRisk,
    withNik,
    averageQuality,
    totalTransactions,
  };
}

export function findCustomer(
  database: DatabaseSchema,
  id: string,
): StagedCustomer | undefined {
  return database.staged_customers.find(
    (customer) => customer.id === id || customer.cif_number === id,
  );
}
