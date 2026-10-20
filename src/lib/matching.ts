import { doubleMetaphone } from "double-metaphone";
import type {
  EntityType,
  MatchSeverity,
  WatchlistAlias,
  WatchlistDocument,
  WatchlistEntity,
  WhitelistRecord,
} from "./types";
import {
  normalizeDocumentNumber,
  normalizeNationality,
  sanitizeName,
} from "./normalize";

export const MATCH_WEIGHTS = {
  name: 0.5,
  dob: 0.25,
  pob: 0.15,
  nationality: 0.1,
} as const;

export interface MatchCustomerInput {
  id: string;
  cif_number: string;
  national_id_number: string;
  passport_number: string;
  raw_full_name: string;
  date_of_birth: string;
  place_of_birth: string;
  nationality: string;
  customer_type?: EntityType;
}

export interface MatchDraft {
  staged_customer_id: string;
  watchlist_entity_id: string;
  total_confidence_score: number;
  match_severity: MatchSeverity;
  is_exact_identity_match: boolean;
  is_whitelisted: boolean;
  breakdown: {
    name_similarity_score: number;
    dob_match_score: number;
    pob_match_score: number;
    nationality_match_score: number;
    matched_on_alias: string | null;
    algorithm_telemetry: Record<string, unknown>;
  };
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i);
  const current = new Array<number>(b.length + 1);
  for (let i = 0; i < a.length; i += 1) {
    current[0] = i + 1;
    for (let j = 0; j < b.length; j += 1) {
      const insert = current[j] + 1;
      const remove = previous[j + 1] + 1;
      const replace = previous[j] + (a[i] === b[j] ? 0 : 1);
      current[j + 1] = Math.min(insert, remove, replace);
    }
    previous = [...current];
  }
  return previous[b.length];
}

export function similarityRatio(a: string, b: string): number {
  if (!a && !b) return 0;
  if (a === b) return 1;
  const max = Math.max(a.length, b.length);
  if (max === 0) return 0;
  return 1 - levenshtein(a, b) / max;
}

export function tokenSortRatio(a: string, b: string): number {
  const sortedA = a.split(/\s+/).filter(Boolean).sort().join(" ");
  const sortedB = b.split(/\s+/).filter(Boolean).sort().join(" ");
  return similarityRatio(sortedA, sortedB);
}

