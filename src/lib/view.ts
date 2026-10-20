import type {
  ApprovalListItem,
  CaseListItem,
  DatabaseSchema,
  MatchDetail,
  MatchListItem,
  ScreeningMatch,
} from "./types";
import { decryptPII, maskAccount, maskNIK } from "./crypto";

export function toMatchListItem(
  database: DatabaseSchema,
  match: ScreeningMatch,
): MatchListItem | null {
  const customer = database.staged_customers.find(
    (item) => item.id === match.staged_customer_id,
  );
  const entity = database.watchlist_entities.find(
    (item) => item.id === match.watchlist_entity_id,
  );
  if (!customer || !entity) return null;
  const source = database.watchlist_sources.find(
    (item) => item.id === entity.source_id,
  );
  const investigation = database.investigation_cases.find(
    (item) => item.screening_match_id === match.id,
  );
  const approval = investigation
    ? database.approval_requests.find(
        (item) => item.case_id === investigation.id,
      )
    : undefined;

  return {
    id: match.id,
    score: match.total_confidence_score,
    severity: match.match_severity,
    is_exact_identity_match: match.is_exact_identity_match,
    is_whitelisted: match.is_whitelisted,
    matched_at: match.matched_at,
    customer: {
      id: customer.id,
      cif_number: customer.cif_number,
      account_number_masked: maskAccount(customer.account_number),
      full_name: customer.raw_full_name,
      national_id_masked: maskNIK(customer.national_id_number),
      date_of_birth: customer.date_of_birth,
      place_of_birth: customer.place_of_birth,
      nationality: customer.nationality,
      customer_type: customer.customer_type,
    },
    entity: {
      id: entity.id,
      primary_name: entity.primary_name,
      entity_type: entity.entity_type,
      nationality: entity.nationality,
      date_of_birth: entity.date_of_birth,
      place_of_birth: entity.place_of_birth,
      legal_reference: entity.legal_reference,
    },
    source: {
      code: source?.source_code ?? "DTTOT",
      version_label: source?.version_label ?? "—",
      published_by: source?.published_by ?? "—",
    },
    case: investigation
      ? {
          id: investigation.id,
          case_number: investigation.case_number,
          status: investigation.case_status,
          recommendation: investigation.analyst_recommendation,
          has_approval: Boolean(approval),
          approval_step: approval?.current_step ?? null,
        }
      : null,
  };
}

export function toMatchDetail(
  database: DatabaseSchema,
  match: ScreeningMatch,
): MatchDetail | null {
  const base = toMatchListItem(database, match);
  if (!base) return null;
  const customer = database.staged_customers.find(
    (item) => item.id === match.staged_customer_id,
  )!;
  const entity = database.watchlist_entities.find(
    (item) => item.id === match.watchlist_entity_id,
  )!;
  const aliases = database.watchlist_aliases
    .filter((item) => item.entity_id === entity.id)
    .map((item) => item.alias_name);
  const documents = database.watchlist_documents
    .filter((item) => item.entity_id === entity.id)
    .map((item) => ({ ...item, document_number: maskDocument(item.document_number) }));
  const breakdown = database.match_score_breakdowns.find(
    (item) => item.screening_match_id === match.id,
  );
  const investigation = database.investigation_cases.find(
    (item) => item.screening_match_id === match.id,
  );
  const approval = investigation
    ? database.approval_requests.find(
        (item) => item.case_id === investigation.id,
      )
    : undefined;
  const notes = investigation
    ? database.case_notes
        .filter((item) => item.case_id === investigation.id)
        .map((note) => ({
          ...note,
          author_name:
            database.users.find((user) => user.id === note.author_user_id)
              ?.full_name ?? "Pengguna",
        }))
        .sort((a, b) => b.created_at.localeCompare(a.created_at))
    : [];
  const evidence = investigation
    ? database.case_evidence_files.filter(
        (item) => item.case_id === investigation.id,
      )
    : [];
  const freeze = investigation
    ? database.account_freeze_orders.find(
        (item) => item.case_id === investigation.id,
      )
    : undefined;

  return {
    ...base,
    breakdown: {
      name_similarity_score: breakdown?.name_similarity_score ?? 0,
      dob_match_score: breakdown?.dob_match_score ?? 0,
      pob_match_score: breakdown?.pob_match_score ?? 0,
      nationality_match_score: breakdown?.nationality_match_score ?? 0,
      matched_on_alias: breakdown?.matched_on_alias ?? null,
      algorithm_telemetry: breakdown?.algorithm_telemetry ?? {},
    },
    customer_full: {
      national_id_number: decryptPII(customer.national_id_number) || "—",
      passport_number: customer.passport_number || "—",
      address: customer.address,
    },
    aliases,
    documents,
    case_detail: investigation
      ? {
          id: investigation.id,
          case_number: investigation.case_number,
          status: investigation.case_status,
          recommendation: investigation.analyst_recommendation,
          assigned_analyst_id: investigation.assigned_analyst_id,
          opened_at: investigation.opened_at,
          closed_at: investigation.closed_at,
          priority: investigation.priority,
          notes,
          evidence,
          approval: approval
            ? {
                ...approval,
                maker_name:
                  database.users.find((user) => user.id === approval.maker_user_id)
                    ?.full_name ?? "—",
                checker_name:
                  database.users.find(
                    (user) => user.id === approval.checker_user_id,
                  )?.full_name ?? "—",
                approver_name:
                  database.users.find(
                    (user) => user.id === approval.approver_user_id,
                  )?.full_name ?? "—",
              }
            : null,
          freeze: freeze ?? null,
          reports: database.regulatory_reports.filter(
            (item) => item.case_id === investigation.id,
          ),
        }
      : null,
  };
}

