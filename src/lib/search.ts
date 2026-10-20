import type {
  CaseStatus,
  CustomerListItem,
  DatabaseSchema,
  EntityType,
  MatchSeverity,
  SourceCode,
} from "./types";
import { decryptPII } from "./crypto";
import { toCustomerListItem } from "./customers";
import { toMatchListItem } from "./view";

export interface SearchEntityHit {
  id: string;
  primary_name: string;
  entity_type: EntityType;
  source_code: SourceCode;
  source_version: string;
  nationality: string | null;
  date_of_birth: string | null;
  place_of_birth: string | null;
  legal_reference: string | null;
  aliases: string[];
  match_count: number;
}

export interface SearchCaseHit {
  id: string;
  case_number: string;
  customer_name: string;
  entity_name: string;
  source_code: SourceCode;
  status: CaseStatus;
  severity: MatchSeverity;
  score: number;
  opened_at: string;
}

export interface GlobalSearchResult {
  query: string;
  total: number;
  customers: CustomerListItem[];
  entities: SearchEntityHit[];
  cases: SearchCaseHit[];
  tookMs: number;
}

export function runGlobalSearch(
  database: DatabaseSchema,
  rawQuery: string,
): GlobalSearchResult {
  const started = Date.now();
  const query = rawQuery.trim();
  const needle = query.toLowerCase();
  if (needle.length < 2) {
    return {
      query,
      total: 0,
      customers: [],
      entities: [],
      cases: [],
      tookMs: Date.now() - started,
    };
  }

  const customers = database.staged_customers
    .map((customer) => {
      const item = toCustomerListItem(database, customer);
      const nik = decryptPII(customer.national_id_number);
      const account = decryptPII(customer.account_number);
      const haystack = [
        item.full_name,
        customer.sanitized_full_name,
        item.cif_number,
        item.occupation,
        item.employer_name,
        item.nationality,
        item.address,
        item.place_of_birth,
        nik,
        account,
        item.branch_code,
      ]
        .join(" ")
        .toLowerCase();
      return { item, haystack };
    })
    .filter((entry) => entry.haystack.includes(needle))
    .sort((a, b) => {
      const aExact = a.item.full_name.toLowerCase() === needle ? 1 : 0;
      const bExact = b.item.full_name.toLowerCase() === needle ? 1 : 0;
      if (aExact !== bExact) return bExact - aExact;
      return b.item.quality.score - a.item.quality.score;
    })
    .map((entry) => entry.item)
    .slice(0, 12);

  const entities = database.watchlist_entities
    .map((entity) => {
      const source = database.watchlist_sources.find(
        (item) => item.id === entity.source_id,
      );
      const aliases = database.watchlist_aliases
        .filter((alias) => alias.entity_id === entity.id)
        .map((alias) => alias.alias_name);
      const documents = database.watchlist_documents.filter(
        (document) => document.entity_id === entity.id,
      );
      const haystack = [
        entity.primary_name,
        entity.nationality,
        entity.place_of_birth,
        entity.date_of_birth,
        entity.legal_reference,
        entity.address_info,
        source?.source_code ?? "",
        ...aliases,
        ...documents.map((document) => document.document_number),
      ]
        .join(" ")
        .toLowerCase();
      return { entity, source, aliases, haystack };
    })
    .filter((entry) => entry.haystack.includes(needle))
    .sort((a, b) => {
      const aExact = a.entity.primary_name.toLowerCase() === needle ? 1 : 0;
      const bExact = b.entity.primary_name.toLowerCase() === needle ? 1 : 0;
      return bExact - aExact;
    })
    .slice(0, 12)
    .map(({ entity, source, aliases }) => ({
      id: entity.id,
      primary_name: entity.primary_name,
      entity_type: entity.entity_type,
      source_code: source?.source_code ?? "DTTOT",
      source_version: source?.version_label ?? "—",
      nationality: entity.nationality,
      date_of_birth: entity.date_of_birth,
      place_of_birth: entity.place_of_birth,
      legal_reference: entity.legal_reference,
      aliases,
      match_count: database.screening_matches.filter(
        (match) => match.watchlist_entity_id === entity.id,
      ).length,
    }));

  const cases = database.investigation_cases
    .map((investigation) => {
      const match = database.screening_matches.find(
        (item) => item.id === investigation.screening_match_id,
      );
      const view = match ? toMatchListItem(database, match) : null;
      if (!match || !view) return null;
      const haystack = [
        investigation.case_number,
        view.customer.full_name,
        view.customer.cif_number,
        view.entity.primary_name,
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(needle)) return null;
      return {
        id: investigation.id,
        case_number: investigation.case_number,
        customer_name: view.customer.full_name,
        entity_name: view.entity.primary_name,
        source_code: view.source.code,
        status: investigation.case_status,
        severity: view.severity,
        score: view.score,
        opened_at: investigation.opened_at,
      } satisfies SearchCaseHit;
    })
    .filter((item): item is SearchCaseHit => Boolean(item))
    .slice(0, 8);

  return {
    query,
    total: customers.length + entities.length + cases.length,
    customers,
    entities,
    cases,
    tookMs: Date.now() - started,
  };
}
