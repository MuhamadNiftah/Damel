import type { DatabaseSchema, ScreeningJob, ScreeningMatch, User } from "./types";
import { appendAudit, mutateDatabase, newId, nowIso } from "./db";
import { decryptPII } from "./crypto";
import { screenCustomers, type MatchCustomerInput } from "./matching";

export interface MatchingSyncSummary {
  completedAt: string;
  durationMs: number;
  customersEvaluated: number;
  entitiesEvaluated: number;
  candidates: number;
  created: number;
  updated: number;
  removed: number;
  preserved: number;
  jobIds: string[];
  batches: number;
}

export function runMatchingSync(user: User): MatchingSyncSummary {
  const startedAt = nowIso();
  const startMs = Date.now();

  return mutateDatabase((db) => {
    const entities = db.watchlist_entities.filter((entity) => entity.is_active);
    const inputs: MatchCustomerInput[] = db.staged_customers.map((customer) => ({
      id: customer.id,
      cif_number: customer.cif_number,
      national_id_number: decryptPII(customer.national_id_number),
      passport_number: customer.passport_number,
      raw_full_name: customer.raw_full_name,
      date_of_birth: customer.date_of_birth,
      place_of_birth: customer.place_of_birth,
      nationality: customer.nationality,
      customer_type: customer.customer_type,
    }));

    const drafts = screenCustomers(
      inputs,
      db.watchlist_entities,
      db.watchlist_aliases,
      db.watchlist_documents,
      db.whitelist_records,
      70,
    );

    const draftsByCustomer = new Map<string, typeof drafts>();
    for (const draft of drafts) {
      const list = draftsByCustomer.get(draft.staged_customer_id) ?? [];
      list.push(draft);
      draftsByCustomer.set(draft.staged_customer_id, list);
    }

    const batches = new Map<string, string[]>();
    for (const customer of db.staged_customers) {
      const list = batches.get(customer.batch_id) ?? [];
      list.push(customer.id);
      batches.set(customer.batch_id, list);
    }

    const jobByBatch = new Map<string, string>();
    const jobs: ScreeningJob[] = [];
    const completedAt = nowIso();
    for (const [batchId, customerIds] of batches) {
      const hits = customerIds.reduce(
        (sum, customerId) => sum + (draftsByCustomer.get(customerId)?.length ?? 0),
        0,
      );
      const job: ScreeningJob = {
        id: newId("job"),
        batch_id: batchId,
        job_status: "COMPLETED",
        total_evaluated: customerIds.length,
        total_hits: hits,
        min_threshold_used: 70,
        started_at: startedAt,
        finished_at: completedAt,
        triggered_by_user_id: user.id,
      };
      jobs.push(job);
      jobByBatch.set(batchId, job.id);
    }

    const customerBatch = new Map(
      db.staged_customers.map((customer) => [customer.id, customer.batch_id]),
    );

    let created = 0;
    let updated = 0;
    let preserved = 0;
    const matchedKeys = new Set<string>();

    for (const draft of drafts) {
      const key = `${draft.staged_customer_id}::${draft.watchlist_entity_id}`;
      matchedKeys.add(key);
      const existing = db.screening_matches.find(
        (match) =>
          match.staged_customer_id === draft.staged_customer_id &&
          match.watchlist_entity_id === draft.watchlist_entity_id,
      );

      if (existing) {
        existing.total_confidence_score = draft.total_confidence_score;
        existing.match_severity = draft.match_severity;
        existing.is_exact_identity_match = draft.is_exact_identity_match;
        existing.is_whitelisted = draft.is_whitelisted;
        const breakdown = db.match_score_breakdowns.find(
          (item) => item.screening_match_id === existing.id,
        );
        if (breakdown) {
          breakdown.name_similarity_score = draft.breakdown.name_similarity_score;
          breakdown.dob_match_score = draft.breakdown.dob_match_score;
          breakdown.pob_match_score = draft.breakdown.pob_match_score;
          breakdown.nationality_match_score =
            draft.breakdown.nationality_match_score;
          breakdown.matched_on_alias = draft.breakdown.matched_on_alias;
          breakdown.algorithm_telemetry = draft.breakdown.algorithm_telemetry;
        }
        updated += 1;
        continue;
      }

      const jobId =
        jobByBatch.get(customerBatch.get(draft.staged_customer_id) ?? "") ??
        jobs[0]?.id ??
        "";
      const match: ScreeningMatch = {
        id: newId("match"),
        job_id: jobId,
        staged_customer_id: draft.staged_customer_id,
        watchlist_entity_id: draft.watchlist_entity_id,
        total_confidence_score: draft.total_confidence_score,
        match_severity: draft.match_severity,
        is_exact_identity_match: draft.is_exact_identity_match,
        is_whitelisted: draft.is_whitelisted,
        matched_at: completedAt,
      };
      db.screening_matches.push(match);
      db.match_score_breakdowns.push({
        id: newId("brk"),
        screening_match_id: match.id,
        ...draft.breakdown,
      });
      created += 1;
    }

    const stale = db.screening_matches.filter((match) => {
      const key = `${match.staged_customer_id}::${match.watchlist_entity_id}`;
      if (matchedKeys.has(key)) return false;
      const hasCase = db.investigation_cases.some(
        (investigation) => investigation.screening_match_id === match.id,
      );
      if (hasCase || match.is_whitelisted) {
        preserved += 1;
        return false;
      }
      return true;
    });
    const staleIds = new Set(stale.map((match) => match.id));
    if (staleIds.size) {
      db.screening_matches = db.screening_matches.filter(
        (match) => !staleIds.has(match.id),
      );
      db.match_score_breakdowns = db.match_score_breakdowns.filter(
        (breakdown) => !staleIds.has(breakdown.screening_match_id),
      );
    }

    db.screening_jobs.push(...jobs);

    appendAudit(db, user, {
      action_name: "RUN_MATCHING_SYNC",
      module_name: "MATCHING",
      description: `Sinkronisasi matching engine: ${inputs.length} nasabah terhadap ${entities.length} entitas aktif.`,
      state_before: null,
      state_after: {
        customers: inputs.length,
        entities: entities.length,
        candidates: drafts.length,
        created,
        updated,
        removed: staleIds.size,
        preserved,
        batches: jobs.length,
        threshold: 70,
      },
    });

    return {
      completedAt,
      durationMs: Date.now() - startMs,
      customersEvaluated: inputs.length,
      entitiesEvaluated: entities.length,
      candidates: drafts.length,
      created,
      updated,
      removed: staleIds.size,
      preserved,
      jobIds: jobs.map((job) => job.id),
      batches: jobs.length,
    };
  });
}