function maskDocument(documentNumber: string): string {
  if (documentNumber.length <= 4) return documentNumber;
  return `${documentNumber.slice(0, 4)}••••${documentNumber.slice(-3)}`;
}

export function toCaseListItem(
  database: DatabaseSchema,
  caseId: string,
): CaseListItem | null {
  const investigation = database.investigation_cases.find(
    (item) => item.id === caseId,
  );
  if (!investigation) return null;
  const match = database.screening_matches.find(
    (item) => item.id === investigation.screening_match_id,
  );
  if (!match) return null;
  const base = toMatchListItem(database, match);
  if (!base) return null;
  const approval = database.approval_requests.find(
    (item) => item.case_id === investigation.id,
  );
  const freeze = database.account_freeze_orders.find(
    (item) => item.case_id === investigation.id,
  );
  return {
    id: investigation.id,
    case_number: investigation.case_number,
    status: investigation.case_status,
    recommendation: investigation.analyst_recommendation,
    opened_at: investigation.opened_at,
    closed_at: investigation.closed_at,
    priority: investigation.priority,
    customer_name: base.customer.full_name,
    customer_cif: base.customer.cif_number,
    entity_name: base.entity.primary_name,
    source_code: base.source.code,
    score: base.score,
    severity: base.severity,
    assigned_analyst_name:
      database.users.find((user) => user.id === investigation.assigned_analyst_id)
        ?.full_name ?? "—",
    note_count: database.case_notes.filter(
      (item) => item.case_id === investigation.id,
    ).length,
    evidence_count: database.case_evidence_files.filter(
      (item) => item.case_id === investigation.id,
    ).length,
    approval_step: approval?.current_step ?? null,
    final_verdict: approval?.final_verdict ?? null,
    freeze_status: freeze?.freeze_status ?? null,
    report_count: database.regulatory_reports.filter(
      (item) => item.case_id === investigation.id,
    ).length,
    match_id: match.id,
  };
}

export function toApprovalListItem(
  database: DatabaseSchema,
  approvalId: string,
): ApprovalListItem | null {
  const approval = database.approval_requests.find(
    (item) => item.id === approvalId,
  );
  if (!approval) return null;
  const investigation = database.investigation_cases.find(
    (item) => item.id === approval.case_id,
  );
  if (!investigation) return null;
  const match = database.screening_matches.find(
    (item) => item.id === investigation.screening_match_id,
  );
  if (!match) return null;
  const base = toMatchListItem(database, match);
  if (!base) return null;
  return {
    id: approval.id,
    case_id: approval.case_id,
    case_number: investigation.case_number,
    customer_name: base.customer.full_name,
    entity_name: base.entity.primary_name,
    score: base.score,
    severity: base.severity,
    current_step: approval.current_step,
    final_verdict: approval.final_verdict,
    submitted_at: approval.submitted_at,
    maker_user_id: approval.maker_user_id,
    checker_user_id: approval.checker_user_id,
    approver_user_id: approval.approver_user_id,
    maker_name:
      database.users.find((user) => user.id === approval.maker_user_id)
        ?.full_name ?? "—",
    checker_name:
      database.users.find((user) => user.id === approval.checker_user_id)
        ?.full_name ?? "—",
    approver_name:
      database.users.find((user) => user.id === approval.approver_user_id)
        ?.full_name ?? "—",
    recommendation: investigation.analyst_recommendation,
    decision_reason: approval.decision_reason,
  };
}

export function getBatchHits(database: DatabaseSchema, batchId: string): number {
  const job = database.screening_jobs.find((item) => item.batch_id === batchId);
  return job?.total_hits ?? 0;
}
