"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type DragEvent,
} from "react";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Building2,
  CalendarDays,
  CheckCircle2,
  Database,
  Download,
  FileSpreadsheet,
  Filter,
  Globe2,
  History,
  IdCard,
  Layers,
  MapPin,
  Plus,
  RefreshCw,
  Scale,
  Search,
  ShieldCheck,
  UploadCloud,
  UserRound,
  UsersRound,
  X,
} from "lucide-react";
import type {
  SourceCode,
  WatchlistEntityView,
  WatchlistSourceView,
} from "@/lib/types";
import {
  formatDateId,
  formatDateTimeId,
} from "@/lib/normalize";
import {
  ROLE_META,
  SOURCE_META,
  clsx,
  getInitials,
} from "@/lib/ui";
import { useDemoUser } from "@/components/user-provider";
import { useToast } from "@/components/toast-provider";
import {
  Alert,
  Drawer,
  EmptyState,
  Field,
  MetricCard,
  Modal,
  PageHeader,
  Pagination,
  SearchInput,
  Skeleton,
  Tabs,
} from "@/components/ui";

interface WhitelistView {
  id: string;
  entity_id: string;
  entity_name: string;
  customer_cif: string;
  customer_name: string;
  customer_nik: string;
  reason: string;
  approved_by: string;
  whitelisted_at: string;
}

interface WatchlistResponse {
  sources: WatchlistSourceView[];
  entities: WatchlistEntityView[];
  whitelist: WhitelistView[];
  metrics: {
    totalSources: number;
    currentSources: number;
    totalEntities: number;
    activeEntities: number;
    totalAliases: number;
    totalDocuments: number;
    totalWhitelist: number;
    lastUpdated: string | null;
  };
}

interface CustomerOption {
  id: string;
  cif_number: string;
  full_name: string;
  national_id_masked: string;
  customer_type: string;
}

const SOURCE_CODES: SourceCode[] = ["DTTOT", "DPPSPM", "PEP", "UN_SANCTION"];

