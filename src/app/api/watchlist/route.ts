import type {
  SourceCode,
  WatchlistEntityView,
  WatchlistSourceView,
} from "@/lib/types";
import { getDatabase } from "@/lib/db";
import { ok } from "@/lib/api";
import { maskNIK } from "@/lib/crypto";
import { normalizeWhitespace } from "@/lib/normalize";
import {
  isCategorySource,
  type WatchlistCategory,
} from "@/lib/watchlist-categories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const database = getDatabase();
  const url = new URL(request.url);
  const query = normalizeWhitespace(url.searchParams.get("q") ?? "").toLowerCase();
  const sourceFilter = url.searchParams.get("source") as SourceCode | null;
  const category = url.searchParams.get("category") as WatchlistCategory | null;
  const typeFilter = url.searchParams.get("type");
  const activeFilter = url.searchParams.get("active");

  const sources: WatchlistSourceView[] = database.watchlist_sources
    .filter((source) =>
      category ? isCategorySource(category, source.source_code) : true,
    )
    .map((source) => {
      const entities = database.watchlist_entities.filter(
        (entity) => entity.source_id === source.id,
      );
      const entityIds = new Set(entities.map((entity) => entity.id));
      return {
        ...source,
        entity_count: entities.length,
        alias_count: database.watchlist_aliases.filter((alias) =>
          entityIds.has(alias.entity_id),
        ).length,
        document_count: database.watchlist_documents.filter((document) =>
          entityIds.has(document.entity_id),
        ).length,
        whitelist_count: database.whitelist_records.filter((record) =>
          entityIds.has(record.entity_id),
        ).length,
      };
    })
    .sort((a, b) => Number(b.is_current) - Number(a.is_current));

  const entities: WatchlistEntityView[] = database.watchlist_entities
    .map((entity) => {
      const source = database.watchlist_sources.find(
        (item) => item.id === entity.source_id,
      );
      return {
        id: entity.id,
        entity_type: entity.entity_type,
        primary_name: entity.primary_name,
        date_of_birth: entity.date_of_birth,
        place_of_birth: entity.place_of_birth,
        nationality: entity.nationality,
        address_info: entity.address_info,
        legal_reference: entity.legal_reference,
        is_active: entity.is_active,
        created_at: entity.created_at,
        source_code: source?.source_code ?? "DTTOT",
        source_version: source?.version_label ?? "—",
        aliases: database.watchlist_aliases
          .filter((alias) => alias.entity_id === entity.id)
          .map((alias) => alias.alias_name),
        documents: database.watchlist_documents
          .filter((document) => document.entity_id === entity.id)
          .map((document) => ({
            type: document.document_type,
            number:
              document.document_number.length > 7
                ? `${document.document_number.slice(0, 4)}••••${document.document_number.slice(-3)}`
                : document.document_number,
            country: document.issuing_country,
          })),
        whitelist_count: database.whitelist_records.filter(
          (record) => record.entity_id === entity.id,
        ).length,
      };
    })
    .filter((entity) => {
      if (category && !isCategorySource(category, entity.source_code)) return false;
      if (sourceFilter && entity.source_code !== sourceFilter) return false;
      if (typeFilter && entity.entity_type !== typeFilter) return false;
      if (activeFilter === "true" && !entity.is_active) return false;
      if (activeFilter === "false" && entity.is_active) return false;
      if (query) {
        const haystack = [
          entity.primary_name,
          entity.nationality,
          entity.legal_reference,
          entity.source_version,
          ...entity.aliases,
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      return true;
    })
    .sort((a, b) => a.primary_name.localeCompare(b.primary_name));

  const whitelist = database.whitelist_records.map((record) => {
    const entity = database.watchlist_entities.find(
      (item) => item.id === record.entity_id,
    );
    const customer = database.staged_customers.find(
      (item) => item.cif_number === record.customer_cif,
    );
    const approver = database.users.find(
      (item) => item.id === record.approved_by_user_id,
    );
    return {
      id: record.id,
      entity_id: record.entity_id,
      entity_name: entity?.primary_name ?? "—",
      customer_cif: record.customer_cif,
      customer_name: customer?.raw_full_name ?? "—",
      customer_nik: customer ? maskNIK(customer.national_id_number) : "—",
      reason: record.reason,
      approved_by: approver?.full_name ?? "—",
      whitelisted_at: record.whitelisted_at,
    };
  });

  const scopedSourceIds = new Set(sources.map((source) => source.id));
  const scopedEntityIds = new Set(
    database.watchlist_entities
      .filter((entity) => scopedSourceIds.has(entity.source_id))
      .map((entity) => entity.id),
  );

  return ok({
    sources,
    entities,
    whitelist,
    metrics: {
      totalSources: sources.length,
      currentSources: sources.filter((source) => source.is_current).length,
      totalEntities: scopedEntityIds.size,
      activeEntities: database.watchlist_entities.filter(
        (entity) => entity.is_active && scopedEntityIds.has(entity.id),
      ).length,
      totalAliases: database.watchlist_aliases.filter((alias) =>
        scopedEntityIds.has(alias.entity_id),
      ).length,
      totalDocuments: database.watchlist_documents.filter((document) =>
        scopedEntityIds.has(document.entity_id),
      ).length,
      totalWhitelist: database.whitelist_records.filter((record) =>
        scopedEntityIds.has(record.entity_id),
      ).length,
      lastUpdated: sources
        .map((source) => source.uploaded_at)
        .sort()
        .at(-1) ?? null,
    },
  });
}
