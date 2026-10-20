import type {
  DatabaseSchema,
  RegulatoryReport,
  ReportType,
  User,
} from "./types";
import { appendAudit, newId, nowIso } from "./db";
import { maskAccount } from "./crypto";
import { formatDateTimeId, formatCurrency } from "./normalize";

export const REPORT_LABELS: Record<ReportType, string> = {
  LTKM_PPATK: "LTKM PPATK",
  SIPESAT_PEMBLOKIRAN: "SIPESAT Pemblokiran",
  BERKALA_OJK: "Laporan Berkala OJK",
};

function xmlEscape(value: string | number | null | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildReportXml(
  database: DatabaseSchema,
  caseId: string,
  reportType: ReportType,
): string {
  const investigation = database.investigation_cases.find(
    (item) => item.id === caseId,
  );
  if (!investigation) throw new Error("Kasus tidak ditemukan.");
  const match = database.screening_matches.find(
    (item) => item.id === investigation.screening_match_id,
  );
  if (!match) throw new Error("Data screening kasus tidak ditemukan.");
  const customer = database.staged_customers.find(
    (item) => item.id === match.staged_customer_id,
  );
  const entity = database.watchlist_entities.find(
    (item) => item.id === match.watchlist_entity_id,
  );
  const freeze = database.account_freeze_orders.find(
    (item) => item.case_id === caseId,
  );
  const approval = database.approval_requests.find(
    (item) => item.case_id === caseId,
  );
  if (!customer || !entity) throw new Error("Data nasabah/entitas tidak lengkap.");

  const header = `<Header>
    <Institution>PT DIDI MAX BERJANGKA</Institution>
    <InstitutionCode>DMB</InstitutionCode>
    <ReportType>${reportType}</ReportType>
    <GeneratedAt>${xmlEscape(nowIso())}</GeneratedAt>
    <CaseNumber>${xmlEscape(investigation.case_number)}</CaseNumber>
    <Regulator>${reportType === "BERKALA_OJK" ? "OJK" : "PPATK"}</Regulator>
  </Header>`;

  const customerBlock = `<Nasabah>
    <Nama>${xmlEscape(customer.raw_full_name)}</Nama>
    <CIF>${xmlEscape(customer.cif_number)}</CIF>
    <NoRekening>${xmlEscape(maskAccount(customer.account_number))}</NoRekening>
    <TanggalLahir>${xmlEscape(customer.date_of_birth)}</TanggalLahir>
    <TempatLahir>${xmlEscape(customer.place_of_birth)}</TempatLahir>
    <Kewarganegaraan>${xmlEscape(customer.nationality)}</Kewarganegaraan>
  </Nasabah>`;

  const watchlistBlock = `<Watchlist>
    <NamaEntitas>${xmlEscape(entity.primary_name)}</NamaEntitas>
    <TipeEntitas>${xmlEscape(entity.entity_type)}</TipeEntitas>
    <DasarHukum>${xmlEscape(entity.legal_reference)}</DasarHukum>
    <SkorKemiripan>${match.total_confidence_score}</SkorKemiripan>
    <Kategori>${match.match_severity}</Kategori>
  </Watchlist>`;

  if (reportType === "SIPESAT_PEMBLOKIRAN") {
    if (!freeze || freeze.freeze_status !== "ACTIVE_FROZEN") {
      throw new Error("SIPESAT membutuhkan perintah pemblokiran aktif.");
    }
    return `<?xml version="1.0" encoding="UTF-8"?>
<SIPESAT>
  ${header}
  ${customerBlock}
  ${watchlistBlock}
  <Pemblokiran>
    <NoSurat>${xmlEscape(freeze.legal_warrant_number)}</NoSurat>
    <Tanggal>${xmlEscape(freeze.frozen_at.slice(0, 10))}</Tanggal>
    <Saldo>${freeze.total_balance_frozen}</Saldo>
    <Status>${xmlEscape(freeze.freeze_status)}</Status>
  </Pemblokiran>
  <Keputusan>
    <Verdict>${xmlEscape(approval?.final_verdict ?? "CONFIRMED_TERRORIST_HIT")}</Verdict>
    <Alasan>${xmlEscape(approval?.decision_reason ?? "")}</Alasan>
  </Keputusan>
  <DasarHukum>UU No. 9 Tahun 2013 tentang Pencegahan dan Pemberantasan Tindak Pidana Terorisme</DasarHukum>
</SIPESAT>`;
  }

  if (reportType === "LTKM_PPATK") {
    return `<?xml version="1.0" encoding="UTF-8"?>
<LTKM>
  ${header}
  ${customerBlock}
  ${watchlistBlock}
  <Transaksi>
    <TotalNominal>${freeze?.total_balance_frozen ?? 0}</TotalNominal>
    <Kanal>RDN SAHAM</Kanal>
  </Transaksi>
  <Indikasi>
    <Jenis>PENDANAAN_TERORISME</Jenis>
    <Uraian>${xmlEscape(`Nasabah teridentifikasi dalam ${database.watchlist_sources.find((source) => source.id === entity.source_id)?.version_label ?? "daftar sanksi"}.`)}</Uraian>
  </Indikasi>
  <TindakLanjut>${xmlEscape(approval?.decision_reason ?? "")}</TindakLanjut>
  <DasarHukum>POJK No. 8 Tahun 2023 dan UU No. 8 Tahun 2010 tentang Pencegahan dan Pemberantasan Tindak Pidana Pencucian Uang</DasarHukum>
</LTKM>`;
  }

  const start = new Date();
  start.setDate(1);
  return `<?xml version="1.0" encoding="UTF-8"?>
<LaporanBerkala>
  ${header}
  <Periode>${start.toISOString().slice(0, 7)}</Periode>
  ${customerBlock}
  ${watchlistBlock}
  <Rekapitulasi>
    <JumlahScreening>${database.screening_jobs.reduce((sum, job) => sum + job.total_evaluated, 0)}</JumlahScreening>
    <JumlahHit>${database.screening_matches.length}</JumlahHit>
    <KasusDalamProses>${database.investigation_cases.filter((item) => item.case_status !== "CLOSED").length}</KasusDalamProses>
    <PemblokiranAktif>${database.account_freeze_orders.filter((item) => item.freeze_status === "ACTIVE_FROZEN").length}</PemblokiranAktif>
    <TotalSaldoDiblokir>${database.account_freeze_orders.filter((item) => item.freeze_status === "ACTIVE_FROZEN").reduce((sum, item) => sum + item.total_balance_frozen, 0)}</TotalDanaDiblokir>
  </Rekapitulasi>
  <Catatan>Laporan berkala kepatuhan APU-PPT dan DTTOT PT Didi Max Berjangka.</Catatan>
</LaporanBerkala>`;
}

export function createReport(
  database: DatabaseSchema,
  caseId: string,
  reportType: ReportType,
  user: User,
): RegulatoryReport {
  const investigation = database.investigation_cases.find(
    (item) => item.id === caseId,
  );
  if (!investigation) throw new Error("Kasus tidak ditemukan.");
  const approval = database.approval_requests.find(
    (item) => item.case_id === caseId,
  );
  if (
    reportType !== "BERKALA_OJK" &&
    approval?.final_verdict !== "CONFIRMED_TERRORIST_HIT"
  ) {
    throw new Error("Laporan LTKM/SIPESAT hanya dapat dibuat untuk Confirmed Hit.");
  }
  const duplicate = database.regulatory_reports.find(
    (item) =>
      item.case_id === caseId &&
      item.report_type === reportType &&
      item.submission_status !== "SUBMITTED",
  );
  if (duplicate) {
    throw new Error(
      `Draft ${REPORT_LABELS[reportType]} untuk kasus ini sudah ada (${duplicate.reference_number}).`,
    );
  }

  const now = new Date();
  const sequence =
    database.regulatory_reports.filter(
      (item) => item.report_type === reportType,
    ).length + 1;
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const reference =
    reportType === "LTKM_PPATK"
      ? `LTKM/DMB/${year}/${month}/${String(sequence).padStart(3, "0")}`
      : reportType === "SIPESAT_PEMBLOKIRAN"
        ? `SIPESAT/DMB/${year}/${month}/${String(sequence).padStart(3, "0")}`
        : `OJK/DMB/${year}/${month}/BLK-${String(sequence).padStart(3, "0")}`;

  const report: RegulatoryReport = {
    id: newId("report"),
    case_id: caseId,
    report_type: reportType,
    reference_number: reference,
    xml_payload_content: buildReportXml(database, caseId, reportType),
    submission_status: "DRAFT",
    generated_at: nowIso(),
    submitted_at: null,
    reported_by_user_id: user.id,
  };
  database.regulatory_reports.push(report);
  appendAudit(database, user, {
    action_name: "GENERATE_REPORT",
    module_name: "REPORTING",
    description: `Membuat draft ${REPORT_LABELS[reportType]} ${reference}.`,
    state_before: null,
    state_after: {
      reference_number: reference,
      report_type: reportType,
      case_number: investigation.case_number,
      status: "DRAFT",
    },
  });
  return report;
}

export function reportSummaryRows(database: DatabaseSchema): Array<Record<string, unknown>> {
  return database.regulatory_reports.map((report) => {
    const investigation = database.investigation_cases.find(
      (item) => item.id === report.case_id,
    );
    const match = investigation
      ? database.screening_matches.find(
          (item) => item.id === investigation.screening_match_id,
        )
      : undefined;
    const customer = match
      ? database.staged_customers.find(
          (item) => item.id === match.staged_customer_id,
        )
      : undefined;
    return {
      "Nomor Referensi": report.reference_number,
      "Jenis Laporan": REPORT_LABELS[report.report_type],
      "Nomor Kasus": investigation?.case_number ?? "—",
      "Nama Nasabah": customer?.raw_full_name ?? "—",
      Status: report.submission_status,
      "Tanggal Dibuat": formatDateTimeId(report.generated_at),
      "Tanggal Submit": report.submitted_at
        ? formatDateTimeId(report.submitted_at)
        : "—",
      "Saldo Diblokir": formatCurrency(
        database.account_freeze_orders.find(
          (item) => item.case_id === report.case_id,
        )?.total_balance_frozen ?? 0,
      ),
    };
  });
}
