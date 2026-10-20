import type {
  DocumentType,
  EntityType,
  SourceCode,
  User,
  WatchlistSource,
} from "./types";
import { appendAudit, mutateDatabase, newId, nowIso } from "./db";
import { parseSpreadsheet, detectWatchlistColumns } from "./excel";
import {
  extractAliases,
  isValidNIK,
  normalizeDocumentNumber,
  normalizeWhitespace,
  parseDate,
  sanitizeName,
} from "./normalize";

export interface WatchlistImportOptions {
  sourceCode: SourceCode;
  versionLabel: string;
  publishedBy: string;
  effectiveDate: string;
  expiryDate?: string;
  legalBasis?: string;
  filename: string;
  buffer: Buffer;
  user: User;
}

export interface WatchlistImportResult {
  source: WatchlistSource;
  imported: number;
  aliases: number;
  documents: number;
  skipped: number;
  errors: Array<{ row: number; reason: string }>;
}

const VALID_SOURCES: SourceCode[] = [
  "DTTOT",
  "DPPSPM",
  "PEP",
  "UN_SANCTION",
];

function normalizeEntityType(value: string): EntityType {
  const normalized = sanitizeName(value);
  if (
    ["corporate", "korporasi", "badan", "badan hukum", "perusahaan", "pt"].some(
      (token) => normalized.includes(token),
    )
  ) {
    return "CORPORATE";
  }
  return "INDIVIDUAL";
}

export function ingestWatchlistFile(
  options: WatchlistImportOptions,
): WatchlistImportResult {
  if (options.buffer.byteLength > 25 * 1024 * 1024) {
    throw new Error("Ukuran file watchlist melebihi 25 MB.");
  }
  if (!VALID_SOURCES.includes(options.sourceCode)) {
    throw new Error("Kode sumber watchlist tidak valid.");
  }
  if (!options.effectiveDate) {
    throw new Error("Tanggal efektif wajib diisi.");
  }

  const parsed = parseSpreadsheet(options.buffer, options.filename);
  const { mapping, missing } = detectWatchlistColumns(parsed.headers);
  if (missing.length) {
    throw new Error(
      `Header wajib tidak ditemukan: ${missing.join(", ")}. Kolom minimal: Source, Entity Name, Aliases, ID / Passport, DOB, POB, Nationality, Legal Basis.`,
    );
  }

  return mutateDatabase((database) => {
    const sourceId = newId("src");
    for (const source of database.watchlist_sources) {
      if (source.source_code === options.sourceCode) {
        source.is_current = false;
      }
    }

    const source: WatchlistSource = {
      id: sourceId,
      source_code: options.sourceCode,
      version_label: options.versionLabel.trim() || options.filename,
      published_by: options.publishedBy.trim() || "OJK",
      effective_date: options.effectiveDate,
      expiry_date: options.expiryDate || null,
      excel_file_name: options.filename,
      uploaded_at: nowIso(),
      uploaded_by_user_id: options.user.id,
      is_current: true,
      notes: `Import Excel master watchlist oleh ${options.user.full_name}.`,
    };

    let imported = 0;
    let aliasCount = 0;
    let documentCount = 0;
    let skipped = 0;
    const errors: Array<{ row: number; reason: string }> = [];
    const seen = new Set<string>();
    const valueAt = (row: unknown[], index: number): string => {
      if (index < 0) return "";
      const value = row[index];
      if (value === null || value === undefined) return "";
      if (value instanceof Date) return value.toISOString().slice(0, 10);
      return String(value).trim();
    };

    parsed.rows.forEach((row, index) => {
      const rowNumber = index + 2;
      const name = normalizeWhitespace(valueAt(row, mapping.entityName));
      if (!name) {
        skipped += 1;
        errors.push({ row: rowNumber, reason: "Entity Name kosong." });
        return;
      }
      const cleanName = sanitizeName(name);
      if (!cleanName) {
        skipped += 1;
        errors.push({
          row: rowNumber,
          reason: "Entity Name tidak valid setelah sanitasi.",
        });
        return;
      }

      const dob = parseDate(valueAt(row, mapping.dob));
      const type = normalizeEntityType(valueAt(row, mapping.entityType));
      const duplicateKey = `${cleanName}::${dob ?? ""}::${type}`;
      if (seen.has(duplicateKey)) {
        skipped += 1;
        errors.push({
          row: rowNumber,
          reason: "Entitas duplikat di dalam file.",
        });
        return;
      }
      seen.add(duplicateKey);

      const entityId = newId("wl");
      const legalReference =
        normalizeWhitespace(valueAt(row, mapping.legalBasis)) ||
        normalizeWhitespace(options.legalBasis ?? "") ||
        `Import ${source.version_label}`;

      database.watchlist_entities.push({
        id: entityId,
        source_id: sourceId,
        entity_type: type,
        primary_name: name,
        clean_primary_name: cleanName,
        date_of_birth: dob,
        place_of_birth:
          normalizeWhitespace(valueAt(row, mapping.pob)) || null,
        nationality:
          normalizeWhitespace(valueAt(row, mapping.nationality)) || null,
        address_info: normalizeWhitespace(valueAt(row, mapping.address)) || null,
        legal_reference: legalReference,
        is_active: true,
        created_at: nowIso(),
      });
      imported += 1;

      const aliases = extractAliases(valueAt(row, mapping.aliases));
      aliases.forEach((aliasName, aliasIndex) => {
        database.watchlist_aliases.push({
          id: newId(`alias-${aliasIndex}`),
          entity_id: entityId,
          alias_name: aliasName,
          clean_alias_name: sanitizeName(aliasName),
          alias_type: "AKA",
        });
        aliasCount += 1;
      });

      const identityNumber = normalizeDocumentNumber(valueAt(row, mapping.idNumber));
      const explicitPassport = normalizeDocumentNumber(
        valueAt(row, mapping.passport),
      );
      if (identityNumber) {
        let documentType: DocumentType = "NATIONAL_ID";
        if (type === "INDIVIDUAL" && isValidNIK(identityNumber)) {
          documentType = "NIK";
        } else if (/[A-Z]/.test(identityNumber) || identityNumber.length < 16) {
          documentType = "PASSPORT";
        }
        database.watchlist_documents.push({
          id: newId("doc"),
          entity_id: entityId,
          document_type: documentType,
          document_number: identityNumber,
          issuing_country: type === "INDIVIDUAL" ? "ID" : "ID",
        });
        documentCount += 1;
      }
      if (explicitPassport && explicitPassport !== identityNumber) {
        database.watchlist_documents.push({
          id: newId("doc"),
          entity_id: entityId,
          document_type: "PASSPORT",
          document_number: explicitPassport,
          issuing_country: "ID",
        });
        documentCount += 1;
      }
    });

    if (imported === 0) {
      throw new Error("Tidak ada entitas valid yang dapat diimpor.");
    }

    database.watchlist_sources.push(source);
    appendAudit(database, options.user, {
      action_name: "IMPORT_WATCHLIST",
      module_name: "WATCHLIST",
      description: `Mengimpor ${options.filename} ke sumber ${source.version_label}.`,
      state_before: null,
      state_after: {
        source_code: source.source_code,
        version_label: source.version_label,
        imported,
        aliases: aliasCount,
        documents: documentCount,
        skipped,
      },
    });

    return {
      source,
      imported,
      aliases: aliasCount,
      documents: documentCount,
      skipped,
      errors: errors.slice(0, 50),
    };
  });
}
