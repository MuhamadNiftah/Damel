"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CalendarClock,
  Database,
  Download,
  FileSpreadsheet,
  FileText,
  Globe2,
  Layers,
  ListChecks,
  Search,
  ShieldAlert,
  Upload,
  Users,
} from "lucide-react";
import type {
  SourceCode,
  WatchlistEntityView,
  WatchlistSourceView,
} from "@/lib/types";
import {
  CATEGORY_LABELS,
  WATCHLIST_CATEGORY_META,
  type WatchlistCategory,
} from "@/lib/watchlist-categories";
import { useDemoUser } from "@/components/user-provider";
import { useToast } from "@/components/toast-provider";
import {
  EmptyState,
  Field,
  MetricCard,
  Modal,
  Pagination,
  SearchInput,
  Skeleton,
  Tabs,
} from "@/components/ui";
import { formatDateId, formatDateTimeId } from "@/lib/normalize";
import { clsx } from "@/lib/ui";

interface WatchlistResponse {
  sources: WatchlistSourceView[];
  entities: WatchlistEntityView[];
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

type TabKey = "entitas" | "sumber";

const PAGE_SIZE = 15;

export function WatchlistDatasetPage({
  category,
}: {
  category: WatchlistCategory;
}) {
  const meta = WATCHLIST_CATEGORY_META[category];
  const { apiFetch, downloadFile, user } = useDemoUser();
  const toast = useToast();
  const [data, setData] = useState<WatchlistResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [sourceFilter, setSourceFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [activeFilter, setActiveFilter] = useState("true");
  const [page, setPage] = useState(1);
  const [tab, setTab] = useState<TabKey>("entitas");
  const [selected, setSelected] = useState<WatchlistEntityView | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [importForm, setImportForm] = useState({
    sourceCode: meta.sources[0] as SourceCode,
    versionLabel: "",
    publishedBy: category === "DTTOT" ? "PPATK / BNPT" : "PPATK",
    effectiveDate: "2026-10-20",
    expiryDate: "",
    legalBasis: "",
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const canImport = ["MAKER_ANALYST", "CHECKER_SUPERVISOR", "APPROVER_HEAD", "ADMIN"].includes(
    user.role_code,
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await apiFetch<WatchlistResponse>(
        `/api/watchlist?category=${category}`,
      );
      setData(payload);
    } catch (error) {
      toast.error("Gagal memuat data", (error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, category, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (data?.entities ?? []).filter((entity) => {
      if (sourceFilter && entity.source_code !== sourceFilter) return false;
      if (typeFilter && entity.entity_type !== typeFilter) return false;
      if (activeFilter === "true" && !entity.is_active) return false;
      if (activeFilter === "false" && entity.is_active) return false;
      if (!needle) return true;
      return [
        entity.primary_name,
        entity.nationality ?? "",
        entity.legal_reference ?? "",
        entity.place_of_birth ?? "",
        entity.source_version,
        ...entity.aliases,
      ]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [data, query, sourceFilter, typeFilter, activeFilter]);

  useEffect(() => {
    setPage(1);
  }, [query, sourceFilter, typeFilter, activeFilter]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const metrics = data?.metrics;

  async function exportData() {
    try {
      const search = new URLSearchParams({ category });
      if (sourceFilter) search.set("source", sourceFilter);
      await downloadFile(
        `/api/watchlist/export?${search.toString()}`,
        `${category}_DMB.xlsx`,
      );
      toast.success("Ekspor selesai", `Data ${meta.short} diunduh dalam format Excel.`);
    } catch (error) {
      toast.error("Ekspor gagal", (error as Error).message);
    }
  }

  async function downloadTemplate() {
    try {
      await downloadFile("/api/watchlist/template", "Template_Master_Watchlist_DMB.xlsx");
    } catch (error) {
      toast.error("Unduhan gagal", (error as Error).message);
    }
  }

  function resetImportForm() {
    setFile(null);
    setImportForm({
      sourceCode: meta.sources[0] as SourceCode,
      versionLabel: "",
      publishedBy: category === "DTTOT" ? "PPATK / BNPT" : "PPATK",
      effectiveDate: "2026-10-20",
      expiryDate: "",
      legalBasis: "",
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function submitImport() {
    if (!file) {
      toast.error("File belum dipilih", "Pilih file Excel watchlist terlebih dahulu.");
      return;
    }
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("sourceCode", importForm.sourceCode);
      formData.append(
        "versionLabel",
        importForm.versionLabel || file.name.replace(/\.[^.]+$/, ""),
      );
      formData.append("publishedBy", importForm.publishedBy);
      formData.append("effectiveDate", importForm.effectiveDate);
      formData.append("expiryDate", importForm.expiryDate);
      formData.append("legalBasis", importForm.legalBasis);
      const result = await apiFetch<{
        imported: number;
        aliases: number;
        documents: number;
        skipped: number;
      }>("/api/watchlist/import", { method: "POST", body: formData });
      toast.success(
        "Impor selesai",
        `${result.imported} entitas, ${result.aliases} alias, ${result.documents} dokumen. ${result.skipped} baris dilewati.`,
      );
      setImportOpen(false);
      resetImportForm();
      await load();
    } catch (error) {
      toast.error("Impor gagal", (error as Error).message);
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[0.66rem] font-bold uppercase tracking-[0.14em] text-brand-700">
            Manajemen Data {meta.short}
          </p>
          <h1 className="mt-0.5 text-[1.35rem] font-extrabold tracking-tight text-ink-900 sm:text-[1.55rem]">
            {meta.label}
          </h1>
          <p className="mt-1 max-w-3xl text-[0.78rem] leading-relaxed text-slate-500">
            {meta.description} Data lengkap mencakup alias, dokumen identitas,
            dasar hukum, dan versi sumber.
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="badge badge-info">
              <ShieldAlert size={12} /> {meta.regulation}
            </span>
            <span className="badge badge-neutral">
              <CalendarClock size={12} /> Diperbarui{" "}
              {metrics?.lastUpdated ? formatDateTimeId(metrics.lastUpdated) : "—"}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" className="btn btn-secondary btn-sm" onClick={downloadTemplate}>
            <FileSpreadsheet size={14} /> Template
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={exportData}>
            <Download size={14} /> Ekspor Excel
          </button>
          {canImport ? (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setImportOpen(true)}
            >
              <Upload size={14} /> Impor data
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label={`Entitas ${meta.short}`}
          value={metrics?.totalEntities ?? "—"}
          sub={`${metrics?.activeEntities ?? 0} entitas aktif`}
          icon={category === "DTTOT" ? <ShieldAlert size={17} /> : <ListChecks size={17} />}
          tone="brand"
        />
        <MetricCard
          label="Sumber / versi"
          value={metrics?.totalSources ?? "—"}
          sub={`${metrics?.currentSources ?? 0} versi aktif`}
          icon={<Layers size={17} />}
          tone="ink"
          delay="stagger-1"
        />
        <MetricCard
          label="Alias terdaftar"
          value={metrics?.totalAliases ?? "—"}
          sub="Nama lain, FKA, dan variasi ejaan"
          icon={<Users size={17} />}
          tone="violet"
          delay="stagger-2"
        />
        <MetricCard
          label="Dokumen identitas"
          value={metrics?.totalDocuments ?? "—"}
          sub={`${metrics?.totalWhitelist ?? 0} whitelist terkait`}
          icon={<FileText size={17} />}
          tone="medium"
          delay="stagger-3"
        />
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-col gap-2.5 border-b border-line px-3.5 py-3 lg:flex-row lg:items-center">
          <div className="flex items-center gap-2">
            <Tabs
              tabs={[
                { value: "entitas", label: "Entitas", count: filtered.length },
                { value: "sumber", label: "Sumber & versi", count: data?.sources.length },
              ]}
              value={tab}
              onChange={setTab}
            />
          </div>
          {tab === "entitas" ? (
            <div className="flex flex-1 flex-wrap items-center gap-2 lg:justify-end">
              <SearchInput
                value={query}
                onChange={setQuery}
                placeholder="Cari nama, alias, atau dasar hukum..."
                className="lg:max-w-xs"
              />
              {category === "APUPPT" ? (
                <select
                  className="select w-auto"
                  value={sourceFilter}
                  onChange={(event) => setSourceFilter(event.target.value)}
                >
                  <option value="">Semua sumber</option>
                  {meta.sources.map((source) => (
                    <option key={source} value={source}>
                      {CATEGORY_LABELS[source]}
                    </option>
                  ))}
                </select>
              ) : null}
              <select
                className="select w-auto"
                value={typeFilter}
                onChange={(event) => setTypeFilter(event.target.value)}
              >
                <option value="">Semua tipe</option>
                <option value="INDIVIDUAL">Individu</option>
                <option value="CORPORATE">Korporasi</option>
              </select>
              <select
                className="select w-auto"
                value={activeFilter}
                onChange={(event) => setActiveFilter(event.target.value)}
              >
                <option value="true">Aktif</option>
                <option value="false">Tidak aktif</option>
                <option value="">Semua status</option>
              </select>
            </div>
          ) : null}
        </div>

        {loading && !data ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : tab === "entitas" ? (
          filtered.length === 0 ? (
            <EmptyState
              icon={<Search size={21} />}
              title="Entitas tidak ditemukan"
              description="Ubah filter atau kata kunci pencarian."
            />
          ) : (
            <>
              <div className="table-shell">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Nama entitas</th>
                      <th>Tipe</th>
                      <th>Kewarganegaraan</th>
                      <th>Lahir / lokasi</th>
                      <th>Dasar hukum</th>
                      <th>Sumber</th>
                      <th>Alias</th>
                      <th className="text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paged.map((entity) => (
                      <tr key={entity.id}>
                        <td>
                          <button
                            type="button"
                            className="primary-cell text-left hover:text-brand-700"
                            onClick={() => setSelected(entity)}
                          >
                            {entity.primary_name}
                          </button>
                          <div className="mt-0.5 flex items-center gap-2 text-[0.6rem] text-slate-400">
                            <span className="mono">{entity.id}</span>
                            <span
                              className={clsx(
                                "badge",
                                entity.is_active ? "badge-clean" : "badge-neutral",
                              )}
                            >
                              {entity.is_active ? "Aktif" : "Nonaktif"}
                            </span>
                          </div>
                        </td>
                        <td className="text-[0.72rem]">
                          {entity.entity_type === "CORPORATE" ? "Korporasi" : "Individu"}
                        </td>
                        <td className="text-[0.72rem]">{entity.nationality ?? "—"}</td>
                        <td className="text-[0.7rem]">
                          <p>{entity.date_of_birth ? formatDateId(entity.date_of_birth) : "—"}</p>
                          <p className="text-[0.62rem] text-slate-400">
                            {entity.place_of_birth ?? "—"}
                          </p>
                        </td>
                        <td className="max-w-[220px] text-[0.68rem] text-slate-600">
                          {entity.legal_reference ?? "—"}
                        </td>
                        <td>
                          <span className="badge badge-info">{entity.source_code}</span>
                          <p className="mt-0.5 text-[0.6rem] text-slate-400">
                            {entity.source_version}
                          </p>
                        </td>
                        <td className="text-[0.72rem]">{entity.aliases.length}</td>
                        <td className="text-right">
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setSelected(entity)}
                          >
                            Detail <ArrowUpRight size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={page}
                pageCount={totalPages}
                total={filtered.length}
                onChange={setPage}
              />
            </>
          )
        ) : (
          <div className="table-shell">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Sumber</th>
                  <th>Versi</th>
                  <th>Penerbit</th>
                  <th>Efektif</th>
                  <th>Diunggah</th>
                  <th className="text-right">Entitas</th>
                  <th className="text-right">Alias</th>
                  <th className="text-right">Dokumen</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data?.sources.map((source) => (
                  <tr key={source.id}>
                    <td>
                      <span className="badge badge-info">{source.source_code}</span>
                      <p className="mt-0.5 max-w-[220px] truncate text-[0.62rem] text-slate-400">
                        {source.excel_file_name}
                      </p>
                    </td>
                    <td className="text-[0.72rem] font-semibold">{source.version_label}</td>
                    <td className="text-[0.72rem]">{source.published_by}</td>
                    <td className="text-[0.72rem]">{formatDateId(source.effective_date)}</td>
                    <td className="text-[0.68rem] text-slate-500">
                      {formatDateTimeId(source.uploaded_at)}
                    </td>
                    <td className="text-right font-semibold">{source.entity_count}</td>
                    <td className="text-right">{source.alias_count}</td>
                    <td className="text-right">{source.document_count}</td>
                    <td>
                      <span
                        className={clsx(
                          "badge",
                          source.is_current ? "badge-clean" : "badge-neutral",
                        )}
                      >
                        {source.is_current ? "Versi aktif" : "Arsip"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-white px-4 py-3">
        <p className="text-[0.68rem] text-slate-500">
          Butuh whitelist, validasi manual, atau pengelolaan sumber lain?
        </p>
        <Link href="/watchlist" className="btn btn-secondary btn-sm">
          <Database size={13} /> Buka watchlist master <ArrowUpRight size={12} />
        </Link>
      </div>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.primary_name ?? "Detail entitas"}
        description={
          selected
            ? `${selected.entity_type === "CORPORATE" ? "Korporasi" : "Individu"} · ${selected.source_code} ${selected.source_version}`
            : undefined
        }
        footer={
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setSelected(null)}
          >
            Tutup
          </button>
        }
      >
        {selected ? (
          <div className="space-y-4">
            <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2">
              <Field label="Nama utama" value={selected.primary_name} />
              <Field label="Tipe entitas" value={selected.entity_type} />
              <Field label="Kewarganegaraan" value={selected.nationality ?? "—"} />
              <Field label="Tanggal lahir" value={formatDateId(selected.date_of_birth)} />
              <Field label="Tempat lahir" value={selected.place_of_birth ?? "—"} />
              <Field label="Status" value={selected.is_active ? "Aktif" : "Nonaktif"} />
              <div className="sm:col-span-2">
                <Field label="Alamat / informasi lokasi" value={selected.address_info ?? "—"} />
              </div>
              <div className="sm:col-span-2">
                <Field label="Dasar hukum" value={selected.legal_reference ?? "—"} />
              </div>
            </div>

            <div className="divider" />

            <div>
              <p className="text-[0.64rem] font-bold uppercase tracking-[0.08em] text-slate-400">
                Alias ({selected.aliases.length})
              </p>
              {selected.aliases.length ? (
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {selected.aliases.map((alias) => (
                    <span key={alias} className="badge badge-neutral">
                      {alias}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-[0.7rem] text-slate-400">Tidak ada alias.</p>
              )}
            </div>

            <div>
              <p className="text-[0.64rem] font-bold uppercase tracking-[0.08em] text-slate-400">
                Dokumen identitas ({selected.documents.length})
              </p>
              {selected.documents.length ? (
                <div className="mt-1.5 space-y-1.5">
                  {selected.documents.map((document, index) => (
                    <div
                      key={`${document.type}-${index}`}
                      className="flex items-center justify-between rounded-lg border border-line px-3 py-2 text-[0.72rem]"
                    >
                      <span className="flex items-center gap-2 font-semibold text-ink-800">
                        <FileText size={13} className="text-slate-400" />
                        {document.type}
                      </span>
                      <span className="mono text-slate-600">{document.number}</span>
                      <span className="text-[0.64rem] text-slate-400">{document.country}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="mt-1 text-[0.7rem] text-slate-400">
                  Tidak ada dokumen identitas.
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-[0.66rem] text-slate-500">
              <Globe2 size={13} />
              <span>
                Sumber: <span className="font-semibold text-ink-800">{selected.source_code}</span>{" "}
                · {selected.source_version}
              </span>
              <span className="text-slate-300">|</span>
              <span>{selected.whitelist_count} whitelist terkait</span>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title={`Impor data ${meta.short}`}
        description="Unggah file Excel sesuai template. Versi baru otomatis menjadi versi aktif."
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setImportOpen(false)}
              disabled={importing}
            >
              Batal
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={submitImport}
              disabled={importing || !file}
            >
              {importing ? "Mengimpor..." : "Impor sekarang"}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div
            className="dropzone cursor-pointer p-5 text-center"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const dropped = event.dataTransfer.files?.[0];
              if (dropped) setFile(dropped);
            }}
          >
            <FileSpreadsheet size={26} className="mx-auto text-brand-600" />
            <p className="mt-2 text-[0.78rem] font-bold text-ink-900">
              {file ? file.name : "Pilih atau tarik file Excel ke sini"}
            </p>
            <p className="mt-0.5 text-[0.66rem] text-slate-500">
              Format .xlsx, .xls, atau .csv — maksimal 25 MB
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <label>
              <span className="field-label">Kode sumber</span>
              <select
                className="select"
                value={importForm.sourceCode}
                onChange={(event) =>
                  setImportForm({
                    ...importForm,
                    sourceCode: event.target.value as SourceCode,
                  })
                }
              >
                {meta.sources.map((source) => (
                  <option key={source} value={source}>
                    {CATEGORY_LABELS[source]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="field-label">Label versi</span>
              <input
                className="input"
                placeholder="Contoh: DTTOT Oktober 2026"
                value={importForm.versionLabel}
                onChange={(event) =>
                  setImportForm({ ...importForm, versionLabel: event.target.value })
                }
              />
            </label>
            <label>
              <span className="field-label">Penerbit</span>
              <input
                className="input"
                value={importForm.publishedBy}
                onChange={(event) =>
                  setImportForm({ ...importForm, publishedBy: event.target.value })
                }
              />
            </label>
            <label>
              <span className="field-label">Tanggal efektif</span>
              <input
                className="input"
                type="date"
                value={importForm.effectiveDate}
                onChange={(event) =>
                  setImportForm({ ...importForm, effectiveDate: event.target.value })
                }
              />
            </label>
            <label>
              <span className="field-label">Tanggal kedaluwarsa (opsional)</span>
              <input
                className="input"
                type="date"
                value={importForm.expiryDate}
                onChange={(event) =>
                  setImportForm({ ...importForm, expiryDate: event.target.value })
                }
              />
            </label>
            <label>
              <span className="field-label">Dasar hukum (opsional)</span>
              <input
                className="input"
                placeholder="Contoh: UU No. 9 Tahun 2013"
                value={importForm.legalBasis}
                onChange={(event) =>
                  setImportForm({ ...importForm, legalBasis: event.target.value })
                }
              />
            </label>
          </div>

          <div className="rounded-lg border border-line bg-slate-50 px-3 py-2 text-[0.66rem] leading-relaxed text-slate-500">
            Gunakan template resmi agar pemetaan kolom otomatis berjalan. Baris
            duplikat dan data tanpa nama akan dilewati dan dilaporkan.
          </div>
        </div>
      </Modal>
    </div>
  );
}
