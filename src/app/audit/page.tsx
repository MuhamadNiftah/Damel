"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  Boxes,
  Clock3,
  Copy,
  Database,
  Download,
  Eye,
  FileSpreadsheet,
  Fingerprint,
  Layers3,
  LockKeyhole,
  RefreshCw,
  ScrollText,
  ShieldCheck,
  UsersRound,
} from "lucide-react";
import type { AuditLogView } from "@/lib/types";
import { formatDateTimeId } from "@/lib/normalize";
import { ROLE_META, clsx, getInitials } from "@/lib/ui";
import { useDemoUser } from "@/components/user-provider";
import { useToast } from "@/components/toast-provider";
import {
  Alert,
  EmptyState,
  Field,
  MetricCard,
  Modal,
  PageHeader,
  Pagination,
  SearchInput,
  Skeleton,
} from "@/components/ui";

interface AuditResponse {
  items: AuditLogView[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  metrics: {
    total: number;
    today: number;
    users: number;
    modules: number;
    byModule: Array<{ module: string; count: number }>;
  };
  options: {
    modules: string[];
    actions: string[];
    users: Array<{ id: string; name: string; role: string }>;
  };
}

const MODULE_META: Record<
  string,
  { label: string; className: string; color: string }
> = {
  SCREENING: {
    label: "Screening",
    className: "badge-info",
    color: "#1d5f9f",
  },
  WATCHLIST: {
    label: "Watchlist",
    className: "badge-violet",
    color: "#6d3cb5",
  },
  DTTOT: {
    label: "Data DTTOT",
    className: "badge-critical",
    color: "#b42318",
  },
  APUPPT: {
    label: "Data APU-PPT",
    className: "badge-gold",
    color: "#946b06",
  },
  CUSTOMER_MGMT: {
    label: "Data Nasabah",
    className: "badge-info",
    color: "#1d5f9f",
  },
  MATCHING: {
    label: "Matching Engine",
    className: "badge-violet",
    color: "#6d3cb5",
  },
  ADMIN: {
    label: "Admin",
    className: "badge-neutral",
    color: "#475569",
  },
  CASE_MGMT: {
    label: "Manajemen Kasus",
    className: "badge-gold",
    color: "#946b06",
  },
  REPORTING: {
    label: "Pelaporan",
    className: "badge-clean",
    color: "#087a55",
  },
  AUDIT: {
    label: "Audit",
    className: "badge-neutral",
    color: "#475569",
  },
};

const ACTION_LABELS: Record<string, string> = {
  ADD_CASE_NOTE: "Tambah catatan kasus",
  APPROVE_FREEZE: "Setujui pemblokiran",
  APPROVE_HIT: "Setujui confirmed hit",
  APPROVE_WHITELIST: "Setujui whitelist",
  CHECKER_APPROVE: "Verifikasi checker",
  CREATE_USER: "Tambah pengguna",
  EXPORT_AUDIT: "Export rekap audit",
  EXPORT_AUDIT_TRAIL: "Export audit trail",
  EXPORT_CUSTOMERS: "Export data nasabah",
  EXPORT_WATCHLIST: "Export watchlist",
  FINAL_APPROVAL: "Keputusan final",
  GENERATE_REPORT: "Buat draft laporan",
  IMPORT_WATCHLIST: "Impor watchlist",
  LIFT_FREEZE: "Cabut pemblokiran",
  MARK_REPORT_READY: "Tandai laporan siap",
  OPEN_CASE: "Buka kasus",
  RUN_MATCHING_SYNC: "Sinkronisasi matching",
  RUN_SCREENING: "Jalankan screening",
  SUBMIT_APPROVAL: "Ajukan approval",
  SUBMIT_REPORT: "Kirim laporan",
  UPDATE_CUSTOMER: "Ubah profil nasabah",
  UPDATE_RECOMMENDATION: "Ubah rekomendasi",
  UPDATE_USER: "Ubah pengguna",
  UPLOAD_AND_SCREEN: "Unggah & screening",
  UPLOAD_BATCH: "Unggah batch",
  VIEW_AUDIT: "Lihat audit",
  VIEW_CASE: "Lihat kasus",
  VIEW_MATCH: "Lihat hasil match",
};

function moduleMeta(module: string) {
  return (
    MODULE_META[module] ?? {
      label: module,
      className: "badge-neutral",
      color: "#475569",
    }
  );
}

function pretty(value: Record<string, unknown> | null): string {
  if (!value) return "—";
  return JSON.stringify(value, null, 2);
}

export default function AuditPage() {
  const { user, apiFetch, downloadFile } = useDemoUser();
  const toast = useToast();
  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshIndex, setRefreshIndex] = useState(0);

  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [moduleFilter, setModuleFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [exporting, setExporting] = useState(false);

  const [selected, setSelected] = useState<AuditLogView | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebounced(query), 260);
    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const params = new URLSearchParams();
    if (debounced) params.set("q", debounced);
    if (moduleFilter !== "all") params.set("module", moduleFilter);
    if (actionFilter !== "all") params.set("action", actionFilter);
    if (userFilter !== "all") params.set("user", userFilter);
    params.set("page", String(page));
    params.set("pageSize", String(pageSize));
    apiFetch<AuditResponse>(`/api/audit?${params.toString()}`)
      .then((payload) => {
        if (active) setData(payload);
      })
      .catch((error) =>
        toast.error("Gagal memuat audit trail", (error as Error).message),
      )
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [
    apiFetch,
    debounced,
    moduleFilter,
    actionFilter,
    userFilter,
    page,
    pageSize,
    refreshIndex,
    toast,
  ]);

  const isFiltered =
    Boolean(debounced) ||
    moduleFilter !== "all" ||
    actionFilter !== "all" ||
    userFilter !== "all";

  function resetFilters() {
    setQuery("");
    setModuleFilter("all");
    setActionFilter("all");
    setUserFilter("all");
    setPage(1);
  }

  function refresh() {
    setRefreshIndex((index) => index + 1);
  }

  async function exportExcel() {
    setExporting(true);
    try {
      const params = new URLSearchParams();
      if (debounced) params.set("q", debounced);
      if (moduleFilter !== "all") params.set("module", moduleFilter);
      if (actionFilter !== "all") params.set("action", actionFilter);
      if (userFilter !== "all") params.set("user", userFilter);
      await downloadFile(
        `/api/audit/export?${params.toString()}`,
        "Audit_Trail_DMB.xlsx",
      );
      toast.success(
        "Audit trail diunduh",
        "Workbook Excel mengikuti filter yang sedang aktif.",
      );
      refresh();
    } catch (error) {
      toast.error("Export gagal", (error as Error).message);
    } finally {
      setExporting(false);
    }
  }

  async function copyState(value: Record<string, unknown> | null) {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(JSON.stringify(value, null, 2));
      toast.success("State disalin");
    } catch {
      toast.error("Gagal menyalin", "Browser memblokir akses clipboard.");
    }
  }

  const metrics = data?.metrics;
  const topModules = useMemo(
    () =>
      (data?.metrics.byModule ?? [])
        .slice()
        .sort((a, b) => b.count - a.count)
        .slice(0, 4),
    [data],
  );
  const maxModule = Math.max(1, ...topModules.map((item) => item.count));

  return (
    <div>
      <PageHeader
        eyebrow="Tata Kelola"
        title="Log System"
        description="Jejak audit append-only untuk seluruh aktivitas pengguna dan admin — create, update, edit, screening, investigasi, persetujuan, pemblokiran, dan pelaporan sesuai POJK No. 8 Tahun 2023."
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
              className="btn btn-dark"
              onClick={exportExcel}
              disabled={exporting}
            >
              <FileSpreadsheet size={14} />
              {exporting ? "Menyiapkan..." : "Export Excel"}
            </button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total peristiwa"
          value={metrics?.total ?? "—"}
          sub="Sejak database audit diinisialisasi"
          icon={<Database size={17} />}
          tone="brand"
          delay="stagger-1"
        />
        <MetricCard
          label="Aktivitas hari ini"
          value={metrics?.today ?? "—"}
          sub="Termasuk login persona demo"
          icon={<Activity size={17} />}
          tone="clean"
          delay="stagger-2"
        />
        <MetricCard
          label="Pengguna tercatat"
          value={metrics?.users ?? "—"}
          sub="Maker, checker, approver, auditor"
          icon={<UsersRound size={17} />}
          tone="violet"
          delay="stagger-3"
        />
        <MetricCard
          label="Modul termonitor"
          value={metrics?.modules ?? "—"}
          sub="Screening · watchlist · kasus · laporan"
          icon={<Boxes size={17} />}
          tone="ink"
          delay="stagger-4"
        />
      </div>

      <section className="hero-panel mt-3 p-4">
        <div className="relative z-10 grid gap-4 lg:grid-cols-[1.25fr_1fr]">
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm">
              <Fingerprint size={19} />
            </span>
            <div>
              <p className="flex flex-wrap items-center gap-2 text-[0.9rem] font-extrabold text-ink-900">
                Immutable audit log (WORM)
                <span className="badge badge-clean">
                  <LockKeyhole size={9} /> Append-only
                </span>
              </p>
              <p className="mt-1 max-w-xl text-[0.7rem] leading-relaxed text-slate-500">
                Setiap entri menyimpan pelaku, modul, aksi, alamat IP, serta
                snapshot <span className="mono text-[0.64rem]">state_before</span>{" "}
                dan <span className="mono text-[0.64rem]">state_after</span>.
                Entri tidak dapat diubah atau dihapus melalui antarmuka aplikasi.
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <span className="badge badge-neutral">Retensi 5 tahun</span>
                <span className="badge badge-neutral">POJK 8/2023</span>
                <span className="badge badge-neutral">UU TPPT 9/2013</span>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-line bg-white/80 p-3">
            <p className="text-[0.6rem] font-bold uppercase tracking-wider text-slate-400">
              Distribusi per modul
            </p>
            <div className="mt-2 space-y-1.5">
              {topModules.map((item) => {
                const meta = moduleMeta(item.module);
                return (
                  <div key={item.module}>
                    <div className="flex items-center justify-between text-[0.62rem]">
                      <span className="font-semibold text-ink-800">
                        {meta.label}
                      </span>
                      <span className="mono text-slate-400">{item.count}</span>
                    </div>
                    <div className="progress-track mt-1 h-1.5">
                      <div
                        className="progress-bar"
                        style={{
                          width: `${Math.max(6, (item.count / maxModule) * 100)}%`,
                          background: meta.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
              {!topModules.length ? (
                <p className="text-[0.64rem] text-slate-400">Belum ada data.</p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <section className="mt-4">
        <div className="card mb-3 p-3">
          <div className="flex flex-wrap items-center gap-2">
            <SearchInput
              value={query}
              onChange={(value) => {
                setQuery(value);
                setPage(1);
              }}
              placeholder="Cari deskripsi, aksi, IP..."
              className="min-w-[210px] flex-1"
            />
            <select
              className="select h-9 w-auto min-w-[145px] py-1.5 text-[0.7rem]"
              value={moduleFilter}
              onChange={(event) => {
                setModuleFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="all">Semua modul</option>
              {data?.options.modules.map((module) => (
                <option key={module} value={module}>
                  {moduleMeta(module).label}
                </option>
              ))}
            </select>
            <select
              className="select h-9 w-auto min-w-[165px] py-1.5 text-[0.7rem]"
              value={actionFilter}
              onChange={(event) => {
                setActionFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="all">Semua aksi</option>
              {data?.options.actions.map((action) => (
                <option key={action} value={action}>
                  {ACTION_LABELS[action] ?? action}
                </option>
              ))}
            </select>
            <select
              className="select h-9 w-auto min-w-[160px] py-1.5 text-[0.7rem]"
              value={userFilter}
              onChange={(event) => {
                setUserFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="all">Semua pengguna</option>
              {data?.options.users.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
            <select
              className="select h-9 w-auto py-1.5 text-[0.7rem]"
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
            >
              <option value={20}>20 / halaman</option>
              <option value={50}>50 / halaman</option>
              <option value={100}>100 / halaman</option>
            </select>
            {isFiltered ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={resetFilters}
              >
                Reset filter
              </button>
            ) : null}
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3">
            <div>
              <p className="text-[0.8rem] font-bold text-ink-900">
                Log peristiwa
              </p>
              <p className="mt-0.5 text-[0.65rem] text-slate-500">
                {isFiltered
                  ? `${data?.total ?? 0} entri cocok dengan filter aktif`
                  : "Seluruh entri audit terbaru ditampilkan lebih dahulu"}
              </p>
            </div>
            <span className="badge badge-neutral">
              <Layers3 size={10} /> {data?.total ?? 0} entri
            </span>
          </div>

          {loading && !data ? (
            <div className="space-y-2 p-3">
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <Skeleton key={index} className="h-12 w-full" />
              ))}
            </div>
          ) : data?.items.length ? (
            <>
              <div className="overflow-x-auto">
                <table className="data-table min-w-[1000px]">
                  <thead>
                    <tr>
                      <th>Waktu</th>
                      <th>Pengguna</th>
                      <th>Modul</th>
                      <th>Aksi</th>
                      <th>Deskripsi</th>
                      <th>IP</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((log) => {
                      const meta = moduleMeta(log.module_name);
                      const role = ROLE_META[log.user_role];
                      return (
                        <tr key={log.id}>
                          <td>
                            <p className="mono text-[0.62rem] text-ink-800">
                              {formatDateTimeId(log.timestamp)}
                            </p>
                            <p className="mono mt-0.5 text-[0.54rem] text-slate-400">
                              {log.id}
                            </p>
                          </td>
                          <td>
                            <div className="flex items-center gap-2">
                              <span
                                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[0.46rem] font-bold text-white"
                                style={{
                                  background: role?.color ?? "#475569",
                                }}
                              >
                                {getInitials(log.user_name)}
                              </span>
                              <div>
                                <p className="text-[0.7rem] font-semibold text-ink-900">
                                  {log.user_name}
                                </p>
                                <p className="text-[0.56rem] text-slate-400">
                                  {role?.short ?? log.user_role}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className={clsx("badge", meta.className)}>
                              {meta.label}
                            </span>
                          </td>
                          <td>
                            <p className="text-[0.67rem] font-semibold text-ink-800">
                              {ACTION_LABELS[log.action_name] ?? log.action_name}
                            </p>
                            <p className="mono mt-0.5 text-[0.54rem] text-slate-400">
                              {log.action_name}
                            </p>
                          </td>
                          <td>
                            <p className="max-w-[320px] text-[0.65rem] leading-relaxed text-slate-600">
                              {log.description}
                            </p>
                          </td>
                          <td className="mono text-[0.6rem] text-slate-500">
                            {log.ip_address}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => setSelected(log)}
                            >
                              <Eye size={12} /> Detail
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={data.page}
                pageCount={data.pageCount}
                total={data.total}
                onChange={setPage}
              />
            </>
          ) : (
            <EmptyState
              icon={<ScrollText size={22} />}
              title="Tidak ada entri audit"
              description={
                isFiltered
                  ? "Coba longgarkan filter modul, aksi, pengguna, atau kata kunci."
                  : "Audit trail akan terisi otomatis saat pengguna menjalankan screening atau keputusan."
              }
              action={
                isFiltered ? (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={resetFilters}
                  >
                    Reset filter
                  </button>
                ) : undefined
              }
            />
          )}
        </div>
      </section>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title="Detail entri audit"
        description={
          selected
            ? `${ACTION_LABELS[selected.action_name] ?? selected.action_name} · ${formatDateTimeId(selected.timestamp)}`
            : undefined
        }
        size="xl"
        footer={
          selected ? (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelected(null)}
              >
                Tutup
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => copyState(selected.state_after)}
                disabled={!selected.state_after}
              >
                <Copy size={14} /> Salin state_after
              </button>
            </>
          ) : null
        }
      >
        {selected ? (
          <div className="space-y-3">
            <Alert variant="info" icon={<LockKeyhole size={15} />}>
              Entri ini bersifat permanen. Aksi{" "}
              <span className="mono text-[0.66rem]">
                {selected.action_name}
              </span>{" "}
              oleh {selected.user_name} tercatat pada{" "}
              {formatDateTimeId(selected.timestamp)}.
            </Alert>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Field label="Log ID" value={selected.id} mono />
              <Field
                label="Modul"
                value={moduleMeta(selected.module_name).label}
              />
              <Field label="Aksi" value={selected.action_name} mono />
              <Field
                label="Peran"
                value={ROLE_META[selected.user_role]?.label ?? selected.user_role}
              />
              <Field label="Pengguna" value={selected.user_name} />
              <Field label="IP address" value={selected.ip_address} mono />
              <Field
                label="Waktu"
                value={formatDateTimeId(selected.timestamp)}
                hint="Zona waktu Asia/Jakarta"
              />
              <Field
                label="User agent"
                value={selected.user_agent}
              />
            </div>

            <div className="rounded-lg border border-line bg-slate-50/70 px-3 py-2">
              <p className="text-[0.56rem] font-bold uppercase tracking-wider text-slate-400">
                Deskripsi
              </p>
              <p className="mt-0.5 text-[0.73rem] leading-relaxed text-slate-700">
                {selected.description}
              </p>
            </div>

            <div className="grid gap-3 lg:grid-cols-2">
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-[0.62rem] font-bold uppercase tracking-wider text-slate-400">
                    <Clock3 size={11} /> state_before
                  </p>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm !px-1.5 !py-0.5 text-[0.55rem]"
                    onClick={() => copyState(selected.state_before)}
                    disabled={!selected.state_before}
                  >
                    <Copy size={10} /> Salin
                  </button>
                </div>
                <div className="code-block max-h-56 overflow-auto">
                  <pre className="whitespace-pre-wrap break-words text-[0.63rem] leading-relaxed">
                    {pretty(selected.state_before)}
                  </pre>
                </div>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <p className="flex items-center gap-1.5 text-[0.62rem] font-bold uppercase tracking-wider text-slate-400">
                    <ShieldCheck size={11} /> state_after
                  </p>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm !px-1.5 !py-0.5 text-[0.55rem]"
                    onClick={() => copyState(selected.state_after)}
                    disabled={!selected.state_after}
                  >
                    <Copy size={10} /> Salin
                  </button>
                </div>
                <div className="code-block max-h-56 overflow-auto">
                  <pre className="whitespace-pre-wrap break-words text-[0.63rem] leading-relaxed">
                    {pretty(selected.state_after)}
                  </pre>
                </div>
              </div>
            </div>

            <p className="flex items-center gap-1.5 text-[0.6rem] text-slate-400">
              <Download size={11} /> Gunakan Export Excel untuk mengunduh jejak
              audit lengkap sesuai filter aktif.
            </p>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
