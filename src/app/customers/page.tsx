"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  BriefcaseBusiness,
  Download,
  FilterX,
  ShieldAlert,
  Sparkles,
  UploadCloud,
  UserRoundSearch,
  UsersRound,
  WalletCards,
} from "lucide-react";
import type {
  CustomerDatasetMetrics,
  CustomerListItem,
  CustomerQuality,
  EmploymentStatus,
} from "@/lib/types";
import { useDemoUser } from "@/components/user-provider";
import { useToast } from "@/components/toast-provider";
import {
  EmptyState,
  MetricCard,
  Pagination,
  SearchInput,
  Skeleton,
} from "@/components/ui";
import { QualityBadge, GradePill } from "@/components/quality";
import {
  formatCompact,
  formatCurrency,
  formatDateId,
} from "@/lib/normalize";
import { clsx } from "@/lib/ui";

interface CustomersResponse {
  items: CustomerListItem[];
  total: number;
  page: number;
  totalPages: number;
  metrics: CustomerDatasetMetrics;
  gradeCounts: Record<CustomerQuality["grade"], number>;
}

const EMPLOYMENT_LABELS: Record<EmploymentStatus, string> = {
  PERMANENT: "Karyawan tetap",
  CONTRACT: "Kontrak",
  SELF_EMPLOYED: "Wirausaha",
  RETIRED: "Pensiunan",
};

const RISK_META = {
  LOW: { label: "Rendah", className: "badge-clean" },
  MEDIUM: { label: "Sedang", className: "badge-medium" },
  HIGH: { label: "Tinggi", className: "badge-critical" },
} as const;

const STATUS_META = {
  ACTIVE: { label: "Aktif", className: "badge-clean" },
  DORMANT: { label: "Dormant", className: "badge-neutral" },
  CLOSED: { label: "Tutup", className: "badge-neutral" },
} as const;

