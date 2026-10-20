import { appendAudit, getDatabase, getRequestUser, saveDatabase } from "@/lib/db";
import { createWorkbook } from "@/lib/excel";
import { maskNIK, maskAccount } from "@/lib/crypto";
import { formatDateTimeId, formatCurrency } from "@/lib/normalize";
import { REPORT_LABELS } from "@/lib/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Terbuka",
  IN_ANALYSIS: "Analisis",
  PENDING_APPROVAL: "Menunggu Persetujuan",
  CLOSED: "Selesai",
};

const RECOMMENDATION_LABELS: Record<string, string> = {
  DISMISS_FALSE_POSITIVE: "False Positive",
  CONFIRM_HIT: "Konfirmasi Hit",
  ESCALATE_EDD: "Eskalasi EDD",
};

export async function GET(request: Request) {
  const database = getDatabase();
  const user = getRequestUser(request, database);

  const screeningRows = database.screening_matches
    .slice()
    .sort((a, b) => b.total_confidence_score - a.total_confidence_score)
    .map((match) => {
      const customer = database.staged_customers.find(
        (item) => item.id === match.staged_customer_id,
      );
      const entity = database.watchlist_entities.find(
        (item) => item.id === match.watchlist_entity_id,
      );
      const source = entity
        ? database.watchlist_sources.find((item) => item.id === entity.source_id)
        : undefined;
      const batch = customer
        ? database.batch_uploads.find((item) => item.id === customer.batch_id)
        : undefined;
      const investigation = database.investigation_cases.find(
        (item) => item.screening_match_id === match.id,
      );
      const analyst = investigation
        ? database.users.find(
            (item) => item.id === investigation.assigned_analyst_id,
          )
        : undefined;
      return {
        "Tanggal Screening": formatDateTimeId(match.matched_at),
        "Nomor Batch": batch?.batch_number ?? "—",
        "Nama Nasabah": customer?.raw_full_name ?? "—",
        CIF: customer?.cif_number ?? "—",
        NIK: customer ? maskNIK(customer.national_id_number) : "—",
        "No. Rekening": customer ? maskAccount(customer.account_number) : "—",
        "Profil DTTOT": entity?.primary_name ?? "—",
        "Sumber Sanksi": source?.source_code ?? "—",
        "Versi Watchlist": source?.version_label ?? "—",
        "Skor Kemiripan": match.total_confidence_score,
        Kategori: match.match_severity,
        "Exact Identity": match.is_exact_identity_match ? "Ya" : "Tidak",
        Whitelist: match.is_whitelisted ? "Ya" : "Tidak",
        "Status Kasus": investigation
          ? STATUS_LABELS[investigation.case_status] ?? investigation.case_status
          : "Belum Ditangani",
        "No. Kasus": investigation?.case_number ?? "—",
        Rekomendasi: investigation?.analyst_recommendation
          ? RECOMMENDATION_LABELS[investigation.analyst_recommendation]
          : "—",
        "Petugas Analis": analyst?.full_name ?? "—",
      };
    });

  const scoreRows = database.match_score_breakdowns.map((breakdown) => {
    const match = database.screening_matches.find(
      (item) => item.id === breakdown.screening_match_id,
    );
    const customer = match
      ? database.staged_customers.find(
          (item) => item.id === match.staged_customer_id,
        )
      : undefined;
    return {
      "Match ID": breakdown.screening_match_id,
      "Nama Nasabah": customer?.raw_full_name ?? "—",
      "Nama (50%)": breakdown.name_similarity_score,
      "DOB (25%)": breakdown.dob_match_score,
      "POB (15%)": breakdown.pob_match_score,
      "Kewarganegaraan (10%)": breakdown.nationality_match_score,
      "Matched Alias": breakdown.matched_on_alias ?? "—",
      "Jaro-Winkler": breakdown.algorithm_telemetry.jaro_winkler ?? "—",
      "Token Sort": breakdown.algorithm_telemetry.token_sort_ratio ?? "—",
      "Double Metaphone": breakdown.algorithm_telemetry.phonetic_overlap ?? "—",
    };
  });

  const caseRows = database.investigation_cases.map((investigation) => {
    const match = database.screening_matches.find(
      (item) => item.id === investigation.screening_match_id,
    );
    const customer = match
      ? database.staged_customers.find(
          (item) => item.id === match.staged_customer_id,
        )
      : undefined;
    const approval = database.approval_requests.find(
      (item) => item.case_id === investigation.id,
    );
    return {
      "No. Kasus": investigation.case_number,
      "Nama Nasabah": customer?.raw_full_name ?? "—",
      CIF: customer?.cif_number ?? "—",
      Status: STATUS_LABELS[investigation.case_status],
      Prioritas: investigation.priority,
      Rekomendasi: investigation.analyst_recommendation
        ? RECOMMENDATION_LABELS[investigation.analyst_recommendation]
        : "—",
      "Tahap Approval": approval?.current_step ?? "—",
      Verdict: approval?.final_verdict ?? "—",
      "Dibuka": formatDateTimeId(investigation.opened_at),
      "Ditutup": investigation.closed_at
        ? formatDateTimeId(investigation.closed_at)
        : "—",
    };
  });

  const freezeRows = database.account_freeze_orders.map((freeze) => {
    const investigation = database.investigation_cases.find(
      (item) => item.id === freeze.case_id,
    );
    return {
      "No. Kasus": investigation?.case_number ?? "—",
      CIF: freeze.cif_number,
      Rekening: maskAccount(freeze.account_number),
      "No. Surat Perintah": freeze.legal_warrant_number,
      "Saldo Diblokir": formatCurrency(freeze.total_balance_frozen),
      Status: freeze.freeze_status,
      "Waktu Pemblokiran": formatDateTimeId(freeze.frozen_at),
      "Waktu Pencabutan": freeze.lifted_at
        ? formatDateTimeId(freeze.lifted_at)
        : "—",
    };
  });

  const reportRows = database.regulatory_reports.map((report) => ({
    "No. Referensi": report.reference_number,
    "Jenis Laporan": REPORT_LABELS[report.report_type],
    Status: report.submission_status,
    "Dibuat": formatDateTimeId(report.generated_at),
    "Dikirim": report.submitted_at
      ? formatDateTimeId(report.submitted_at)
      : "—",
  }));

  const auditRows = database.audit_logs
    .slice()
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .map((log) => ({
      Waktu: formatDateTimeId(log.timestamp),
      Pengguna:
        database.users.find((userItem) => userItem.id === log.user_id)
          ?.full_name ?? "—",
      Aksi: log.action_name,
      Modul: log.module_name,
      IP: log.ip_address,
      Deskripsi: log.description,
      "State Before": log.state_before ? JSON.stringify(log.state_before) : "—",
      "State After": log.state_after ? JSON.stringify(log.state_after) : "—",
    }));

  const buffer = createWorkbook([
    { name: "Rekap Screening", rows: screeningRows },
    { name: "Detail Skor", rows: scoreRows },
    { name: "Kasus", rows: caseRows },
    { name: "Pemblokiran", rows: freezeRows },
    { name: "Laporan Regulator", rows: reportRows },
    { name: "Audit Trail", rows: auditRows },
    {
      name: "Metadata",
      rows: [
        {
          Dokumen: "Rekapitulasi Screening APU-PPT & DTTOT",
          Institusi: "PT DIDI MAX BERJANGKA",
          "Kode Dokumen": "DMB-ERD-DaMeL-IT-2410",
          "Dibuat Oleh": user.full_name,
          "Dibuat Pada": formatDateTimeId(new Date().toISOString()),
          Klasifikasi: "Internal",
          "Total Screening": database.screening_matches.length,
          "Total Kasus": database.investigation_cases.length,
        },
      ],
    },
  ]);

  appendAudit(database, user, {
    action_name: "EXPORT_AUDIT",
    module_name: "REPORTING",
    description:
      "Mengekspor rekapitulasi screening, kasus, pemblokiran, dan audit trail ke Excel.",
    state_before: null,
    state_after: {
      export_type: "XLSX",
      screening_rows: screeningRows.length,
      case_rows: caseRows.length,
      audit_rows: auditRows.length,
    },
  });
  saveDatabase(database);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Rekap_Screening_APUPPT_DMB_${new Date().toISOString().slice(0, 10)}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
