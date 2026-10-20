import type {
  BatchUpload,
  DatabaseSchema,
  EntityType,
  MatchScoreBreakdown,
  ScreeningJob,
  ScreeningMatch,
  StagedCustomer,
  UploadError,
  User,
} from "./types";
import { appendAudit, getDatabase, mutateDatabase, newId, nowIso } from "./db";
import { encryptPII } from "./crypto";
import { generateCustomerProfile } from "./customer-profile";
import {
  detectCustomerColumns,
  parseSpreadsheet,
  type CustomerField,
} from "./excel";
import {
  isValidNIK,
  normalizeWhitespace,
  parseDate,
  sanitizeName,
} from "./normalize";
import { screenCustomers, type MatchCustomerInput } from "./matching";

const MAX_ROWS = 100_000;
const MAX_FILE_SIZE = 50 * 1024 * 1024;

export interface ScreeningUploadResult {
  batch: BatchUpload;
  job: ScreeningJob;
  staged_count: number;
  error_count: number;
  hit_count: number;
  clean_count: number;
  severity: { critical: number; high: number; medium: number; low: number };
  mapping_used: Record<string, number>;
  preview: Array<{
    row: number;
    cif: string;
    name: string;
    nik: string;
    dob: string;
    status: "VALID" | "ERROR";
    error?: string;
  }>;
  errors: Array<{
    row: number;
    column: string;
    reason: string;
  }>;
}

function valueAt(row: unknown[], index: number): string {
  if (index < 0) return "";
  const value = row[index];
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value).trim();
}

function normalizeCustomerType(value: string): EntityType {
  const normalized = sanitizeName(value);
  if (
    ["corporate", "korporasi", "badan", "badan hukum", "perusahaan"].some(
      (token) => normalized.includes(token),
    )
  ) {
    return "CORPORATE";
  }
  return "INDIVIDUAL";
}

