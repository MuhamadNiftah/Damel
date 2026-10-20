"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  Copy,
  Download,
  FileSpreadsheet,
  FileText,
  Flag,
  LockKeyhole,
  Plus,
  RefreshCw,
  ScrollText,
  Send,
  ShieldCheck,
  Snowflake,
  WalletCards,
} from "lucide-react";
import type {
  CaseListItem,
  DashboardData,
  FreezeStatus,
  ReportListItem,
  ReportStatus,
  ReportType,
} from "@/lib/types";
import { formatCurrency, formatDateTimeId } from "@/lib/normalize";
import {
  REPORT_STATUS_META,
  REPORT_TYPE_META,
  SEVERITY_META,
  clsx,
} from "@/lib/ui";
import { useDemoUser } from "@/components/user-provider";
import { useToast } from "@/components/toast-provider";
import {
  Alert,
  EmptyState,
  Field,
  MetricCard,
  Modal,
  PageHeader,
  Skeleton,
  Tabs,
} from "@/components/ui";

interface ConfirmedCaseView extends CaseListItem {
  freeze_status: FreezeStatus | null;
  balance_frozen: number;
  legal_warrant_number: string | null;
  existing_reports: Array<{
    id: string;
    type: ReportType;
    status: ReportStatus;
    reference: string;
  }>;
}

interface ReportsResponse {
  items: ReportListItem[];
  summaryRows: Array<Record<string, unknown>>;
  labels: Record<ReportType, string>;
  confirmedCases: ConfirmedCaseView[];
  metrics: {
    total: number;
    drafts: number;
    ready: number;
    submitted: number;
    confirmedCases: number;
    generatedThisMonth: number;
    frozenBalance: number;
  };
}

const REPORT_ICONS: Record<ReportType, ReactNode> = {
  LTKM_PPATK: <Flag size={15} />,
  SIPESAT_PEMBLOKIRAN: <Snowflake size={15} />,
  BERKALA_OJK: <BarChart3 size={15} />,
};

const REPORT_TYPES: ReportType[] = [
  "LTKM_PPATK",
  "SIPESAT_PEMBLOKIRAN",
  "BERKALA_OJK",
];

const SUMMARY_COLUMNS = [
  "Nomor Referensi",
  "Jenis Laporan",
  "Nomor Kasus",
  "Nama Nasabah",
  "Status",
  "Tanggal Dibuat",
  "Tanggal Submit",
  "Saldo Diblokir",
];

function fileSafe(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, "_");
}