export function getMatchingSnapshot(db: DatabaseSchema) {
  const activeEntities = db.watchlist_entities.filter((entity) => entity.is_active);
  const lastJob = db.screening_jobs
    .filter((job) => job.job_status === "COMPLETED")
    .sort((a, b) =>
      (b.finished_at ?? b.started_at ?? "").localeCompare(
        a.finished_at ?? a.started_at ?? "",
      ),
    )[0];
  const sourceCoverage = db.watchlist_sources
    .filter((source) => source.is_current)
    .map((source) => {
      const entityIds = new Set(
        db.watchlist_entities
          .filter((entity) => entity.source_id === source.id)
          .map((entity) => entity.id),
      );
      return {
        id: source.id,
        source_code: source.source_code,
        version_label: source.version_label,
        entities: entityIds.size,
        last_uploaded_at: source.uploaded_at,
      };
    });
  const customersWithMatches = new Set(
    db.screening_matches.map((match) => match.staged_customer_id),
  );
  return {
    customers: db.staged_customers.length,
    customersWithMatches: customersWithMatches.size,
    activeEntities: activeEntities.length,
    totalEntities: db.watchlist_entities.length,
    aliases: db.watchlist_aliases.length,
    documents: db.watchlist_documents.length,
    whitelist: db.whitelist_records.length,
    matches: db.screening_matches.length,
    lastSyncAt: lastJob?.finished_at ?? lastJob?.started_at ?? null,
    lastJobId: lastJob?.id ?? null,
    sourceCoverage,
  };
}