export default function CustomersPage() {
  const { apiFetch, downloadFile } = useDemoUser();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [risk, setRisk] = useState("");
  const [status, setStatus] = useState("");
  const [grade, setGrade] = useState("");
  const [severity, setSeverity] = useState("");
  const [sort, setSort] = useState("name");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<CustomersResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const params = useMemo(() => {
    const search = new URLSearchParams();
    if (query.trim()) search.set("q", query.trim());
    if (risk) search.set("risk", risk);
    if (status) search.set("status", status);
    if (grade) search.set("grade", grade);
    if (severity) search.set("severity", severity);
    search.set("sort", sort);
    search.set("page", String(page));
    search.set("limit", "20");
    return search.toString();
  }, [query, risk, status, grade, severity, sort, page]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const timer = setTimeout(() => {
      apiFetch<CustomersResponse>(`/api/customers?${params}`)
        .then((payload) => {
          if (active) setData(payload);
        })
        .catch((error: Error) => {
          if (active) toast.error("Gagal memuat data nasabah", error.message);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, query ? 220 : 0);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [apiFetch, params, query, toast]);

  const metrics = data?.metrics;
  const gradeCounts = data?.gradeCounts;

  function changeFilter(setter: (value: string) => void, value: string) {
    setter(value);
    setPage(1);
  }

  function resetFilters() {
    setQuery("");
    setRisk("");
    setStatus("");
    setGrade("");
    setSeverity("");
    setSort("name");
    setPage(1);
  }

  async function exportData() {
    setExporting(true);
    try {
      await downloadFile(`/api/customers/export?${params}`, "Data_Nasabah_DMB.xlsx");
      toast.success("Ekspor selesai", "Data nasabah diunduh dalam format Excel.");
    } catch (error) {
      toast.error("Ekspor gagal", (error as Error).message);
    } finally {
      setExporting(false);
    }
  }

  const activeFilters = Boolean(query || risk || status || grade || severity);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[0.66rem] font-bold uppercase tracking-[0.14em] text-brand-700">
            Manajemen Data Nasabah
          </p>
          <h1 className="mt-0.5 text-[1.35rem] font-extrabold tracking-tight text-ink-900 sm:text-[1.55rem]">
            Data Nasabah
          </h1>
          <p className="mt-1 max-w-3xl text-[0.78rem] leading-relaxed text-slate-500">
            Profil nasabah, jabatan, riwayat kepegawaian, transaksi, dan penilaian
            kualitas data dalam satu tempat. NIK dan nomor rekening dimasking.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={exportData}
            disabled={exporting}
          >
            <Download size={14} /> {exporting ? "Menyiapkan..." : "Ekspor Excel"}
          </button>
          <Link href="/screening" className="btn btn-primary btn-sm">
            <UploadCloud size={14} /> Upload data nasabah
          </Link>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total nasabah"
          value={metrics ? formatCompact(metrics.total) : "—"}
          sub={`${metrics?.active ?? 0} aktif · ${metrics?.dormant ?? 0} dormant`}
          icon={<UsersRound size={17} />}
          tone="brand"
        />
        <MetricCard
          label="Rata-rata kualitas"
          value={metrics ? `${metrics.averageQuality}/100` : "—"}
          sub="Identitas, profil, keuangan, aktivitas"
          icon={<Sparkles size={17} />}
          tone="clean"
          delay="stagger-1"
        />
        <MetricCard
          label="Profil risiko tinggi"
          value={metrics ? formatCompact(metrics.highRisk) : "—"}
          sub={`${metrics?.mediumRisk ?? 0} risiko sedang · ${metrics?.lowRisk ?? 0} rendah`}
          icon={<ShieldAlert size={17} />}
          tone="critical"
          delay="stagger-2"
        />
        <MetricCard
          label="Transaksi tercatat"
          value={metrics ? formatCompact(metrics.totalTransactions) : "—"}
          sub="Riwayat transaksi 90 hari terakhir"
          icon={<WalletCards size={17} />}
          tone="violet"
          delay="stagger-3"
        />
      </div>

      <div className="card p-3.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[0.66rem] font-bold uppercase tracking-[0.08em] text-slate-400">
            Sebaran kualitas
          </span>
          {(["A", "B", "C", "D"] as const).map((item) => (
            <GradePill
              key={item}
              grade={item}
              active={grade === item}
              onClick={() => changeFilter(setGrade, grade === item ? "" : item)}
            />
          ))}
          <span className="ml-auto text-[0.68rem] text-slate-400">
            {gradeCounts ? `${gradeCounts.A + gradeCounts.B} nasabah grade A/B` : "—"}
          </span>
        </div>
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-col gap-2.5 border-b border-line px-3.5 py-3 lg:flex-row lg:items-center">
          <SearchInput
            value={query}
            onChange={(value) => {
              setQuery(value);
              setPage(1);
            }}
            placeholder="Cari nama, CIF, pekerjaan, atau cabang..."
            className="lg:max-w-sm"
          />
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="select w-auto"
              value={risk}
              onChange={(event) => changeFilter(setRisk, event.target.value)}
            >
              <option value="">Semua risiko</option>
              <option value="LOW">Risiko rendah</option>
              <option value="MEDIUM">Risiko sedang</option>
              <option value="HIGH">Risiko tinggi</option>
            </select>
            <select
              className="select w-auto"
              value={status}
              onChange={(event) => changeFilter(setStatus, event.target.value)}
            >
              <option value="">Semua status</option>
              <option value="ACTIVE">Aktif</option>
              <option value="DORMANT">Dormant</option>
              <option value="CLOSED">Tutup</option>
            </select>
            <select
              className="select w-auto"
              value={severity}
              onChange={(event) => changeFilter(setSeverity, event.target.value)}
            >
              <option value="">Semua hasil matching</option>
              <option value="CRITICAL">Critical</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Potensial</option>
              <option value="NONE">Belum ada temuan</option>
            </select>
            <select
              className="select w-auto"
              value={sort}
              onChange={(event) => changeFilter(setSort, event.target.value)}
            >
              <option value="name">Urut nama</option>
              <option value="quality">Kualitas tertinggi</option>
              <option value="risk">Risiko tertinggi</option>
              <option value="severity">Temuan terberat</option>
              <option value="recent">Transaksi terbaru</option>
              <option value="onboarded">Terdaftar terbaru</option>
            </select>
            {activeFilters ? (
              <button
                type="button"
                className="btn btn-ghost btn-sm text-slate-500"
                onClick={resetFilters}
              >
                <FilterX size={14} /> Reset
              </button>
            ) : null}
          </div>
        </div>

        {loading && !data ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 7 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-full" />
            ))}
          </div>
        ) : data && data.items.length === 0 ? (
          <EmptyState
            icon={<UserRoundSearch size={22} />}
            title="Nasabah tidak ditemukan"
            description="Ubah kata kunci atau filter untuk melihat data nasabah lain."
            action={
              <button type="button" className="btn btn-secondary btn-sm" onClick={resetFilters}>
                Reset filter
              </button>
            }
          />
        ) : (
          <div className="table-shell">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Nasabah</th>
                  <th>Pekerjaan</th>
                  <th>Risiko</th>
                  <th>Kualitas</th>
                  <th>Matching</th>
                  <th>Status</th>
                  <th>Transaksi</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {data?.items.map((item) => {
                  const riskMeta = RISK_META[item.risk_rating];
                  const statusMeta = STATUS_META[item.profile_status];
                  return (
                    <tr key={item.id}>
                      <td>
                        <Link
                          href={`/customers/${item.id}`}
                          className="primary-cell block hover:text-brand-700"
                        >
                          {item.full_name}
                        </Link>
                        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[0.62rem] text-slate-400">
                          <span className="mono">{item.cif_number}</span>
                          <span>·</span>
                          <span>{item.customer_type === "CORPORATE" ? "Korporasi" : "Individu"}</span>
                          <span>·</span>
                          <span>{item.branch_code}</span>
                        </div>
                      </td>
                      <td>
                        <p className="text-[0.74rem] font-semibold text-ink-800">
                          {item.occupation}
                        </p>
                        <p className="mt-0.5 max-w-[190px] truncate text-[0.63rem] text-slate-400">
                          {item.employer_name}
                          {item.employment_status
                            ? ` · ${EMPLOYMENT_LABELS[item.employment_status]}`
                            : ""}
                        </p>
                      </td>
                      <td>
                        <span className={clsx("badge", riskMeta.className)}>
                          <span className="badge-dot" /> {riskMeta.label}
                        </span>
                      </td>
                      <td>
                        <QualityBadge quality={item.quality} />
                        <p className="mt-0.5 text-[0.6rem] text-slate-400">{item.quality.label}</p>
                      </td>
                      <td>
                        {item.highest_severity ? (
                          <span
                            className={clsx(
                              "badge",
                              item.highest_severity === "CRITICAL" || item.highest_severity === "HIGH"
                                ? "badge-critical"
                                : "badge-medium",
                            )}
                          >
                            {item.highest_severity === "CRITICAL"
                              ? "Critical"
                              : item.highest_severity === "HIGH"
                                ? "High"
                                : "Potensial"}
                          </span>
                        ) : (
                          <span className="badge badge-clean">
                            <span className="badge-dot" /> Bersih
                          </span>
                        )}
                        <p className="mt-0.5 text-[0.6rem] text-slate-400">
                          {item.match_count} match · {item.open_case_count} kasus aktif
                        </p>
                      </td>
                      <td>
                        <span className={clsx("badge", statusMeta.className)}>
                          {statusMeta.label}
                        </span>
                      </td>
                      <td>
                        <p className="text-[0.73rem] font-semibold text-ink-800">
                          {item.transaction_count} trx
                        </p>
                        <p className="mt-0.5 text-[0.6rem] text-slate-400">
                          {item.last_transaction_at
                            ? formatDateId(item.last_transaction_at)
                            : "Belum ada"}
                        </p>
                      </td>
                      <td className="text-right">
                        <Link
                          href={`/customers/${item.id}`}
                          className="btn btn-secondary btn-sm whitespace-nowrap"
                        >
                          Profil <ArrowUpRight size={13} />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {data && data.total > 0 ? (
          <Pagination
            page={data.page}
            pageCount={data.totalPages}
            total={data.total}
            onChange={setPage}
          />
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-white px-4 py-3 text-[0.68rem] text-slate-500">
        <span className="flex items-center gap-1.5 font-semibold text-ink-800">
          <BriefcaseBusiness size={14} className="text-brand-600" />
          Data pekerjaan & transaksi bersifat demo deterministik
        </span>
        <span className="text-slate-300">|</span>
        <span>
          Total nilai transaksi sampel:{" "}
          <span className="font-semibold text-ink-800">
            {formatCurrency(
              data?.items.reduce((sum, item) => sum + item.monthly_income, 0) ?? 0,
            )}
          </span>{" "}
          penghasilan bulanan per halaman
        </span>
      </div>
    </div>
  );
}