export default function ReportsPage() {
  const { user, apiFetch, downloadFile } = useDemoUser();
  const toast = useToast();
  const [data, setData] = useState<ReportsResponse | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"register" | "confirmed" | "rekap" | "eksekutif">(
    "register",
  );
  const [statusFilter, setStatusFilter] = useState<"all" | ReportStatus>("all");
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [exporting, setExporting] = useState(false);

  const [preview, setPreview] = useState<ReportListItem | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createCaseId, setCreateCaseId] = useState("");
  const [createType, setCreateType] = useState<ReportType>("LTKM_PPATK");
  const [creating, setCreating] = useState(false);

  const [actionTarget, setActionTarget] = useState<{
    report: ReportListItem;
    action: "MARK_READY" | "SUBMIT";
  } | null>(null);
  const [acting, setActing] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiFetch<ReportsResponse>("/api/reports")
      .then((payload) => {
        if (active) setData(payload);
      })
      .catch((error) =>
        toast.error("Gagal memuat laporan", (error as Error).message),
      )
      .finally(() => {
        if (active) setLoading(false);
      });
    apiFetch<DashboardData>("/api/dashboard")
      .then((payload) => {
        if (active) setDashboard(payload);
      })
      .catch(() => {
        // Executive summary is optional; report register remains usable.
      });
    return () => {
      active = false;
    };
  }, [apiFetch, refreshIndex, toast]);

  function refresh() {
    setRefreshIndex((index) => index + 1);
  }

  const filteredReports = useMemo(() => {
    if (!data) return [];
    if (statusFilter === "all") return data.items;
    return data.items.filter((item) => item.submission_status === statusFilter);
  }, [data, statusFilter]);

  const typeCounts = useMemo(
    () =>
      REPORT_TYPES.map((type) => ({
        type,
        count: data?.items.filter((item) => item.report_type === type).length ?? 0,
      })),
    [data],
  );

  const topConfirmed = useMemo(
    () =>
      (data?.confirmedCases ?? [])
        .slice()
        .sort((a, b) => b.score - a.score)
        .slice(0, 5),
    [data],
  );

  const execPeriod = new Intl.DateTimeFormat("id-ID", {
    month: "long",
    year: "numeric",
  }).format(new Date());

  const selectedCase =
    data?.confirmedCases.find((item) => item.id === createCaseId) ?? null;
  const existingTypes = new Set(
    selectedCase?.existing_reports
      .filter((item) => item.status !== "SUBMITTED")
      .map((item) => item.type) ?? [],
  );
  const canCreate = Boolean(
    createCaseId && !existingTypes.has(createType) && !creating,
  );

  function openCreate(caseId?: string, type?: ReportType) {
    const fallbackCase = data?.confirmedCases[0]?.id ?? "";
    setCreateCaseId(caseId ?? fallbackCase);
    setCreateType(type ?? "LTKM_PPATK");
    setCreateOpen(true);
  }

  async function generateReport() {
    if (!createCaseId) {
      toast.error("Pilih kasus confirmed hit terlebih dahulu.");
      return;
    }
    setCreating(true);
    try {
      const payload = await apiFetch<{ message: string }>("/api/reports", {
        method: "POST",
        body: JSON.stringify({
          case_id: createCaseId,
          report_type: createType,
        }),
      });
      toast.success("Draft laporan dibuat", payload.message);
      setCreateOpen(false);
      refresh();
    } catch (error) {
      toast.error("Gagal membuat laporan", (error as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function updateStatus() {
    if (!actionTarget) return;
    setActing(true);
    try {
      const payload = await apiFetch<{ message: string }>(
        `/api/reports/${actionTarget.report.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({ action: actionTarget.action }),
        },
      );
      toast.success("Status laporan diperbarui", payload.message);
      setActionTarget(null);
      refresh();
    } catch (error) {
      toast.error("Gagal memperbarui laporan", (error as Error).message);
    } finally {
      setActing(false);
    }
  }

  async function downloadXml(report: ReportListItem) {
    try {
      await downloadFile(
        `/api/reports/${report.id}/download`,
        `${fileSafe(report.reference_number)}.xml`,
      );
      toast.success(
        "XML diunduh",
        `${REPORT_TYPE_META[report.report_type].short} siap diunggah ke portal regulator.`,
      );
    } catch (error) {
      toast.error("Unduhan gagal", (error as Error).message);
    }
  }

  async function exportExcel() {
    setExporting(true);
    try {
      await downloadFile(
        "/api/export/screening",
        "Rekap_Screening_APUPPT_DMB.xlsx",
      );
      toast.success(
        "Rekap OJK diunduh",
        "Workbook berisi ringkasan screening, kasus, pemblokiran, dan laporan.",
      );
    } catch (error) {
      toast.error("Export gagal", (error as Error).message);
    } finally {
      setExporting(false);
    }
  }

  async function copyXml(xml: string) {
    try {
      await navigator.clipboard.writeText(xml);
      toast.success("XML disalin", "Payload siap ditempel ke sistem regulator.");
    } catch {
      toast.error("Gagal menyalin", "Browser memblokir akses clipboard.");
    }
  }

  const metrics = data?.metrics;
  const isApprover = user.role_code === "APPROVER_HEAD";
  const isAuditor = user.role_code === "AUDITOR";

  return (
    <div>
      <PageHeader
        eyebrow="Tata Kelola"
        title="Laporan Kepatuhan"
        description="Generator laporan LTKM PPATK, SIPESAT pemblokiran, dan laporan berkala OJK dengan kontrol maker-checker serta jejak audit yang tidak dapat diubah."
        icon={<ScrollText size={19} />}
        actions={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={refresh}
              disabled={loading}
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={exportExcel}
              disabled={exporting}
            >
              <FileSpreadsheet size={14} />
              {exporting ? "Menyiapkan..." : "Export Excel OJK"}
            </button>
            <button
              type="button"
              className="btn btn-dark"
              onClick={() => openCreate()}
              disabled={!data?.confirmedCases.length}
            >
              <Plus size={14} /> Buat laporan
            </button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total laporan"
          value={metrics?.total ?? "—"}
          sub={`${metrics?.generatedThisMonth ?? 0} dibuat bulan ini`}
          icon={<FileText size={17} />}
          tone="brand"
          delay="stagger-1"
        />
        <MetricCard
          label="Draft"
          value={metrics?.drafts ?? "—"}
          sub="Perlu verifikasi kelengkapan"
          icon={<Clock3 size={17} />}
          tone="ink"
          delay="stagger-2"
        />
        <MetricCard
          label="Siap kirim"
          value={metrics?.ready ?? "—"}
          sub="Menunggu tanda tangan Approver"
          icon={<Send size={17} />}
          tone="medium"
          delay="stagger-3"
        />
        <MetricCard
          label="Terkirim"
          value={metrics?.submitted ?? "—"}
          sub={`${metrics?.confirmedCases ?? 0} confirmed hit terpantau`}
          icon={<CheckCircle2 size={17} />}
          tone="clean"
          delay="stagger-4"
        />
      </div>

      {!isApprover ? (
        <div className="mt-3">
          <Alert variant="warning" icon={<LockKeyhole size={15} />}>
            Anda masuk sebagai{" "}
            <strong>
              {user.role_code === "CHECKER_SUPERVISOR"
                ? "Checker / Supervisor"
                : user.role_code === "AUDITOR"
                  ? "Auditor"
                  : "Maker / Analis"}
            </strong>
            . Pembuatan draft dan penandaan siap kirim dapat dilakukan, namun
            pengiriman ke regulator hanya dapat dilakukan oleh persona{" "}
            <strong>Approver / Compliance Head</strong>.
          </Alert>
        </div>
      ) : null}

      <div className="mt-3 grid gap-3 lg:grid-cols-[1.6fr_1fr]">
        <section className="hero-panel p-4">
          <div className="relative z-10 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-[0.6rem] font-bold uppercase tracking-[0.16em] text-brand-700">
                Kewajiban pelaporan
              </p>
              <p className="mt-1 text-[0.92rem] font-extrabold text-ink-900">
                POJK No. 8 Tahun 2023 · UU TPPT No. 9/2013
              </p>
              <p className="mt-1 max-w-lg text-[0.7rem] leading-relaxed text-slate-500">
                LTKM wajib disampaikan kepada PPATK segera setelah transaksi
                mencurigakan teridentifikasi. Pemblokiran serta-merta dilaporkan
                melalui SIPESAT dengan menyertakan nomor surat perintah.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-1.5 rounded-xl border border-line bg-white/80 px-3 py-2 text-[0.63rem]">
              <span className="flex items-center gap-1.5 font-semibold text-ink-800">
                <ShieldCheck size={13} className="text-brand-700" /> Review
                berjenjang aktif
              </span>
              <span className="flex items-center gap-1.5 text-slate-500">
                <LockKeyhole size={12} /> Audit trail WORM
              </span>
              <span className="flex items-center gap-1.5 text-slate-500">
                <WalletCards size={12} />{" "}
                {formatCurrency(metrics?.frozenBalance ?? 0)} diblokir
              </span>
            </div>
          </div>
        </section>

        <section className="card p-4">
          <p className="text-[0.68rem] font-bold uppercase tracking-wider text-slate-400">
            Kanal pelaporan
          </p>
          <div className="mt-2 space-y-1.5">
            {REPORT_TYPES.map((type) => (
              <div
                key={type}
                className="flex items-center gap-2 rounded-lg border border-line bg-slate-50/70 px-2.5 py-1.5"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white text-brand-700 shadow-sm">
                  {REPORT_ICONS[type]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[0.68rem] font-bold text-ink-800">
                    {REPORT_TYPE_META[type].label}
                  </p>
                  <p className="truncate text-[0.56rem] text-slate-400">
                    {type === "BERKALA_OJK"
                      ? "OJK · periode bulanan"
                      : "PPATK · XML draft"}
                  </p>
                </div>
                <span className="mono text-[0.55rem] text-slate-400">
                  XML
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section className="mt-4">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { value: "register", label: "Register laporan", count: metrics?.total },
              {
                value: "confirmed",
                label: "Confirmed hit",
                count: metrics?.confirmedCases,
              },
              { value: "eksekutif", label: "Laporan eksekutif" },
              { value: "rekap", label: "Rekap regulator" },
            ]}
          />
          {tab === "register" ? (
            <select
              className="select h-9 w-auto min-w-[150px] py-1.5 text-[0.71rem]"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value as "all" | ReportStatus)
              }
            >
              <option value="all">Semua status</option>
              <option value="DRAFT">Draft</option>
              <option value="READY_TO_SEND">Siap kirim</option>
              <option value="SUBMITTED">Terkirim</option>
            </select>
          ) : null}
        </div>

        {tab === "register" ? (
          <div className="card overflow-hidden">
            {loading && !data ? (
              <div className="space-y-2 p-3">
                {[0, 1, 2, 3].map((index) => (
                  <Skeleton key={index} className="h-14 w-full" />
                ))}
              </div>
            ) : filteredReports.length ? (
              <div className="overflow-x-auto">
                <table className="data-table min-w-[1100px]">
                  <thead>
                    <tr>
                      <th>Referensi</th>
                      <th>Jenis</th>
                      <th>Kasus</th>
                      <th>Nasabah</th>
                      <th>Skor</th>
                      <th>Status</th>
                      <th>Dibuat</th>
                      <th>Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReports.map((report) => {
                      const status = REPORT_STATUS_META[report.submission_status];
                      const type = REPORT_TYPE_META[report.report_type];
                      return (
                        <tr key={report.id}>
                          <td>
                            <p className="primary-cell mono text-[0.64rem]">
                              {report.reference_number}
                            </p>
                            <p className="mt-0.5 text-[0.57rem] text-slate-400">
                              oleh {report.generated_by_name}
                            </p>
                          </td>
                          <td>
                            <span className="flex items-center gap-1.5 text-[0.7rem] font-semibold text-ink-800">
                              {REPORT_ICONS[report.report_type]}
                              {type.short}
                            </span>
                            <p className="mt-0.5 max-w-[160px] truncate text-[0.57rem] text-slate-400">
                              {type.label}
                            </p>
                          </td>
                          <td className="mono text-[0.63rem] text-slate-500">
                            {report.case_number}
                          </td>
                          <td>
                            <p className="text-[0.72rem] font-semibold text-ink-900">
                              {report.customer_name}
                            </p>
                            <p className="mt-0.5 max-w-[170px] truncate text-[0.58rem] text-slate-400">
                              vs {report.entity_name}
                            </p>
                          </td>
                          <td>
                            <div className="flex items-center gap-1.5">
                              <span className="text-[0.75rem] font-extrabold text-ink-900">
                                {Math.round(report.score)}%
                              </span>
                              <span
                                className="h-1.5 w-1.5 rounded-full"
                                style={{ background: "#d92d20" }}
                              />
                            </div>
                          </td>
                          <td>
                            <span className={clsx("badge", status.className)}>
                              {status.label}
                            </span>
                            {report.submitted_at ? (
                              <p className="mt-1 text-[0.56rem] text-slate-400">
                                {formatDateTimeId(report.submitted_at)}
                              </p>
                            ) : null}
                          </td>
                          <td className="text-[0.62rem] text-slate-500">
                            {formatDateTimeId(report.generated_at)}
                          </td>
                          <td>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => setPreview(report)}
                                title="Pratinjau XML"
                              >
                                <FileText size={12} /> XML
                              </button>
                              {report.submission_status === "DRAFT" ? (
                                <button
                                  type="button"
                                  className="btn btn-secondary btn-sm"
                                  disabled={isAuditor}
                                  title={
                                    isAuditor
                                      ? "Auditor tidak dapat mengubah status"
                                      : undefined
                                  }
                                  onClick={() =>
                                    setActionTarget({
                                      report,
                                      action: "MARK_READY",
                                    })
                                  }
                                >
                                  <CheckCircle2 size={12} /> Siap
                                </button>
                              ) : null}
                              {report.submission_status === "READY_TO_SEND" ? (
                                <button
                                  type="button"
                                  className="btn btn-primary btn-sm"
                                  disabled={!isApprover}
                                  title={
                                    isApprover
                                      ? undefined
                                      : "Ganti persona ke Approver untuk mengirim"
                                  }
                                  onClick={() =>
                                    setActionTarget({
                                      report,
                                      action: "SUBMIT",
                                    })
                                  }
                                >
                                  <Send size={12} /> Kirim
                                </button>
                              ) : null}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                icon={<ScrollText size={22} />}
                title="Belum ada laporan"
                description="Buat draft laporan dari kasus yang telah berstatus Confirmed Hit."
                action={
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => openCreate()}
                    disabled={!data?.confirmedCases.length}
                  >
                    <Plus size={12} /> Buat laporan
                  </button>
                }
              />
            )}
          </div>
        ) : null}

        {tab === "confirmed" ? (
          <div className="space-y-3">
            <Alert variant="info" icon={<ShieldCheck size={15} />}>
              Daftar kasus dengan verdict final{" "}
              <strong>Confirmed Terrorist Hit</strong>. Setiap kasus idealnya
              memiliki LTKM kepada PPATK, SIPESAT bila rekening diblokir, dan
              masuk rekap laporan berkala OJK.
            </Alert>
            {data?.confirmedCases.length ? (
              <div className="grid gap-3 lg:grid-cols-2">
                {data.confirmedCases.map((item) => {
                  const activeTypes = new Set(
                    item.existing_reports
                      .filter((report) => report.status !== "SUBMITTED")
                      .map((report) => report.type),
                  );
                  return (
                    <article key={item.id} className="card p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="mono text-[0.6rem] text-slate-400">
                              {item.case_number}
                            </span>
                            <span className="badge badge-critical">
                              Confirmed hit
                            </span>
                            {item.freeze_status === "ACTIVE_FROZEN" ? (
                              <span className="badge badge-info">
                                <Snowflake size={9} /> Frozen
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-1 text-[0.82rem] font-bold text-ink-900">
                            {item.customer_name}
                          </p>
                          <p className="mt-0.5 text-[0.65rem] text-slate-500">
                            vs {item.entity_name} ·{" "}
                            <span className="mono">{item.source_code}</span>
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-[1.1rem] font-extrabold leading-none text-red-600">
                            {Math.round(item.score)}%
                          </p>
                          <p className="mt-0.5 text-[0.55rem] font-bold uppercase tracking-wider text-slate-400">
                            {SEVERITY_META[item.severity].label}
                          </p>
                        </div>
                      </div>

                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        <div className="rounded-lg border border-line bg-slate-50/70 px-2.5 py-2">
                          <p className="text-[0.55rem] font-bold uppercase tracking-wider text-slate-400">
                            Saldo diblokir
                          </p>
                          <p className="mt-0.5 text-[0.74rem] font-extrabold text-ink-900">
                            {formatCurrency(item.balance_frozen)}
                          </p>
                          <p className="mono mt-0.5 truncate text-[0.55rem] text-slate-400">
                            {item.legal_warrant_number ?? "Belum ada surat"}
                          </p>
                        </div>
                        <div className="rounded-lg border border-line bg-slate-50/70 px-2.5 py-2">
                          <p className="text-[0.55rem] font-bold uppercase tracking-wider text-slate-400">
                            Laporan terkait
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            {item.existing_reports.length ? (
                              item.existing_reports.map((report) => (
                                <span
                                  key={report.id}
                                  className={clsx(
                                    "badge !px-1.5 !py-0 text-[0.52rem]",
                                    REPORT_STATUS_META[report.status]
                                      .className,
                                  )}
                                  title={report.reference}
                                >
                                  {REPORT_TYPE_META[report.type].short}
                                </span>
                              ))
                            ) : (
                              <span className="text-[0.6rem] text-slate-400">
                                Belum ada
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {REPORT_TYPES.map((type) => {
                          const exists = activeTypes.has(type);
                          return (
                            <button
                              key={type}
                              type="button"
                              className="btn btn-secondary btn-sm"
                              disabled={
                                exists ||
                                isAuditor ||
                                (type === "SIPESAT_PEMBLOKIRAN" &&
                                  item.freeze_status !== "ACTIVE_FROZEN")
                              }
                              title={
                                exists
                                  ? "Draft atau laporan aktif sudah ada"
                                  : type === "SIPESAT_PEMBLOKIRAN" &&
                                      item.freeze_status !== "ACTIVE_FROZEN"
                                    ? "Membutuhkan perintah pemblokiran aktif"
                                    : undefined
                              }
                              onClick={() => openCreate(item.id, type)}
                            >
                              {REPORT_ICONS[type]}
                              {REPORT_TYPE_META[type].short}
                            </button>
                          );
                        })}
                        <Link
                          href={`/cases?case=${item.id}`}
                          className="btn btn-ghost btn-sm ml-auto"
                        >
                          Buka kasus <ArrowRight size={11} />
                        </Link>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : (
              <div className="card">
                <EmptyState
                  icon={<ShieldCheck size={22} />}
                  title="Belum ada confirmed hit"
                  description="Laporan LTKM dan SIPESAT hanya dapat diterbitkan setelah Approver menetapkan Confirmed Terrorist Hit."
                  action={
                    <Link href="/cases" className="btn btn-secondary btn-sm">
                      Buka persetujuan <ArrowRight size={12} />
                    </Link>
                  }
                />
              </div>
            )}
          </div>
        ) : null}

        {tab === "rekap" ? (
          <div className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3.5">
              <div>
                <p className="text-[0.82rem] font-bold text-ink-900">
                  Rekapitulasi laporan regulator
                </p>
                <p className="mt-0.5 text-[0.68rem] text-slate-500">
                  Pratinjau isi sheet laporan pada workbook rekap OJK.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={exportExcel}
                disabled={exporting}
              >
                <Download size={12} /> Unduh workbook
              </button>
            </div>
            {data?.summaryRows.length ? (
              <div className="overflow-x-auto">
                <table className="data-table min-w-[1000px]">
                  <thead>
                    <tr>
                      {SUMMARY_COLUMNS.map((column) => (
                        <th key={column}>{column}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.summaryRows.map((row, index) => (
                      <tr key={String(row["Nomor Referensi"] ?? index)}>
                        <td className="primary-cell mono text-[0.62rem]">
                          {String(row["Nomor Referensi"] ?? "—")}
                        </td>
                        <td className="text-[0.68rem] text-slate-600">
                          {String(row["Jenis Laporan"] ?? "—")}
                        </td>
                        <td className="mono text-[0.62rem] text-slate-500">
                          {String(row["Nomor Kasus"] ?? "—")}
                        </td>
                        <td className="text-[0.7rem] font-semibold text-ink-800">
                          {String(row["Nama Nasabah"] ?? "—")}
                        </td>
                        <td>
                          <span
                            className={clsx(
                              "badge",
                              REPORT_STATUS_META[
                                String(row["Status"]) as ReportStatus
                              ]?.className ?? "badge-neutral",
                            )}
                          >
                            {REPORT_STATUS_META[
                              String(row["Status"]) as ReportStatus
                            ]?.label ?? String(row["Status"] ?? "—")}
                          </span>
                        </td>
                        <td className="text-[0.62rem] text-slate-500">
                          {String(row["Tanggal Dibuat"] ?? "—")}
                        </td>
                        <td className="text-[0.62rem] text-slate-500">
                          {String(row["Tanggal Submit"] ?? "—")}
                        </td>
                        <td className="text-[0.68rem] font-semibold text-ink-800">
                          {String(row["Saldo Diblokir"] ?? "—")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                icon={<FileSpreadsheet size={22} />}
                title="Rekap masih kosong"
                description="Buat laporan pertama untuk melihat ringkasan rekap regulator."
              />
            )}
          </div>
        ) : null}

        {tab === "eksekutif" ? (
          <div className="space-y-3">
            <div className="card p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[0.66rem] font-bold uppercase tracking-[0.1em] text-brand-700">
                    Laporan eksekutif · {execPeriod}
                  </p>
                  <p className="mt-1 text-[1rem] font-extrabold text-ink-900">
                    Ringkasan kepatuhan APU-PPT & DTTOT
                  </p>
                  <p className="mt-0.5 max-w-2xl text-[0.7rem] leading-relaxed text-slate-500">
                    Ikhtisar data nasabah, cakupan watchlist, temuan, pemblokiran,
                    dan status pelaporan regulator untuk manajemen.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 no-print">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => window.print()}
                  >
                    <FileText size={13} /> Cetak ringkasan
                  </button>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={exportExcel}
                    disabled={exporting}
                  >
                    <Download size={13} /> Ekspor data
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
                {[
                  {
                    label: "Nasabah terdaftar",
                    value: dashboard?.dataUniverse.customers ?? 0,
                    note: `Kualitas rata-rata ${dashboard?.dataUniverse.averageQuality ?? 0}/100`,
                  },
                  {
                    label: "Entitas DTTOT",
                    value: dashboard?.dataUniverse.dttotEntities ?? 0,
                    note: `${dashboard?.dataUniverse.dttotSources ?? 0} versi sumber aktif`,
                  },
                  {
                    label: "Entitas APU-PPT",
                    value: dashboard?.dataUniverse.apupptEntities ?? 0,
                    note: `${dashboard?.dataUniverse.apupptSources ?? 0} sumber aktif`,
                  },
                  {
                    label: "Suspect critical/high",
                    value: dashboard?.metrics.suspect ?? 0,
                    note: `${dashboard?.metrics.frozenAccounts ?? 0} rekening diblokir`,
                  },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-line bg-slate-50/60 p-3">
                    <p className="text-[0.6rem] font-bold uppercase tracking-[0.07em] text-slate-500">
                      {item.label}
                    </p>
                    <p className="mt-1 text-[1.2rem] font-extrabold text-ink-900">
                      {item.value}
                    </p>
                    <p className="mt-0.5 text-[0.61rem] text-slate-400">{item.note}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid gap-3 xl:grid-cols-[1.2fr_1fr]">
              <div className="card p-4">
                <p className="text-[0.78rem] font-bold text-ink-900">Poin utama</p>
                <ul className="mt-2.5 space-y-2 text-[0.72rem] leading-relaxed text-slate-600">
                  <li className="flex gap-2">
                    <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-600" />
                    <span>
                      <strong>{metrics?.total ?? 0} laporan regulator</strong> tercatat,{" "}
                      {metrics?.submitted ?? 0} terkirim dan {metrics?.drafts ?? 0} masih
                      draft. {metrics?.ready ?? 0} laporan siap dikirim.
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <ShieldCheck size={14} className="mt-0.5 shrink-0 text-brand-600" />
                    <span>
                      <strong>{metrics?.confirmedCases ?? 0} confirmed hit</strong> dengan
                      total saldo diblokir{" "}
                      <strong>{formatCurrency(metrics?.frozenBalance ?? 0)}</strong>.
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <BarChart3 size={14} className="mt-0.5 shrink-0 text-violet-600" />
                    <span>
                      Cakupan watchlist mencakup{" "}
                      <strong>
                        {(dashboard?.dataUniverse.dttotEntities ?? 0) +
                          (dashboard?.dataUniverse.apupptEntities ?? 0)}{" "}
                        entitas
                      </strong>{" "}
                      dari DTTOT, DPPSPM, PEP, dan sanksi internasional.
                    </span>
                  </li>
                  <li className="flex gap-2">
                    <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600" />
                    <span>
                      {dashboard?.metrics.openCases ?? 0} kasus masih berjalan;{" "}
                      {dashboard?.casePipeline.find(
                        (item) => item.stage === "PENDING_APPROVAL",
                      )?.count ?? 0}{" "}
                      menunggu keputusan approver.
                    </span>
                  </li>
                </ul>
                <div className="mt-3 rounded-lg border border-line bg-slate-50 px-3 py-2 text-[0.63rem] leading-relaxed text-slate-500">
                  Disusun sesuai POJK No. 8 Tahun 2023, UU No. 9 Tahun 2013, dan
                  ketentuan pelaporan PPATK. Angka merupakan snapshot data demo per{" "}
                  {formatDateTimeId(new Date().toISOString())}.
                </div>
              </div>

              <div className="card p-4">
                <p className="text-[0.78rem] font-bold text-ink-900">
                  Komposisi temuan
                </p>
                <p className="mt-0.5 text-[0.65rem] text-slate-500">
                  Distribusi severity match aktif (non-whitelist).
                </p>
                <div className="mt-3 space-y-3">
                  {dashboard?.severityDistribution.map((item) => {
                    const max = Math.max(
                      1,
                      ...dashboard.severityDistribution.map((entry) => entry.value),
                    );
                    return (
                      <div key={item.name}>
                        <div className="flex items-center justify-between text-[0.68rem]">
                          <span className="flex items-center gap-1.5 font-semibold text-ink-800">
                            <span
                              className="h-2 w-2 rounded-full"
                              style={{ background: item.color }}
                            />
                            {item.name}
                          </span>
                          <span className="mono font-bold text-ink-900">{item.value}</span>
                        </div>
                        <div className="mt-1 progress-track">
                          <div
                            className="progress-bar"
                            style={{
                              width: `${Math.round((item.value / max) * 100)}%`,
                              background: item.color,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line pt-3">
                  {typeCounts.map((item) => (
                    <div key={item.type} className="text-center">
                      <p className="text-[1rem] font-extrabold text-ink-900">{item.count}</p>
                      <p className="mt-0.5 text-[0.58rem] leading-tight text-slate-400">
                        {REPORT_TYPE_META[item.type].short}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="card overflow-hidden">
              <div className="flex items-center justify-between border-b border-line px-4 py-3">
                <div>
                  <p className="text-[0.78rem] font-bold text-ink-900">
                    Confirmed hit prioritas
                  </p>
                  <p className="mt-0.5 text-[0.65rem] text-slate-500">
                    Kasus dengan skor tertinggi yang memerlukan laporan regulator.
                  </p>
                </div>
                <Link href="/cases" className="btn btn-secondary btn-sm no-print">
                  Buka kasus <ArrowRight size={12} />
                </Link>
              </div>
              {topConfirmed.length ? (
                <div className="table-shell">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Kasus</th>
                        <th>Nasabah</th>
                        <th>Entitas</th>
                        <th>Skor</th>
                        <th>Severity</th>
                        <th>Pemblokiran</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topConfirmed.map((item) => (
                        <tr key={item.id}>
                          <td className="primary-cell mono text-[0.64rem]">
                            {item.case_number}
                          </td>
                          <td className="text-[0.72rem]">{item.customer_name}</td>
                          <td className="text-[0.72rem]">{item.entity_name}</td>
                          <td className="mono text-[0.7rem] font-bold">{item.score.toFixed(2)}%</td>
                          <td>
                            <span
                              className={clsx(
                                "badge",
                                SEVERITY_META[item.severity]?.className ?? "badge-neutral",
                              )}
                            >
                              {SEVERITY_META[item.severity]?.label ?? item.severity}
                            </span>
                          </td>
                          <td className="text-[0.68rem] font-semibold">
                            {item.balance_frozen > 0
                              ? formatCurrency(item.balance_frozen)
                              : "—"}
                          </td>
                          <td>
                            <span
                              className={clsx(
                                "badge",
                                item.status === "CLOSED" ? "badge-clean" : "badge-medium",
                              )}
                            >
                              {item.status === "CLOSED" ? "Selesai" : "Berjalan"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  icon={<ShieldCheck size={20} />}
                  title="Belum ada confirmed hit"
                  description="Konfirmasi temuan pada modul kasus untuk menyusun laporan eksekutif."
                />
              )}
            </div>
          </div>
        ) : null}
      </section>
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Buat draft laporan"
        description="Pilih kasus confirmed hit dan jenis laporan yang akan diterbitkan."
        size="lg"
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setCreateOpen(false)}
            >
              Batal
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={generateReport}
              disabled={!canCreate}
            >
              {creating ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <Plus size={14} />
              )}
              Buat draft
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <label className="field-label">Kasus confirmed hit *</label>
            <select
              className="select"
              value={createCaseId}
              onChange={(event) => setCreateCaseId(event.target.value)}
            >
              {data?.confirmedCases.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.case_number} — {item.customer_name} vs {item.entity_name}
                </option>
              ))}
            </select>
            {selectedCase ? (
              <div className="mt-2 grid gap-2 rounded-lg border border-line bg-slate-50/70 p-2.5 sm:grid-cols-3">
                <Field
                  label="Skor"
                  value={`${Math.round(selectedCase.score)}%`}
                />
                <Field
                  label="Saldo diblokir"
                  value={formatCurrency(selectedCase.balance_frozen)}
                />
                <Field
                  label="Surat perintah"
                  value={selectedCase.legal_warrant_number ?? "—"}
                  mono
                />
              </div>
            ) : null}
          </div>

          <div>
            <label className="field-label">Jenis laporan *</label>
            <div className="grid gap-2 sm:grid-cols-3">
              {REPORT_TYPES.map((type) => {
                const disabled = existingTypes.has(type);
                const freezeMissing =
                  type === "SIPESAT_PEMBLOKIRAN" &&
                  selectedCase?.freeze_status !== "ACTIVE_FROZEN";
                const active = createType === type;
                return (
                  <button
                    key={type}
                    type="button"
                    className={clsx(
                      "rounded-xl border p-3 text-left transition",
                      active
                        ? "border-brand-500 bg-brand-50/70 shadow-sm"
                        : "border-line bg-white hover:border-slate-300",
                      (disabled || freezeMissing) && "opacity-55",
                    )}
                    disabled={disabled || freezeMissing}
                    onClick={() => setCreateType(type)}
                  >
                    <span
                      className={clsx(
                        "flex h-7 w-7 items-center justify-center rounded-lg",
                        active
                          ? "bg-brand-600 text-white"
                          : "bg-slate-100 text-slate-500",
                      )}
                    >
                      {REPORT_ICONS[type]}
                    </span>
                    <p className="mt-2 text-[0.71rem] font-bold text-ink-900">
                      {REPORT_TYPE_META[type].label}
                    </p>
                    <p className="mt-0.5 text-[0.6rem] leading-relaxed text-slate-500">
                      {REPORT_TYPE_META[type].description}
                    </p>
                    {disabled ? (
                      <p className="mt-1.5 text-[0.56rem] font-semibold text-amber-700">
                        Sudah ada laporan aktif
                      </p>
                    ) : null}
                    {freezeMissing ? (
                      <p className="mt-1.5 text-[0.56rem] font-semibold text-slate-500">
                        Tidak ada pemblokiran aktif
                      </p>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <Alert variant="info" icon={<ShieldCheck size={15} />}>
            Draft dibuat sebagai XML dengan data identitas yang telah dimasking.
            Setelah diverifikasi, tandai <strong>Siap Kirim</strong> lalu minta
            Approver menekan <strong>Kirim</strong> ke regulator. Seluruh aksi
            tercatat pada audit trail.
          </Alert>

          {existingTypes.has(createType) ? (
            <Alert variant="warning" icon={<AlertTriangle size={15} />}>
              Kasus ini sudah memiliki laporan {REPORT_TYPE_META[createType].short}{" "}
              yang belum terkirim. Unduh atau kirim laporan tersebut terlebih
              dahulu.
            </Alert>
          ) : null}
        </div>
      </Modal>

      {/* ----------------------------- XML preview ------------------------------ */}
      <Modal
        open={Boolean(preview)}
        onClose={() => setPreview(null)}
        title={preview ? preview.reference_number : "Pratinjau XML"}
        description={
          preview
            ? `${REPORT_TYPE_META[preview.report_type].label} · ${preview.case_number} · ${preview.customer_name}`
            : undefined
        }
        size="xl"
        footer={
          preview ? (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setPreview(null)}
              >
                Tutup
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => copyXml(preview.xml_payload_content)}
              >
                <Copy size={14} /> Salin XML
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => downloadXml(preview)}
              >
                <Download size={14} /> Unduh XML
              </button>
            </>
          ) : null
        }
      >
        {preview ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span
                className={clsx(
                  "badge",
                  REPORT_STATUS_META[preview.submission_status].className,
                )}
              >
                {REPORT_STATUS_META[preview.submission_status].label}
              </span>
              <span className="badge badge-neutral">
                {REPORT_TYPE_META[preview.report_type].label}
              </span>
              <span className="badge badge-neutral">
                Dibuat oleh {preview.generated_by_name}
              </span>
              <span className="text-[0.62rem] text-slate-400">
                {formatDateTimeId(preview.generated_at)}
              </span>
            </div>
            <div className="code-block max-h-[55vh] overflow-auto">
              <pre className="whitespace-pre-wrap break-words text-[0.66rem] leading-relaxed">
                {preview.xml_payload_content}
              </pre>
            </div>
            <p className="flex items-center gap-1.5 text-[0.6rem] text-slate-400">
              <LockKeyhole size={11} /> Payload bersifat read-only dan tercatat
              pada audit trail.
            </p>
          </div>
        ) : null}
      </Modal>

      {/* ---------------------------- Status confirm ---------------------------- */}
      <Modal
        open={Boolean(actionTarget)}
        onClose={() => setActionTarget(null)}
        title={
          actionTarget?.action === "SUBMIT"
            ? "Kirim laporan ke regulator"
            : "Tandai laporan siap kirim"
        }
        description={
          actionTarget
            ? `${actionTarget.report.reference_number} · ${REPORT_TYPE_META[actionTarget.report.report_type].label}`
            : undefined
        }
        size="md"
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setActionTarget(null)}
            >
              Batal
            </button>
            <button
              type="button"
              className={
                actionTarget?.action === "SUBMIT"
                  ? "btn btn-dark"
                  : "btn btn-primary"
              }
              onClick={updateStatus}
              disabled={acting}
            >
              {acting ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : actionTarget?.action === "SUBMIT" ? (
                <Send size={14} />
              ) : (
                <CheckCircle2 size={14} />
              )}
              {actionTarget?.action === "SUBMIT"
                ? "Kirim sekarang"
                : "Tandai siap kirim"}
            </button>
          </>
        }
      >
        {actionTarget ? (
          <div className="space-y-3">
            {actionTarget.action === "SUBMIT" ? (
              <Alert variant="warning" icon={<AlertTriangle size={15} />}>
                Status akan berubah menjadi <strong>Terkirim</strong> dan waktu
                submit dicatat permanen. Pastikan XML telah diunggah ke portal
                regulator, karena aksi ini tidak dapat dibatalkan.
              </Alert>
            ) : (
              <Alert variant="info" icon={<CheckCircle2 size={15} />}>
                Pastikan seluruh data nasabah, entitas, dan dasar hukum telah
                sesuai. Setelah siap kirim, laporan menunggu tanda tangan
                Approver.
              </Alert>
            )}
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="Nomor referensi" value={actionTarget.report.reference_number} mono />
              <Field label="Kasus" value={actionTarget.report.case_number} mono />
              <Field label="Nasabah" value={actionTarget.report.customer_name} />
              <Field label="Entitas" value={actionTarget.report.entity_name} />
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