export function jaroWinkler(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;

  const matchDistance = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aMatches = new Array<boolean>(a.length).fill(false);
  const bMatches = new Array<boolean>(b.length).fill(false);
  let matches = 0;

  for (let i = 0; i < a.length; i += 1) {
    const start = Math.max(0, i - matchDistance);
    const end = Math.min(i + matchDistance + 1, b.length);
    for (let j = start; j < end; j += 1) {
      if (!bMatches[j] && a[i] === b[j]) {
        aMatches[i] = true;
        bMatches[j] = true;
        matches += 1;
        break;
      }
    }
  }

  if (matches === 0) return 0;

  let transpositions = 0;
  let bIndex = 0;
  for (let i = 0; i < a.length; i += 1) {
    if (!aMatches[i]) continue;
    while (!bMatches[bIndex]) bIndex += 1;
    if (a[i] !== b[bIndex]) transpositions += 1;
    bIndex += 1;
  }
  transpositions /= 2;

  const jaro =
    (matches / a.length +
      matches / b.length +
      (matches - transpositions) / matches) /
    3;

  let prefix = 0;
  const maxPrefix = Math.min(4, a.length, b.length);
  for (let i = 0; i < maxPrefix; i += 1) {
    if (a[i] === b[i]) prefix += 1;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

function metaphoneCodes(name: string): string[] {
  const words = name.split(/\s+/).filter(Boolean);
  return words
    .map((word) => doubleMetaphone(word)[0])
    .filter((code): code is string => Boolean(code));
}

export function phoneticSimilarity(a: string, b: string): number {
  const codesA = metaphoneCodes(a);
  const codesB = metaphoneCodes(b);
  if (!codesA.length || !codesB.length) return 0;
  const setA = new Set(codesA);
  const setB = new Set(codesB);
  let intersection = 0;
  for (const code of setA) {
    if (setB.has(code)) intersection += 1;
  }
  const union = new Set([...setA, ...setB]).size;
  const overlap = union ? intersection / union : 0;
  const primary = codesA[0] === codesB[0] ? 1 : 0;
  return primary * 0.65 + overlap * 0.35;
}

export function nameSimilarity(a: string, b: string): number {
  const left = sanitizeName(a);
  const right = sanitizeName(b);
  if (!left || !right) return 0;
  if (left === right) return 100;
  const jw = jaroWinkler(left, right);
  const token = tokenSortRatio(left, right);
  const phonetic = phoneticSimilarity(left, right);
  return Math.round((jw * 0.5 + token * 0.35 + phonetic * 0.15) * 10000) / 100;
}

export function locationSimilarity(a: string, b: string): number {
  const left = sanitizeName(a);
  const right = sanitizeName(b);
  if (!left || !right) return 0;
  if (left === right) return 100;
  if (left.includes(right) || right.includes(left)) return 94;
  return (
    Math.round(
      Math.max(jaroWinkler(left, right), tokenSortRatio(left, right)) * 10000,
    ) / 100
  );
}

function compareNationality(a: string, b: string): number {
  const left = normalizeNationality(a);
  const right = normalizeNationality(b);
  if (!left || !right) return 0;
  return left === right ? 100 : 0;
}

function documentMatches(
  customer: MatchCustomerInput,
  documents: WatchlistDocument[],
): { matched: boolean; documentType: string | null } {
  const customerNIK = normalizeDocumentNumber(customer.national_id_number);
  const customerPassport = normalizeDocumentNumber(customer.passport_number);
  for (const document of documents) {
    const documentNumber = normalizeDocumentNumber(document.document_number);
    if (!documentNumber) continue;
    if (
      (document.document_type === "NIK" ||
        document.document_type === "NATIONAL_ID") &&
      customerNIK &&
      customerNIK === documentNumber
    ) {
      return { matched: true, documentType: document.document_type };
    }
    if (
      document.document_type === "PASSPORT" &&
      customerPassport &&
      customerPassport === documentNumber
    ) {
      return { matched: true, documentType: document.document_type };
    }
  }
  return { matched: false, documentType: null };
}

function severityFor(score: number, exact: boolean): MatchSeverity {
  if (exact) return "CRITICAL";
  if (score >= 85) return "HIGH";
  if (score >= 70) return "MEDIUM";
  return "LOW";
}

export function screenCustomers(
  customers: MatchCustomerInput[],
  entities: WatchlistEntity[],
  aliases: WatchlistAlias[],
  documents: WatchlistDocument[],
  whitelist: WhitelistRecord[],
  threshold = 70,
): MatchDraft[] {
  const results: MatchDraft[] = [];
  const activeEntities = entities.filter((entity) => entity.is_active);
  const aliasesByEntity = new Map<string, WatchlistAlias[]>();
  const documentsByEntity = new Map<string, WatchlistDocument[]>();
  const whitelistSet = new Set(
    whitelist.map((record) => `${record.entity_id}::${record.customer_cif}`),
  );

  for (const alias of aliases) {
    const list = aliasesByEntity.get(alias.entity_id) ?? [];
    list.push(alias);
    aliasesByEntity.set(alias.entity_id, list);
  }
  for (const document of documents) {
    const list = documentsByEntity.get(document.entity_id) ?? [];
    list.push(document);
    documentsByEntity.set(document.entity_id, list);
  }

  for (const customer of customers) {
    const customerType: EntityType = customer.customer_type ?? "INDIVIDUAL";
    for (const entity of activeEntities) {
      if (entity.entity_type !== customerType) continue;
      const entityAliases = aliasesByEntity.get(entity.id) ?? [];
      const entityDocuments = documentsByEntity.get(entity.id) ?? [];

      let bestName = nameSimilarity(customer.raw_full_name, entity.primary_name);
      let matchedOnAlias: string | null = null;
      for (const alias of entityAliases) {
        const aliasScore = nameSimilarity(customer.raw_full_name, alias.alias_name);
        if (aliasScore > bestName) {
          bestName = aliasScore;
          matchedOnAlias = alias.alias_name;
        }
      }

      const documentResult = documentMatches(customer, entityDocuments);
      const dobScore =
        customer.date_of_birth &&
        entity.date_of_birth &&
        customer.date_of_birth === entity.date_of_birth
          ? 100
          : 0;
      const pobScore = locationSimilarity(
        customer.place_of_birth,
        entity.place_of_birth ?? "",
      );
      const nationalityScore = compareNationality(
        customer.nationality,
        entity.nationality ?? "",
      );

      const weighted =
        bestName * MATCH_WEIGHTS.name +
        dobScore * MATCH_WEIGHTS.dob +
        pobScore * MATCH_WEIGHTS.pob +
        nationalityScore * MATCH_WEIGHTS.nationality;
      const score = documentResult.matched
        ? 100
        : Math.round(weighted * 100) / 100;

      if (score < threshold && !documentResult.matched) continue;

      const exact = documentResult.matched;
      results.push({
        staged_customer_id: customer.id,
        watchlist_entity_id: entity.id,
        total_confidence_score: score,
        match_severity: severityFor(score, exact),
        is_exact_identity_match: exact,
        is_whitelisted: whitelistSet.has(`${entity.id}::${customer.cif_number}`),
        breakdown: {
          name_similarity_score: exact ? 100 : bestName,
          dob_match_score: dobScore,
          pob_match_score: Math.round(pobScore * 100) / 100,
          nationality_match_score: nationalityScore,
          matched_on_alias: matchedOnAlias,
          algorithm_telemetry: {
            primary_name_evaluated: entity.primary_name,
            alias_candidates: entityAliases.length,
            jaro_winkler: Math.round(jaroWinkler(sanitizeName(customer.raw_full_name), sanitizeName(entity.primary_name)) * 10000) / 10000,
            token_sort_ratio: Math.round(tokenSortRatio(sanitizeName(customer.raw_full_name), sanitizeName(entity.primary_name)) * 10000) / 10000,
            phonetic_overlap: Math.round(phoneticSimilarity(sanitizeName(customer.raw_full_name), sanitizeName(entity.primary_name)) * 10000) / 10000,
            exact_document_match: documentResult.documentType,
            weights: MATCH_WEIGHTS,
            threshold,
          },
        },
      });
    }
  }

  return results.sort((a, b) => b.total_confidence_score - a.total_confidence_score);
}