function makeBatchNumber(database: DatabaseSchema): string {
  const date = new Date();
  const stamp = [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("");
  const prefix = `BATCH-${stamp}-`;
  const count = database.batch_uploads.filter((batch) =>
    batch.batch_number.startsWith(prefix),
  ).length;
  return `${prefix}${String(count + 1).padStart(3, "0")}`;
}

export function ingestCustomerFile(
  buffer: Buffer,
  filename: string,
  user: User,
): ScreeningUploadResult {
  if (buffer.byteLength > MAX_FILE_SIZE) {
    throw new Error("Ukuran file melebihi 50 MB.");
  }
  const parsed = parseSpreadsheet(buffer, filename);
  if (parsed.rows.length > MAX_ROWS) {
    throw new Error("Jumlah baris melebihi batas 100.000 baris.");
  }
  const { mapping, missing } = detectCustomerColumns(parsed.headers);
  if (missing.length) {
    throw new Error(
      `Header wajib tidak ditemukan: ${missing.join(", ")}. Gunakan template resmi.`,
    );
  }

  const database = mutateDatabase((db) => {
    const batchId = newId("batch");
    const batchNumber = makeBatchNumber(db);
    const staged: StagedCustomer[] = [];
    const errors: UploadError[] = [];
    const matchInputs: MatchCustomerInput[] = [];
    const preview: ScreeningUploadResult["preview"] = [];
    const seenCif = new Set<string>();
    const seenAccount = new Set<string>();

    parsed.rows.forEach((row, index) => {
      const rowNumber = index + 2;
      const rawName = valueAt(row, mapping.fullName);
      const rawNik = valueAt(row, mapping.nationalId);
      const rawAccount = valueAt(row, mapping.account);
      const rawCif = valueAt(row, mapping.cif);
      const rawDob = valueAt(row, mapping.dob);
      const rawType = valueAt(row, mapping.customerType);
      const customerType = normalizeCustomerType(rawType);
      const accountNumber = rawAccount.replace(/\s/g, "");
      const cif = rawCif || `AUTO-${accountNumber.slice(-8)}`;
      const nik = rawNik.replace(/\D/g, "");
      const dob = parseDate(rawDob);
      const cleanName = sanitizeName(rawName);
      const rowIssues: Array<{ column: string; reason: string }> = [];

      if (!rawName) {
        rowIssues.push({ column: "Nama Lengkap", reason: "Nama wajib diisi." });
      } else if (!cleanName) {
        rowIssues.push({
          column: "Nama Lengkap",
          reason: "Nama tidak valid setelah sanitasi.",
        });
      }
      if (!accountNumber) {
        rowIssues.push({
          column: "Nomor Rekening",
          reason: "Nomor rekening wajib diisi.",
        });
      }
      if (rawNik && !isValidNIK(nik)) {
        rowIssues.push({
          column: "NIK",
          reason: "NIK harus tepat 16 digit numerik.",
        });
      }
      if (rawDob && !dob) {
        rowIssues.push({
          column: "Tanggal Lahir",
          reason: "Format tanggal tidak dikenali.",
        });
      }
      if (cif && seenCif.has(cif)) {
        rowIssues.push({
          column: "CIF",
          reason: "CIF duplikat di dalam file.",
        });
      }
      if (accountNumber && seenAccount.has(accountNumber)) {
        rowIssues.push({
          column: "Nomor Rekening",
          reason: "Nomor rekening duplikat di dalam file.",
        });
      }

      if (rowIssues.length) {
        for (const issue of rowIssues) {
          errors.push({
            id: newId("err"),
            batch_id: batchId,
            row_number: rowNumber,
            column_name: issue.column,
            error_reason: issue.reason,
            raw_payload: encryptPII(
              JSON.stringify(
                Object.fromEntries(
                  parsed.headers.map((header, headerIndex) => [
                    header || `kolom_${headerIndex + 1}`,
                    headerIndex === mapping.nationalId
                      ? "••••••••••••••••"
                      : valueAt(row, headerIndex),
                  ]),
                ),
              ),
            ),
          });
        }
        preview.push({
          row: rowNumber,
          cif,
          name: rawName || "(kosong)",
          nik: nik ? `${nik.slice(0, 4)}••••${nik.slice(-4)}` : "—",
          dob: dob ?? "—",
          status: "ERROR",
          error: rowIssues[0].reason,
        });
        return;
      }

      seenCif.add(cif);
      seenAccount.add(accountNumber);
      const customerId = newId("cust");
      const customer: StagedCustomer = {
        id: customerId,
        batch_id: batchId,
        cif_number: cif,
        account_number: encryptPII(accountNumber),
        raw_full_name: normalizeWhitespace(rawName),
        sanitized_full_name: cleanName,
        national_id_number: encryptPII(nik),
        passport_number: valueAt(row, mapping.passport).toUpperCase().trim(),
        date_of_birth: dob ?? "",
        place_of_birth: normalizeWhitespace(valueAt(row, mapping.pob)),
        nationality: normalizeWhitespace(valueAt(row, mapping.nationality)),
        address: normalizeWhitespace(valueAt(row, mapping.address)),
        customer_type: customerType,
        staged_at: nowIso(),
      };
      Object.assign(
        customer,
        generateCustomerProfile({
          id: customer.id,
          raw_full_name: customer.raw_full_name,
          customer_type: customer.customer_type,
          cif_number: customer.cif_number,
        }),
      );
      staged.push(customer);
      matchInputs.push({
        id: customerId,
        cif_number: cif,
        national_id_number: nik,
        passport_number: customer.passport_number,
        raw_full_name: customer.raw_full_name,
        date_of_birth: customer.date_of_birth,
        place_of_birth: customer.place_of_birth,
        nationality: customer.nationality,
        customer_type: customerType,
      });
      preview.push({
        row: rowNumber,
        cif,
        name: rawName,
        nik: nik ? `${nik.slice(0, 4)}••••${nik.slice(-4)}` : "—",
        dob: dob ?? "—",
        status: "VALID",
      });
    });

    const batch: BatchUpload = {
      id: batchId,
      batch_number: batchNumber,
      original_filename: filename,
      total_records: parsed.rows.length,
      valid_records: staged.length,
      error_records: errors.length,
      upload_status: "PROCESSED",
      uploaded_by_user_id: user.id,
      created_at: nowIso(),
      completed_at: nowIso(),
    };

    const jobId = newId("job");
    const startedAt = nowIso();
    const activeEntities = db.watchlist_entities.filter(
      (entity) => entity.is_active,
    );
    const drafts = screenCustomers(
      matchInputs,
      activeEntities,
      db.watchlist_aliases,
      db.watchlist_documents,
      db.whitelist_records,
      70,
    );

    const matches: ScreeningMatch[] = drafts.map((draft) => ({
      id: newId("match"),
      job_id: jobId,
      staged_customer_id: draft.staged_customer_id,
      watchlist_entity_id: draft.watchlist_entity_id,
      total_confidence_score: draft.total_confidence_score,
      match_severity: draft.match_severity,
      is_exact_identity_match: draft.is_exact_identity_match,
      is_whitelisted: draft.is_whitelisted,
      matched_at: nowIso(),
    }));

    const breakdowns: MatchScoreBreakdown[] = drafts.map((draft, index) => ({
      id: newId("breakdown"),
      screening_match_id: matches[index].id,
      name_similarity_score: draft.breakdown.name_similarity_score,
      dob_match_score: draft.breakdown.dob_match_score,
      pob_match_score: draft.breakdown.pob_match_score,
      nationality_match_score: draft.breakdown.nationality_match_score,
      matched_on_alias: draft.breakdown.matched_on_alias,
      algorithm_telemetry: draft.breakdown.algorithm_telemetry,
    }));

    const job: ScreeningJob = {
      id: jobId,
      batch_id: batchId,
      job_status: "COMPLETED",
      total_evaluated: staged.length,
      total_hits: matches.length,
      min_threshold_used: 70,
      started_at: startedAt,
      finished_at: nowIso(),
      triggered_by_user_id: user.id,
    };

    db.batch_uploads.push(batch);
    db.staged_customers.push(...staged);
    db.upload_errors.push(...errors);
    db.screening_jobs.push(job);
    db.screening_matches.push(...matches);
    db.match_score_breakdowns.push(...breakdowns);

    appendAudit(db, user, {
      action_name: "UPLOAD_AND_SCREEN",
      module_name: "SCREENING",
      description: `Mengunggah ${filename} (${parsed.rows.length} baris) dan menjalankan smart matching.`,
      state_before: null,
      state_after: {
        batch_number: batchNumber,
        valid_records: staged.length,
        error_records: errors.length,
        total_hits: matches.length,
        threshold: 70,
      },
    });

    const severity = {
      critical: matches.filter((match) => match.match_severity === "CRITICAL").length,
      high: matches.filter((match) => match.match_severity === "HIGH").length,
      medium: matches.filter((match) => match.match_severity === "MEDIUM").length,
      low: matches.filter((match) => match.match_severity === "LOW").length,
    };

    return {
      batch,
      job,
      staged_count: staged.length,
      error_count: errors.length,
      hit_count: matches.length,
      clean_count: staged.length - new Set(
        matches.map((match) => match.staged_customer_id),
      ).size,
      severity,
      mapping_used: mapping as Record<string, number>,
      preview: preview.slice(0, 50),
      errors: errors.slice(0, 50).map((error) => ({
        row: error.row_number,
        column: error.column_name,
        reason: error.error_reason,
      })),
    };
  });

  return database;
}

export function customerColumnLabels(): Record<CustomerField, string> {
  return {
    cif: "CIF",
    account: "Nomor Rekening",
    fullName: "Nama Lengkap",
    nationalId: "NIK",
    passport: "Paspor",
    dob: "Tanggal Lahir",
    pob: "Tempat Lahir",
    nationality: "Kewarganegaraan",
    address: "Alamat",
    customerType: "Tipe Nasabah",
    taxId: "NPWP",
  };
}

export function rebuildDemoCounts(): void {
  const database = getDatabase();
  for (const batch of database.batch_uploads) {
    const job = database.screening_jobs.find((item) => item.batch_id === batch.id);
    if (job) {
      job.total_evaluated = batch.valid_records;
      job.total_hits = database.screening_matches.filter(
        (match) => match.job_id === job.id,
      ).length;
    }
  }
}