export default function WatchlistPage() {
  const { user, apiFetch } = useDemoUser();
  const toast = useToast();
  const [data, setData] = useState<WatchlistResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [tab, setTab] = useState<"entities" | "whitelist" | "versions">(
    "entities",
  );
  const [selected, setSelected] = useState<WatchlistEntityView | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [whitelistOpen, setWhitelistOpen] = useState(false);
  const [whitelistEntity, setWhitelistEntity] =
    useState<WatchlistEntityView | null>(null);
  const [refreshIndex, setRefreshIndex] = useState(0);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query), 260);
    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const params = new URLSearchParams();
    if (debouncedQuery) params.set("q", debouncedQuery);
    if (sourceFilter !== "all") params.set("source", sourceFilter);
    if (typeFilter !== "all") params.set("type", typeFilter);
    apiFetch<WatchlistResponse>(`/api/watchlist?${params.toString()}`)
      .then((payload) => {
        if (!active) return;
        setData(payload);
        setSelected((current) =>
          current ? payload.entities.find((item) => item.id === current.id) ?? null : null,
        );
      })
      .catch((error) =>
        toast.error("Gagal memuat watchlist", (error as Error).message),
      )
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [apiFetch, debouncedQuery, sourceFilter, typeFilter, refreshIndex, toast]);

  const currentSource = useMemo(
    () => data?.sources.find((source) => source.is_current) ?? null,
    [data?.sources],
  );

  function refresh() {
    setRefreshIndex((index) => index + 1);
  }

  function openWhitelist(entity: WatchlistEntityView) {
    setWhitelistEntity(entity);
    setWhitelistOpen(true);
    setSelected(null);
  }

  return (
    <div>
      <PageHeader
        eyebrow="Manajemen Data"
        title="Watchlist Sanksi"
        description="Kelola master DTTOT, DPPSPM, PEP, dan sanksi internasional beserta versi, alias, dokumen identitas, dan whitelist false positive."
        icon={<Database size={19} />}
        actions={
          <>
            <a
              href="/api/watchlist/template"
              className="btn btn-secondary"
              download
            >
              <Download size={14} /> Template Excel
            </a>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => setImportOpen(true)}
              disabled={user.role_code === "AUDITOR"}
            >
              <UploadCloud size={14} /> Import Master
            </button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total entitas"
          value={data?.metrics.totalEntities ?? "—"}
          sub={`${data?.metrics.activeEntities ?? 0} entitas aktif`}
          icon={<Database size={17} />}
          tone="ink"
          delay="stagger-1"
        />
        <MetricCard
          label="Nama alias"
          value={data?.metrics.totalAliases ?? "—"}
          sub="Hasil ekstraksi otomatis dari file master"
          icon={<UsersRound size={17} />}
          tone="brand"
          delay="stagger-2"
        />
        <MetricCard
          label="Sumber aktif"
          value={`${data?.metrics.currentSources ?? 0}/${data?.metrics.totalSources ?? 0}`}
          sub={`${data?.metrics.totalDocuments ?? 0} dokumen identitas terindeks`}
          icon={<Layers size={17} />}
          tone="violet"
          delay="stagger-3"
        />
        <MetricCard
          label="Whitelist"
          value={data?.metrics.totalWhitelist ?? "—"}
          sub="False positive terverifikasi biometrik/KTP"
          icon={<ShieldCheck size={17} />}
          tone="clean"
          delay="stagger-4"
        />
      </div>

      <section className="mt-4">
        <div className="mb-2.5 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="text-[0.88rem] font-bold text-ink-900">
              Versi daftar sanksi
            </h2>
            <p className="mt-0.5 text-[0.68rem] text-slate-500">
              Versi aktif dipakai oleh smart matching engine. Versi lama tetap
              tersimpan untuk jejak audit.
            </p>
          </div>
          {data?.metrics.lastUpdated ? (
            <p className="flex items-center gap-1.5 text-[0.64rem] text-slate-400">
              <History size={12} /> Update terakhir{" "}
              {formatDateTimeId(data.metrics.lastUpdated)}
            </p>
          ) : null}
        </div>
        <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
          {loading && !data
            ? [0, 1, 2, 3].map((index) => (
                <Skeleton key={index} className="h-[126px] !rounded-xl" />
              ))
            : (data?.sources.filter((source) => source.source_code !== "DTTOT" || source.is_current) ?? [])
                .slice(0, 4)
                .map((source) => (
                  <button
                    key={source.id}
                    type="button"
                    onClick={() =>
                      setSourceFilter((current) =>
                        current === source.source_code
                          ? "all"
                          : source.source_code,
                      )
                    }
                    className={clsx(
                      "card card-hover animate-fade-up p-3.5 text-left",
                      sourceFilter === source.source_code &&
                        "ring-2 ring-brand-300/60",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span
                        className="badge !px-2 !py-0.5"
                        style={{
                          background: SOURCE_META[source.source_code].bg,
                          color: SOURCE_META[source.source_code].color,
                        }}
                      >
                        {SOURCE_META[source.source_code].short}
                      </span>
                      {source.is_current ? (
                        <span className="badge badge-clean !px-1.5 !py-0.5">
                          <span className="badge-dot" /> Aktif
                        </span>
                      ) : (
                        <span className="badge badge-neutral !px-1.5 !py-0.5">
                          Historis
                        </span>
                      )}
                    </div>
                    <p className="mt-2 line-clamp-2 min-h-[2.1rem] text-[0.75rem] font-bold leading-snug text-ink-900">
                      {source.version_label}
                    </p>
                    <div className="mt-2 flex items-center justify-between text-[0.63rem]">
                      <span className="text-slate-500">
                        {SOURCE_META[source.source_code].label}
                      </span>
                      <span className="font-bold text-ink-800">
                        {source.entity_count} entitas
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-1.5 text-[0.6rem] text-slate-400">
                      <CalendarDays size={11} />
                      Efektif {formatDateId(source.effective_date)}
                    </div>
                  </button>
                ))}
        </div>
      </section>

      <section className="mt-4">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              {
                value: "entities",
                label: "Entitas Watchlist",
                count: data?.metrics.totalEntities,
              },
              {
                value: "whitelist",
                label: "Whitelist",
                count: data?.metrics.totalWhitelist,
              },
              {
                value: "versions",
                label: "Riwayat Versi",
                count: data?.metrics.totalSources,
              },
            ]}
          />
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={refresh}
            disabled={loading}
          >
            <RefreshCw size={13} className={loading ? "animate-spin" : ""} />
            Refresh
          </button>
        </div>

        {tab === "entities" ? (
          <div className="card overflow-hidden">
            <div className="flex flex-col gap-2 border-b border-line p-3 sm:flex-row sm:items-center">
              <SearchInput
                value={query}
                onChange={setQuery}
                placeholder="Cari nama, alias, legal reference..."
                className="sm:w-[320px]"
              />
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 text-[0.66rem] text-slate-400">
                  <Filter size={12} />
                </div>
                <select
                  className="select h-9 w-auto min-w-[130px] py-1.5 text-[0.72rem]"
                  value={sourceFilter}
                  onChange={(event) => setSourceFilter(event.target.value)}
                >
                  <option value="all">Semua sumber</option>
                  {SOURCE_CODES.map((code) => (
                    <option key={code} value={code}>
                      {SOURCE_META[code].label}
                    </option>
                  ))}
                </select>
                <select
                  className="select h-9 w-auto min-w-[125px] py-1.5 text-[0.72rem]"
                  value={typeFilter}
                  onChange={(event) => setTypeFilter(event.target.value)}
                >
                  <option value="all">Semua tipe</option>
                  <option value="INDIVIDUAL">Individual</option>
                  <option value="CORPORATE">Korporasi</option>
                </select>
                {(sourceFilter !== "all" || typeFilter !== "all" || query) && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setSourceFilter("all");
                      setTypeFilter("all");
                      setQuery("");
                    }}
                  >
                    <X size={12} /> Reset
                  </button>
                )}
              </div>
              <span className="ml-auto text-[0.65rem] font-semibold text-slate-400">
                {data?.entities.length ?? 0} entitas ditampilkan
              </span>
            </div>

            {loading && !data ? (
              <div className="space-y-2 p-3">
                {[0, 1, 2, 3, 4].map((index) => (
                  <Skeleton key={index} className="h-12 w-full" />
                ))}
              </div>
            ) : data?.entities.length ? (
              <div className="overflow-x-auto">
                <table className="data-table min-w-[960px]">
                  <thead>
                    <tr>
                      <th>Entitas</th>
                      <th>Alias</th>
                      <th>Sumber</th>
                      <th>Lahir / Kewarganegaraan</th>
                      <th>Dokumen</th>
                      <th>Dasar Hukum</th>
                      <th>Status</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {data.entities.map((entity) => {
                      const meta = SOURCE_META[entity.source_code];
                      return (
                        <tr
                          key={entity.id}
                          className="cursor-pointer"
                          onClick={() => setSelected(entity)}
                        >
                          <td>
                            <div className="flex items-center gap-2.5">
                              <span
                                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                                style={{ background: meta.bg, color: meta.color }}
                              >
                                {entity.entity_type === "CORPORATE" ? (
                                  <Building2 size={14} />
                                ) : (
                                  <UserRound size={14} />
                                )}
                              </span>
                              <div className="max-w-[220px]">
                                <p className="primary-cell truncate text-[0.76rem]">
                                  {entity.primary_name}
                                </p>
                                <p className="mt-0.5 text-[0.61rem] text-slate-400">
                                  {entity.entity_type === "CORPORATE"
                                    ? "Korporasi"
                                    : "Individual"}{" "}
                                  · {entity.id.slice(0, 10)}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td>
                            {entity.aliases.length ? (
                              <div className="flex max-w-[180px] flex-wrap gap-1">
                                {entity.aliases.slice(0, 2).map((alias) => (
                                  <span
                                    key={alias}
                                    className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[0.59rem] text-slate-600"
                                  >
                                    {alias}
                                  </span>
                                ))}
                                {entity.aliases.length > 2 ? (
                                  <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[0.59rem] font-bold text-slate-500">
                                    +{entity.aliases.length - 2}
                                  </span>
                                ) : null}
                              </div>
                            ) : (
                              <span className="text-[0.66rem] text-slate-400">—</span>
                            )}
                          </td>
                          <td>
                            <span
                              className="badge !px-2 !py-0.5"
                              style={{ background: meta.bg, color: meta.color }}
                            >
                              {meta.short}
                            </span>
                            <p className="mt-1 max-w-[150px] truncate text-[0.6rem] text-slate-400">
                              {entity.source_version}
                            </p>
                          </td>
                          <td>
                            <p className="text-[0.7rem] font-semibold text-ink-800">
                              {formatDateId(entity.date_of_birth)}
                            </p>
                            <p className="mt-0.5 text-[0.61rem] text-slate-400">
                              {entity.place_of_birth ?? "—"} ·{" "}
                              {entity.nationality ?? "—"}
                            </p>
                          </td>
                          <td>
                            {entity.documents.length ? (
                              <div className="flex flex-col gap-0.5">
                                {entity.documents.slice(0, 2).map((document) => (
                                  <span
                                    key={`${document.type}-${document.number}`}
                                    className="mono text-[0.61rem] text-slate-500"
                                  >
                                    {document.type} · {document.number}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span className="text-[0.66rem] text-slate-400">—</span>
                            )}
                          </td>
                          <td>
                            <p className="max-w-[190px] truncate text-[0.67rem] text-slate-500">
                              {entity.legal_reference ?? "—"}
                            </p>
                          </td>
                          <td>
                            <span
                              className={clsx(
                                "badge",
                                entity.is_active ? "badge-clean" : "badge-neutral",
                              )}
                            >
                              {entity.is_active ? "Aktif" : "Nonaktif"}
                            </span>
                            {entity.whitelist_count > 0 ? (
                              <p className="mt-1 text-[0.58rem] font-semibold text-slate-400">
                                {entity.whitelist_count} whitelist
                              </p>
                            ) : null}
                          </td>
                          <td>
                            <button
                              type="button"
                              className="icon-btn h-7 w-7"
                              onClick={(event) => {
                                event.stopPropagation();
                                setSelected(entity);
                              }}
                              aria-label="Detail entitas"
                            >
                              <ArrowRight size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                icon={<Search size={22} />}
                title="Entitas tidak ditemukan"
                description="Ubah kata kunci atau filter sumber untuk menemukan entitas watchlist."
                action={
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      setQuery("");
                      setSourceFilter("all");
                      setTypeFilter("all");
                    }}
                  >
                    Reset filter
                  </button>
                }
              />
            )}
          </div>
        ) : null}

        {tab === "whitelist" ? (
          <div className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3.5">
              <div>
                <p className="text-[0.82rem] font-bold text-ink-900">
                  Whitelist false positive
                </p>
                <p className="mt-0.5 text-[0.68rem] text-slate-500">
                  Pengecualian permanen yang telah diverifikasi dokumen resmi dan
                  disetujui Approver.
                </p>
              </div>
              <span className="badge badge-clean">
                {data?.whitelist.length ?? 0} terverifikasi
              </span>
            </div>
            {data?.whitelist.length ? (
              <div className="overflow-x-auto">
                <table className="data-table min-w-[860px]">
                  <thead>
                    <tr>
                      <th>Nasabah</th>
                      <th>Entitas watchlist</th>
                      <th>Alasan</th>
                      <th>Disetujui</th>
                      <th>Tanggal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.whitelist.map((record) => (
                      <tr key={record.id}>
                        <td>
                          <p className="primary-cell text-[0.76rem]">
                            {record.customer_name}
                          </p>
                          <p className="mono mt-0.5 text-[0.61rem] text-slate-400">
                            {record.customer_cif} · {record.customer_nik}
                          </p>
                        </td>
                        <td className="text-[0.72rem] font-semibold text-ink-800">
                          {record.entity_name}
                        </td>
                        <td>
                          <p className="max-w-[330px] text-[0.67rem] leading-relaxed text-slate-500">
                            {record.reason}
                          </p>
                        </td>
                        <td className="text-[0.7rem] font-semibold text-ink-800">
                          {record.approved_by}
                        </td>
                        <td className="text-[0.67rem] text-slate-500">
                          {formatDateTimeId(record.whitelisted_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                icon={<ShieldCheck size={22} />}
                title="Belum ada whitelist"
                description="Whitelist hanya dapat disetujui setelah verifikasi biometrik/KTP dan persetujuan Compliance Head."
              />
            )}
          </div>
        ) : null}

        {tab === "versions" ? (
          <div className="card overflow-hidden">
            <div className="border-b border-line px-4 py-3.5">
              <p className="text-[0.82rem] font-bold text-ink-900">
                Riwayat versi & sumber
              </p>
              <p className="mt-0.5 text-[0.68rem] text-slate-500">
                Setiap unggahan membuat versi baru dan menonaktifkan versi aktif
                sebelumnya untuk sumber yang sama.
              </p>
            </div>
            <div className="overflow-x-auto">
              <table className="data-table min-w-[900px]">
                <thead>
                  <tr>
                    <th>Sumber</th>
                    <th>Versi</th>
                    <th>Penerbit</th>
                    <th>Masa Berlaku</th>
                    <th>File master</th>
                    <th>Entitas</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(data?.sources ?? []).map((source) => (
                    <tr key={source.id}>
                      <td>
                        <span
                          className="badge !px-2 !py-0.5"
                          style={{
                            background: SOURCE_META[source.source_code].bg,
                            color: SOURCE_META[source.source_code].color,
                          }}
                        >
                          {source.source_code}
                        </span>
                      </td>
                      <td className="primary-cell text-[0.73rem]">
                        {source.version_label}
                      </td>
                      <td className="text-[0.7rem] text-slate-600">
                        {source.published_by}
                      </td>
                      <td className="text-[0.67rem] text-slate-500">
                        {formatDateId(source.effective_date)} —{" "}
                        {source.expiry_date
                          ? formatDateId(source.expiry_date)
                          : "sekarang"}
                      </td>
                      <td>
                        <span className="mono max-w-[170px] truncate text-[0.63rem] text-slate-500">
                          {source.excel_file_name}
                        </span>
                      </td>
                      <td className="text-[0.72rem] font-bold text-ink-800">
                        {source.entity_count}
                      </td>
                      <td>
                        <span
                          className={clsx(
                            "badge",
                            source.is_current ? "badge-clean" : "badge-neutral",
                          )}
                        >
                          {source.is_current ? "Versi aktif" : "Historis"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>

      <Drawer
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.primary_name ?? "Detail entitas"}
        description={
          selected
            ? `${SOURCE_META[selected.source_code].label} · ${selected.source_version}`
            : undefined
        }
        width="max-w-2xl"
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
                className="btn btn-primary"
                onClick={() => openWhitelist(selected)}
                disabled={user.role_code !== "APPROVER_HEAD"}
                title={
                  user.role_code !== "APPROVER_HEAD"
                    ? "Hanya Approver yang dapat menyetujui whitelist"
                    : undefined
                }
              >
                <Plus size={14} /> Tambah Whitelist
              </button>
            </>
          ) : null
        }
      >
        {selected ? (
          <div className="space-y-5">
            <div className="flex items-start gap-3">
              <span
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                style={{
                  background: SOURCE_META[selected.source_code].bg,
                  color: SOURCE_META[selected.source_code].color,
                }}
              >
                {selected.entity_type === "CORPORATE" ? (
                  <Building2 size={20} />
                ) : (
                  <UserRound size={20} />
                )}
              </span>
              <div>
                <div className="flex flex-wrap gap-1.5">
                  <span
                    className="badge !px-2 !py-0.5"
                    style={{
                      background: SOURCE_META[selected.source_code].bg,
                      color: SOURCE_META[selected.source_code].color,
                    }}
                  >
                    {selected.source_code}
                  </span>
                  <span className="badge badge-neutral">
                    {selected.entity_type === "CORPORATE"
                      ? "Korporasi"
                      : "Individual"}
                  </span>
                  <span
                    className={clsx(
                      "badge",
                      selected.is_active ? "badge-clean" : "badge-neutral",
                    )}
                  >
                    {selected.is_active ? "Aktif" : "Nonaktif"}
                  </span>
                </div>
                <p className="mt-2 text-[0.66rem] text-slate-500">
                  Terdaftar {formatDateTimeId(selected.created_at)}
                </p>
              </div>
            </div>

            <div className="grid gap-3 rounded-xl border border-line bg-slate-50/60 p-3.5 sm:grid-cols-2">
              <Field
                label="Tanggal lahir"
                value={formatDateId(selected.date_of_birth)}
              />
              <Field label="Tempat lahir" value={selected.place_of_birth} />
              <Field label="Kewarganegaraan" value={selected.nationality} />
              <Field label="Versi sumber" value={selected.source_version} />
              <div className="sm:col-span-2">
                <Field label="Alamat" value={selected.address_info} />
              </div>
              <div className="sm:col-span-2">
                <Field
                  label="Dasar hukum"
                  value={selected.legal_reference}
                  hint="Nomor penetapan pengadilan / rujukan regulator"
                />
              </div>
            </div>

            <div>
              <p className="mb-2 flex items-center gap-1.5 text-[0.72rem] font-bold text-ink-900">
                <UsersRound size={14} /> Alias terdeteksi
              </p>
              {selected.aliases.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {selected.aliases.map((alias) => (
                    <span
                      key={alias}
                      className="rounded-lg border border-line bg-white px-2 py-1 text-[0.68rem] text-slate-600"
                    >
                      {alias}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-[0.7rem] text-slate-400">Tidak ada alias.</p>
              )}
            </div>

            <div>
              <p className="mb-2 flex items-center gap-1.5 text-[0.72rem] font-bold text-ink-900">
                <IdCard size={14} /> Dokumen identitas
              </p>
              {selected.documents.length ? (
                <div className="space-y-1.5">
                  {selected.documents.map((document) => (
                    <div
                      key={`${document.type}-${document.number}`}
                      className="flex items-center justify-between rounded-lg border border-line px-3 py-2"
                    >
                      <span className="badge badge-info">{document.type}</span>
                      <span className="mono text-[0.7rem] font-semibold text-ink-800">
                        {document.number}
                      </span>
                      <span className="text-[0.62rem] text-slate-400">
                        {document.country}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[0.7rem] text-slate-400">
                  Tidak ada dokumen identitas.
                </p>
              )}
            </div>

            {user.role_code !== "APPROVER_HEAD" ? (
              <Alert variant="info" icon={<ShieldCheck size={15} />}>
                Whitelist hanya dapat disetujui oleh{" "}
                <strong>Compliance Head</strong>. Beralih persona melalui menu
                profil untuk menguji alur ini.
              </Alert>
            ) : null}
          </div>
        ) : null}
      </Drawer>

      <ImportWatchlistModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={() => {
          refresh();
        }}
      />

      <WhitelistModal
        open={whitelistOpen}
        entity={whitelistEntity}
        onClose={() => setWhitelistOpen(false)}
        onCreated={refresh}
      />
    </div>
  );
}

/* ------------------------------ Import modal ------------------------------ */

function ImportWatchlistModal({
  open,
  onClose,
  onImported,
}: {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}) {
  const { apiFetch } = useDemoUser();
  const toast = useToast();
  const [sourceCode, setSourceCode] = useState<SourceCode>("DTTOT");
  const [versionLabel, setVersionLabel] = useState("");
  const [publishedBy, setPublishedBy] = useState("PPATK");
  const [effectiveDate, setEffectiveDate] = useState("2026-10-20");
  const [expiryDate, setExpiryDate] = useState("");
  const [legalBasis, setLegalBasis] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{
    imported: number;
    aliases: number;
    documents: number;
    skipped: number;
    errors: Array<{ row: number; reason: string }>;
  } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setResult(null);
      setFile(null);
      setVersionLabel("");
      setExpiryDate("");
      setLegalBasis("");
    }
  }, [open]);

  function handleFiles(files: FileList | null) {
    const selectedFile = files?.[0];
    if (!selectedFile) return;
    if (!/\.(xlsx|xls|csv)$/i.test(selectedFile.name)) {
      toast.error("Format file tidak didukung", "Gunakan .xlsx, .xls, atau .csv.");
      return;
    }
    setFile(selectedFile);
    if (!versionLabel) {
      setVersionLabel(selectedFile.name.replace(/\.[^.]+$/, ""));
    }
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    handleFiles(event.dataTransfer.files);
  }

  async function submit() {
    if (!file) {
      toast.error("File belum dipilih");
      return;
    }
    if (!versionLabel.trim()) {
      toast.error("Label versi wajib diisi");
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.set("file", file);
      formData.set("sourceCode", sourceCode);
      formData.set("versionLabel", versionLabel.trim());
      formData.set("publishedBy", publishedBy);
      formData.set("effectiveDate", effectiveDate);
      formData.set("expiryDate", expiryDate);
      formData.set("legalBasis", legalBasis);
      const payload = await apiFetch<{
        imported: number;
        aliases: number;
        documents: number;
        skipped: number;
        errors: Array<{ row: number; reason: string }>;
      }>("/api/watchlist/import", { method: "POST", body: formData });
      setResult(payload);
      toast.success(
        "Watchlist berhasil diimpor",
        `${payload.imported} entitas, ${payload.aliases} alias, ${payload.documents} dokumen.`,
      );
      onImported();
    } catch (error) {
      toast.error("Import watchlist gagal", (error as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Import Master Watchlist"
      description="Unggah file Excel resmi. Header akan divalidasi otomatis dan alias diekstraksi dari kolom Aliases."
      size="lg"
      footer={
        result ? (
          <>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Selesai
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                onClose();
              }}
            >
              Lihat data <ArrowRight size={14} />
            </button>
          </>
        ) : (
          <>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Batal
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={submit}
              disabled={submitting || !file}
            >
              {submitting ? (
                <>
                  <RefreshCw size={14} className="animate-spin" /> Memproses...
                </>
              ) : (
                <>
                  <UploadCloud size={14} /> Import & aktifkan versi
                </>
              )}
            </button>
          </>
        )
      }
    >
      {result ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="flex items-center gap-2 text-emerald-800">
              <CheckCircle2 size={20} />
              <p className="text-[0.9rem] font-bold">
                Versi watchlist berhasil diaktifkan
              </p>
            </div>
            <p className="mt-1 text-[0.72rem] text-emerald-700">
              Smart matching engine akan menggunakan versi ini pada screening
              berikutnya.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["Entitas", result.imported],
              ["Alias", result.aliases],
              ["Dokumen", result.documents],
              ["Dilewati", result.skipped],
            ].map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-line bg-slate-50 px-3 py-2.5"
              >
                <p className="text-[0.58rem] font-bold uppercase tracking-wider text-slate-400">
                  {label}
                </p>
                <p className="mt-1 text-[1.15rem] font-extrabold text-ink-900">
                  {value}
                </p>
              </div>
            ))}
          </div>
          {result.errors.length ? (
            <div>
              <p className="mb-1.5 text-[0.72rem] font-bold text-ink-900">
                Baris yang dilewati
              </p>
              <div className="max-h-40 space-y-1 overflow-y-auto scroll-area">
                {result.errors.map((error) => (
                  <p
                    key={`${error.row}-${error.reason}`}
                    className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-[0.67rem] text-amber-800"
                  >
                    Baris {error.row}: {error.reason}
                  </p>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="field-label">Kode sumber *</label>
              <select
                className="select"
                value={sourceCode}
                onChange={(event) => setSourceCode(event.target.value as SourceCode)}
              >
                {SOURCE_CODES.map((code) => (
                  <option key={code} value={code}>
                    {SOURCE_META[code].label} — {SOURCE_META[code].description}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="field-label">Penerbit *</label>
              <select
                className="select"
                value={publishedBy}
                onChange={(event) => setPublishedBy(event.target.value)}
              >
                <option>PPATK</option>
                <option>OJK</option>
                <option>POLRI</option>
                <option>UN Security Council</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="field-label">Label versi *</label>
              <input
                className="input"
                value={versionLabel}
                onChange={(event) => setVersionLabel(event.target.value)}
                placeholder="Contoh: DTTOT Tahap III Tahun 2026"
              />
            </div>
            <div>
              <label className="field-label">Tanggal efektif *</label>
              <input
                type="date"
                className="input"
                value={effectiveDate}
                onChange={(event) => setEffectiveDate(event.target.value)}
              />
            </div>
            <div>
              <label className="field-label">Tanggal kedaluwarsa</label>
              <input
                type="date"
                className="input"
                value={expiryDate}
                onChange={(event) => setExpiryDate(event.target.value)}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="field-label">Dasar hukum default</label>
              <input
                className="input"
                value={legalBasis}
                onChange={(event) => setLegalBasis(event.target.value)}
                placeholder="Opsional — dipakai jika kolom Legal Basis kosong"
              />
            </div>
          </div>

          <div
            className={clsx("dropzone p-4", dragging && "dragging")}
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
            role="button"
            tabIndex={0}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(event) => handleFiles(event.target.files)}
            />
            {file ? (
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
                  <FileSpreadsheet size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[0.78rem] font-bold text-ink-900">
                    {file.name}
                  </p>
                  <p className="mt-0.5 text-[0.65rem] text-slate-500">
                    {(file.size / 1024).toFixed(1)} KB · siap divalidasi
                  </p>
                </div>
                <button
                  type="button"
                  className="icon-btn h-7 w-7"
                  onClick={(event) => {
                    event.stopPropagation();
                    setFile(null);
                  }}
                  aria-label="Hapus file"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-4 text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-slate-400 shadow-sm">
                  <UploadCloud size={21} />
                </span>
                <p className="mt-2 text-[0.76rem] font-bold text-ink-900">
                  Tarik file ke sini atau klik untuk memilih
                </p>
                <p className="mt-1 text-[0.64rem] text-slate-500">
                  .xlsx, .xls, .csv · maksimal 25 MB
                </p>
              </div>
            )}
          </div>

          <div className="rounded-lg border border-line bg-slate-50/70 px-3 py-2.5">
            <p className="text-[0.62rem] font-bold uppercase tracking-wider text-slate-400">
              Header yang divalidasi
            </p>
            <p className="mt-1 text-[0.67rem] leading-relaxed text-slate-500">
              Source · Entity Name · Aliases · ID / Passport · DOB · POB ·
              Nationality · Legal Basis. Minimal kolom <strong>Entity Name</strong>{" "}
              harus ada.{" "}
              <a
                href="/api/watchlist/template"
                className="font-bold text-brand-700 underline"
                download
              >
                Unduh template
              </a>
            </p>
          </div>

          {submitting ? (
            <Alert variant="info" icon={<RefreshCw size={15} className="animate-spin" />}>
              Memvalidasi header, mengekstraksi alias, dan menyimpan entitas ke
              database...
            </Alert>
          ) : null}
        </div>
      )}
    </Modal>
  );
}

/* ----------------------------- Whitelist modal ---------------------------- */

function WhitelistModal({
  open,
  entity,
  onClose,
  onCreated,
}: {
  open: boolean;
  entity: WatchlistEntityView | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { user, apiFetch } = useDemoUser();
  const toast = useToast();
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [customerQuery, setCustomerQuery] = useState("");
  const [customer, setCustomer] = useState<CustomerOption | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;
    setCustomer(null);
    setReason("");
    setCustomerQuery("");
    apiFetch<{ items: CustomerOption[] }>("/api/customers?limit=100")
      .then((payload) => setCustomers(payload.items))
      .catch(() => setCustomers([]));
  }, [open, apiFetch]);

  const filtered = customers.filter((item) => {
    if (!customerQuery) return true;
    const query = customerQuery.toLowerCase();
    return (
      item.full_name.toLowerCase().includes(query) ||
      item.cif_number.toLowerCase().includes(query)
    );
  });

  async function submit() {
    if (!entity || !customer) {
      toast.error("Pilih nasabah terlebih dahulu");
      return;
    }
    if (reason.trim().length < 20) {
      toast.error("Alasan minimal 20 karakter");
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch("/api/watchlist/whitelist", {
        method: "POST",
        body: JSON.stringify({
          entity_id: entity.id,
          customer_cif: customer.cif_number,
          reason: reason.trim(),
        }),
      });
      toast.success(
        "Whitelist disetujui",
        `${customer.full_name} dikecualikan dari ${entity.primary_name}.`,
      );
      onCreated();
      onClose();
    } catch (error) {
      toast.error("Gagal menyimpan whitelist", (error as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Setujui Whitelist False Positive"
      description="Pengecualian permanen harus berdasarkan verifikasi biometrik atau dokumen KTP resmi."
      size="md"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Batal
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={submit}
            disabled={
              submitting || !customer || user.role_code !== "APPROVER_HEAD"
            }
          >
            {submitting ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <ShieldCheck size={14} />
            )}
            Setujui whitelist
          </button>
        </>
      }
    >
      <div className="space-y-4">
        {entity ? (
          <div className="rounded-lg border border-line bg-slate-50 px-3 py-2.5">
            <p className="text-[0.6rem] font-bold uppercase tracking-wider text-slate-400">
              Entitas watchlist
            </p>
            <p className="mt-0.5 text-[0.78rem] font-bold text-ink-900">
              {entity.primary_name}
            </p>
            <p className="mt-0.5 text-[0.64rem] text-slate-500">
              {SOURCE_META[entity.source_code].label} · {entity.source_version}
            </p>
          </div>
        ) : null}

        <div>
          <label className="field-label">Pilih nasabah *</label>
          <div className="search-box">
            <Search size={14} />
            <input
              className="input"
              placeholder="Cari nama atau CIF nasabah..."
              value={customerQuery}
              onChange={(event) => setCustomerQuery(event.target.value)}
            />
          </div>
          <div className="mt-1.5 max-h-[180px] overflow-y-auto scroll-area rounded-lg border border-line">
            {filtered.slice(0, 20).map((option) => (
              <button
                key={option.id}
                type="button"
                onClick={() => setCustomer(option)}
                className={clsx(
                  "flex w-full items-center gap-2.5 border-b border-line px-3 py-2 text-left last:border-0 hover:bg-slate-50",
                  customer?.id === option.id && "bg-brand-50",
                )}
              >
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-[0.55rem] font-bold text-slate-600">
                  {getInitials(option.full_name)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[0.72rem] font-semibold text-ink-900">
                    {option.full_name}
                  </span>
                  <span className="mono block text-[0.6rem] text-slate-400">
                    {option.cif_number} · {option.national_id_masked}
                  </span>
                </span>
                {customer?.id === option.id ? (
                  <CheckCircle2 size={15} className="text-brand-600" />
                ) : null}
              </button>
            ))}
            {!filtered.length ? (
              <p className="px-3 py-5 text-center text-[0.68rem] text-slate-400">
                Nasabah tidak ditemukan.
              </p>
            ) : null}
          </div>
        </div>

        <div>
          <label className="field-label">Alasan & bukti verifikasi *</label>
          <textarea
            className="textarea"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Jelaskan hasil verifikasi biometrik/KTP, perbedaan DOB/NIK, dan dasar keputusan..."
          />
          <p className="mt-1 text-[0.61rem] text-slate-400">
            {reason.trim().length}/20 karakter minimum.
          </p>
        </div>

        <Alert variant="warning" icon={<AlertTriangle size={15} />}>
          Whitelist akan mengecualikan pasangan nasabah–entitas ini dari seluruh
          hasil screening berikutnya. Tindakan tercatat permanen di audit trail.
        </Alert>
      </div>
    </Modal>
  );
}
