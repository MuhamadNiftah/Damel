"use client";

import {
  useEffect,
  useRef,
  useState,
  type DragEvent,
} from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  CheckCircle2,
  Clock3,
  Database,
  Download,
  FileCheck2,
  FileSpreadsheet,
  FileWarning,
  Info,
  Layers,
  LockKeyhole,
  RefreshCw,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  UsersRound,
  X,
  Zap,
} from "lucide-react";
import type { BatchStatus, JobStatus, MatchSeverity } from "@/lib/types";
import { formatDateTimeId, formatDateId } from "@/lib/normalize";
import { clsx, getInitials } from "@/lib/ui";
import { useDemoUser } from "@/components/user-provider";
import { useToast } from "@/components/toast-provider";
import {
  Alert,
  Drawer,
  EmptyState,
  MetricCard,
  PageHeader,
  Skeleton,
} from "@/components/ui";

interface BatchView {
  id: string;
  batch_number: string;
  original_filename: string;
  total_records: number;
  valid_records: number;
  error_records: number;
  upload_status: BatchStatus;
  created_at: string;
  completed_at: string | null;
  uploader_name: string;
  hits: number;
  job_status: JobStatus | null;
  job_id: string | null;
}

interface ScreeningResponse {
  batches: BatchView[];
  jobs: Array<{
    id: string;
    job_status: JobStatus;
    total_evaluated: number;
    total_hits: number;
    min_threshold_used: number;
    started_at: string | null;
    finished_at: string | null;
  }>;
  metrics: {
    totalBatches: number;
    totalRecords: number;
    validRecords: number;
    errorRecords: number;
    totalHits: number;
    threshold: number;
    lastScreened: string | null;
  };
}

interface UploadResult {
  batch: BatchView;
  job: {
    id: string;
    total_evaluated: number;
    total_hits: number;
  };
  staged_count: number;
  error_count: number;
  hit_count: number;
  clean_count: number;
  severity: Record<"critical" | "high" | "medium" | "low", number>;
  preview: Array<{
    row: number;
    cif: string;
    name: string;
    nik: string;
    dob: string;
    status: "VALID" | "ERROR";
    error?: string;
  }>;
  errors: Array<{ row: number; column: string; reason: string }>;
}

interface BatchDetail {
  batch: BatchView;
  job: {
    id: string;
    job_status: JobStatus;
    total_evaluated: number;
    total_hits: number;
    min_threshold_used: number;
    started_at: string | null;
    finished_at: string | null;
  } | null;
  errors: Array<{
    id: string;
    row_number: number;
    column_name: string;
    error_reason: string;
  }>;
  customers: Array<{
    id: string;
    cif_number: string;
    account_number_masked: string;
    full_name: string;
    national_id_masked: string;
    date_of_birth: string;
    customer_type: string;
  }>;
}

const STAGES = [
  { key: "upload", label: "Upload" },
  { key: "parse", label: "Parsing" },
  { key: "sanitize", label: "Sanitasi" },
  { key: "match", label: "Matching" },
  { key: "done", label: "Selesai" },
] as const;

type StageKey = (typeof STAGES)[number]["key"];

export default function ScreeningPage() {
  const { user, apiFetch, downloadFile } = useDemoUser();
  const toast = useToast();
  const [data, setData] = useState<ScreeningResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [stage, setStage] = useState<StageKey>("upload");
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<UploadResult | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<BatchView | null>(null);
  const [detail, setDetail] = useState<BatchDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const allowed =
    user.role_code === "MAKER_ANALYST" ||
    user.role_code === "CHECKER_SUPERVISOR";

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiFetch<ScreeningResponse>("/api/screening")
      .then((payload) => {
        if (active) setData(payload);
      })
      .catch((error) =>
        toast.error("Gagal memuat batch", (error as Error).message),
      )
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [apiFetch, refreshIndex, toast]);

  useEffect(() => {
    if (!selectedBatch) {
      setDetail(null);
      return;
    }
    let active = true;
    setDetailLoading(true);
    apiFetch<BatchDetail>(`/api/screening/${selectedBatch.id}`)
      .then((payload) => {
        if (active) setDetail(payload);
      })
      .catch((error) =>
        toast.error("Gagal memuat detail batch", (error as Error).message),
      )
      .finally(() => {
        if (active) setDetailLoading(false);
      });
    return () => {
      active = false;
    };
  }, [apiFetch, selectedBatch, toast]);

  function handleFiles(files: FileList | null) {
    const picked = files?.[0];
    if (!picked) return;
    if (!/\.(xlsx|xls|csv)$/i.test(picked.name)) {
      toast.error("Format tidak didukung", "Gunakan file .xlsx, .xls, atau .csv.");
      return;
    }
    if (picked.size > 50 * 1024 * 1024) {
      toast.error("File terlalu besar", "Ukuran maksimal 50 MB.");
      return;
    }
    setFile(picked);
    setResult(null);
    setStage("upload");
    setProgress(0);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    handleFiles(event.dataTransfer.files);
  }

  async function runScreening() {
    if (!file) {
      toast.error("Pilih file nasabah terlebih dahulu");
      return;
    }
    setProcessing(true);
    setResult(null);
    setStage("parse");
    setProgress(14);
    const timers: number[] = [];
    timers.push(
      window.setTimeout(() => {
        setStage("sanitize");
        setProgress(34);
      }, 450),
    );
    timers.push(
      window.setTimeout(() => {
        setStage("match");
        setProgress(62);
      }, 1000),
    );
    timers.push(
      window.setTimeout(() => {
        setProgress(82);
      }, 1700),
    );

    try {
      const formData = new FormData();
      formData.set("file", file);
      const [payload] = await Promise.all([
        apiFetch<UploadResult>("/api/screening/upload", {
          method: "POST",
          body: formData,
        }),
        new Promise((resolve) => window.setTimeout(resolve, 1900)),
      ]);
      setResult(payload);
      setStage("done");
      setProgress(100);
      setRefreshIndex((index) => index + 1);
      toast.success(
        "Screening selesai",
        `${payload.staged_count} nasabah dinilai, ${payload.hit_count} kandidat ditemukan.`,
      );
    } catch (error) {
      setStage("upload");
      setProgress(0);
      toast.error("Screening gagal", (error as Error).message);
    } finally {
      timers.forEach((timer) => window.clearTimeout(timer));
      setProcessing(false);
    }
  }

  const currentStageIndex = STAGES.findIndex((item) => item.key === stage);

  return (
    <div>
      <PageHeader
        eyebrow="Manajemen Data"
        title="Upload & Screening Nasabah"
        description="Unggah data nasabah dari Excel/CSV. Sistem memetakan kolom otomatis, menyanitasi nama, mengenkripsi NIK & rekening, lalu menjalankan smart matching."
        icon={<UploadCloud size={19} />}
        actions={
          <>
            <a href="/api/screening/template" className="btn btn-secondary" download>
              <Download size={14} /> Template nasabah
            </a>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setRefreshIndex((index) => index + 1)}
              disabled={loading}
            >
              <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
              Refresh
            </button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total batch"
          value={data?.metrics.totalBatches ?? "—"}
          sub={`${data?.metrics.validRecords ?? 0} record valid diproses`}
          icon={<Layers size={17} />}
          tone="ink"
          delay="stagger-1"
        />
        <MetricCard
          label="Record valid"
          value={(data?.metrics.validRecords ?? 0).toLocaleString("id-ID")}
          sub={`Dari ${(data?.metrics.totalRecords ?? 0).toLocaleString("id-ID")} total baris`}
          icon={<FileCheck2 size={17} />}
          tone="brand"
          delay="stagger-2"
        />
        <MetricCard
          label="Baris error"
          value={data?.metrics.errorRecords ?? "—"}
          sub="Gagal validasi NIK, tanggal, atau data wajib"
          icon={<FileWarning size={17} />}
          tone="medium"
          delay="stagger-3"
        />
        <MetricCard
          label="Kandidat ditemukan"
          value={data?.metrics.totalHits ?? "—"}
          sub={`Threshold aktif ${data?.metrics.threshold ?? 70}%`}
          icon={<ScanSearch size={17} />}
          tone="critical"
          delay="stagger-4"
        />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-[1.55fr_1fr]">
        <section className="card animate-fade-up overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-2 border-b border-line px-4 py-3.5 sm:px-5">
            <div>
              <p className="text-[0.84rem] font-bold text-ink-900">
                Unggah file nasabah
              </p>
              <p className="mt-0.5 text-[0.68rem] text-slate-500">
                Mendukung .xlsx, .xls, dan .csv hingga 50 MB / 100.000 baris.
              </p>
            </div>
            <span className="badge badge-info">
              <LockKeyhole size={10} /> AES-256-GCM
            </span>
          </div>

          <div className="p-4 sm:p-5">
            {!allowed ? (
              <Alert variant="warning" icon={<UsersRound size={16} />}>
                Persona <strong>{user.full_name}</strong> tidak memiliki izin
                upload. Beralih ke <strong>Maker / Analis AML</strong> atau{" "}
                <strong>Checker / Supervisor</strong> melalui menu profil.
              </Alert>
            ) : null}

            <div
              className={clsx(
                "dropzone mt-3 p-5 sm:p-7",
                dragging && "dragging",
                !allowed && "pointer-events-none opacity-55",
              )}
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
                <div className="flex flex-col items-center gap-3 text-center">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-50 text-brand-700">
                    <FileSpreadsheet size={27} />
                  </span>
                  <div>
                    <p className="text-[0.86rem] font-bold text-ink-900">
                      {file.name}
                    </p>
                    <p className="mt-1 text-[0.68rem] text-slate-500">
                      {(file.size / 1024 / 1024).toFixed(2)} MB · siap diproses
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        fileRef.current?.click();
                      }}
                    >
                      <RefreshCw size={13} /> Ganti file
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        setFile(null);
                        setResult(null);
                      }}
                    >
                      <X size={13} /> Hapus
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-center">
                  <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-brand-600 shadow-sm ring-1 ring-line">
                    <UploadCloud size={26} />
                  </span>
                  <p className="mt-1 text-[0.88rem] font-bold text-ink-900">
                    Tarik file Excel/CSV ke area ini
                  </p>
                  <p className="max-w-sm text-[0.7rem] leading-relaxed text-slate-500">
                    Atau klik untuk memilih file. Kolom seperti “No Rekening”,
                    “No. Rek”, “CIF”, dan “Nomor Rekening” dideteksi otomatis.
                  </p>
                  <span className="badge badge-neutral mt-1">
                    Maks. 50 MB · 100.000+ baris
                  </span>
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-col gap-3 rounded-xl border border-line bg-slate-50/60 p-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2">
                <Info size={15} className="mt-0.5 shrink-0 text-slate-400" />
                <p className="text-[0.66rem] leading-relaxed text-slate-500">
                  NIK wajib 16 digit. Baris tanpa nama/rekening atau dengan
                  tanggal tidak valid akan dicatat sebagai error tanpa
                  menghentikan batch.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-primary shrink-0"
                onClick={runScreening}
                disabled={!file || processing || !allowed}
              >
                {processing ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />{" "}
                    Memproses...
                  </>
                ) : (
                  <>
                    <Zap size={14} /> Jalankan screening
                  </>
                )}
              </button>
            </div>

            {processing || result ? (
              <div className="mt-4 rounded-xl border border-line p-3.5">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-[0.74rem] font-bold text-ink-900">
                    Pipeline pemrosesan
                  </p>
                  <span className="text-[0.67rem] font-bold text-brand-700">
                    {progress}%
                  </span>
                </div>
                <div className="progress-track">
                  <div className="progress-bar" style={{ width: `${progress}%` }} />
                </div>
                <div className="mt-3 flex items-start justify-between gap-1">
                  {STAGES.map((item, index) => {
                    const complete = index < currentStageIndex || stage === "done";
                    const active = index === currentStageIndex && stage !== "done";
                    return (
                      <div key={item.key} className="flex flex-1 flex-col items-center gap-1">
                        <span
                          className={clsx(
                            "flex h-6 w-6 items-center justify-center rounded-full text-[0.55rem] font-bold",
                            complete
                              ? "bg-brand-600 text-white"
                              : active
                                ? "border-2 border-brand-500 bg-white text-brand-700"
                                : "bg-slate-100 text-slate-400",
                          )}
                        >
                          {complete ? <CheckCircle2 size={12} /> : index + 1}
                        </span>
                        <span
                          className={clsx(
                            "text-center text-[0.58rem] font-semibold",
                            complete || active ? "text-ink-800" : "text-slate-400",
                          )}
                        >
                          {item.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
                {processing ? (
                  <p className="mt-3 flex items-center gap-1.5 text-[0.64rem] text-slate-500">
                    <RefreshCw size={11} className="animate-spin" />
                    {stage === "match"
                      ? "Menjalankan multi-layer fuzzy matching terhadap watchlist aktif..."
                      : "Memvalidasi format dan menyanitasi nama nasabah..."}
                  </p>
                ) : null}
              </div>
            ) : null}

            {result ? (
              <div className="mt-4 space-y-3">
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 size={18} className="text-emerald-700" />
                      <div>
                        <p className="text-[0.78rem] font-bold text-emerald-900">
                          Batch {result.batch.batch_number} selesai
                        </p>
                        <p className="mt-0.5 text-[0.64rem] text-emerald-700">
                          {result.staged_count} valid · {result.error_count} error ·{" "}
                          {result.hit_count} kandidat
                        </p>
                      </div>
                    </div>
                    <Link href="/results" className="btn btn-primary btn-sm">
                      Buka hasil <ArrowRight size={13} />
                    </Link>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                  {[
                    ["Valid", result.staged_count, "text-ink-900"],
                    ["Critical", result.severity.critical, "text-red-600"],
                    ["High", result.severity.high, "text-orange-600"],
                    ["Medium", result.severity.medium, "text-amber-600"],
                    ["Bersih", result.clean_count, "text-emerald-600"],
                  ].map(([label, value, color]) => (
                    <div key={String(label)} className="rounded-lg border border-line px-2.5 py-2">
                      <p className="text-[0.56rem] font-bold uppercase tracking-wider text-slate-400">
                        {label}
                      </p>
                      <p className={clsx("mt-0.5 text-[0.95rem] font-extrabold", color)}>
                        {value}
                      </p>
                    </div>
                  ))}
                </div>

                <div className="overflow-hidden rounded-lg border border-line">
                  <div className="flex items-center justify-between border-b border-line bg-slate-50 px-3 py-2">
                    <p className="text-[0.67rem] font-bold text-ink-900">
                      Preview hasil validasi
                    </p>
                    <span className="text-[0.6rem] text-slate-400">
                      {result.preview.length} baris pertama
                    </span>
                  </div>
                  <div className="max-h-[220px] overflow-auto scroll-area">
                    <table className="data-table min-w-[560px]">
                      <thead>
                        <tr>
                          <th>Baris</th>
                          <th>Nama</th>
                          <th>CIF</th>
                          <th>NIK</th>
                          <th>DOB</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {result.preview.slice(0, 12).map((row) => (
                          <tr key={`${row.row}-${row.cif}`}>
                            <td className="mono text-[0.65rem] text-slate-400">
                              {row.row}
                            </td>
                            <td className="primary-cell text-[0.7rem]">{row.name}</td>
                            <td className="mono text-[0.63rem] text-slate-500">
                              {row.cif}
                            </td>
                            <td className="mono text-[0.63rem] text-slate-500">
                              {row.nik}
                            </td>
                            <td className="text-[0.65rem] text-slate-500">
                              {formatDateId(row.dob)}
                            </td>
                            <td>
                              {row.status === "VALID" ? (
                                <span className="badge badge-clean">Valid</span>
                              ) : (
                                <span
                                  className="badge badge-critical"
                                  title={row.error}
                                >
                                  Error
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {result.errors.length ? (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                    <p className="flex items-center gap-1.5 text-[0.7rem] font-bold text-amber-900">
                      <AlertTriangle size={13} /> {result.error_count} baris tidak
                      lolos validasi
                    </p>
                    <div className="mt-1.5 max-h-24 space-y-1 overflow-y-auto scroll-area">
                      {result.errors.slice(0, 8).map((error) => (
                        <p
                          key={`${error.row}-${error.column}`}
                          className="text-[0.63rem] text-amber-800"
                        >
                          Baris {error.row} · {error.column}: {error.reason}
                        </p>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="card animate-fade-up p-4 stagger-2 sm:p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[0.82rem] font-bold text-ink-900">
                  Kontrol kualitas data
                </p>
                <p className="mt-0.5 text-[0.68rem] text-slate-500">
                  Diterapkan sebelum data masuk ke engine.
                </p>
              </div>
              <ShieldCheck size={17} className="text-brand-600" />
            </div>
            <div className="mt-3 space-y-2">
              {[
                ["Auto-column mapping", "Mendeteksi variasi header umum"],
                ["Sanitasi nama", "Gelar, tanda baca, spasi ganda"],
                ["Validasi NIK", "Tepat 16 digit numerik"],
                ["Validasi DOB", "ISO YYYY-MM-DD"],
                ["Enkripsi PII", "NIK & rekening AES-256-GCM"],
              ].map(([title, description]) => (
                <div key={title} className="flex items-start gap-2">
                  <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-emerald-600" />
                  <div>
                    <p className="text-[0.69rem] font-semibold text-ink-800">
                      {title}
                    </p>
                    <p className="text-[0.61rem] text-slate-400">{description}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="card animate-fade-up p-4 stagger-3 sm:p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[0.82rem] font-bold text-ink-900">
                  Bobot skor matching
                </p>
                <p className="mt-0.5 text-[0.68rem] text-slate-500">
                  Threshold kandidat ≥ 70%.
                </p>
              </div>
              <Sparkles size={17} className="text-gold-600" />
            </div>
            <div className="mt-3 space-y-2.5">
              {[
                ["Nama / alias", 50, "Jaro-Winkler + Token Sort + Double Metaphone"],
                ["Tanggal lahir", 25, "Exact match"],
                ["Tempat lahir", 15, "Fuzzy location similarity"],
                ["Kewarganegaraan", 10, "Normalized exact match"],
              ].map(([label, weight, note]) => (
                <div key={String(label)}>
                  <div className="flex items-center justify-between">
                    <span className="text-[0.68rem] font-semibold text-slate-600">
                      {label}
                    </span>
                    <span className="text-[0.68rem] font-bold text-ink-900">
                      {weight}%
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-brand-500 to-brand-400"
                      style={{ width: `${Number(weight) * 2}%` }}
                    />
                  </div>
                  <p className="mt-0.5 text-[0.58rem] text-slate-400">{note}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="animate-fade-up rounded-xl border border-gold-200 bg-gradient-to-br from-gold-50 to-white p-4 stagger-4">
            <div className="flex items-start gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold-100 text-gold-700">
                <Database size={15} />
              </span>
              <div>
                <p className="text-[0.72rem] font-bold text-ink-900">
                  Watchlist yang digunakan
                </p>
                <p className="mt-0.5 text-[0.63rem] leading-relaxed text-slate-500">
                  DTTOT Tahap II 2026, DPPSPM, PEP OJK, dan UN Sanctions. Versi
                  aktif otomatis dipakai pada setiap batch.
                </p>
                <Link
                  href="/watchlist"
                  className="mt-2 inline-flex items-center gap-1 text-[0.64rem] font-bold text-brand-700"
                >
                  Kelola watchlist <ArrowRight size={11} />
                </Link>
              </div>
            </div>
          </section>
        </aside>
      </div>

      <section className="card animate-fade-up mt-4 overflow-hidden stagger-4">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3.5 sm:px-5">
          <div>
            <p className="text-[0.82rem] font-bold text-ink-900">
              Riwayat batch upload
            </p>
            <p className="mt-0.5 text-[0.68rem] text-slate-500">
              Batch terbaru dan status pemrosesan screening engine.
            </p>
          </div>
          <span className="badge badge-neutral">
            {data?.batches.length ?? 0} batch
          </span>
        </div>
        {loading && !data ? (
          <div className="space-y-2 p-3">
            {[0, 1, 2].map((index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        ) : data?.batches.length ? (
          <div className="overflow-x-auto">
            <table className="data-table min-w-[920px]">
              <thead>
                <tr>
                  <th>Batch</th>
                  <th>File sumber</th>
                  <th>Records</th>
                  <th>Kandidat</th>
                  <th>Status</th>
                  <th>Diunggah oleh</th>
                  <th>Waktu</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {data.batches.map((batch) => (
                  <tr key={batch.id}>
                    <td>
                      <p className="primary-cell mono text-[0.69rem]">
                        {batch.batch_number}
                      </p>
                      <p className="mt-0.5 text-[0.6rem] text-slate-400">
                        {batch.job_id ? "Smart matching selesai" : "Menunggu proses"}
                      </p>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <FileSpreadsheet size={13} className="text-slate-400" />
                        <span className="max-w-[190px] truncate text-[0.71rem] text-slate-600">
                          {batch.original_filename}
                        </span>
                      </div>
                    </td>
                    <td>
                      <p className="text-[0.71rem] font-bold text-ink-900">
                        {batch.valid_records.toLocaleString("id-ID")} valid
                      </p>
                      <p className="text-[0.6rem] text-slate-400">
                        {batch.error_records} error / {batch.total_records} baris
                      </p>
                    </td>
                    <td>
                      <span
                        className={clsx(
                          "badge",
                          batch.hits > 0 ? "badge-high" : "badge-neutral",
                        )}
                      >
                        {batch.hits} hit
                      </span>
                    </td>
                    <td>
                      <span
                        className={clsx(
                          "badge",
                          batch.upload_status === "PROCESSED"
                            ? "badge-clean"
                            : batch.upload_status === "FAILED"
                              ? "badge-critical"
                              : "badge-gold",
                        )}
                      >
                        {batch.upload_status === "PROCESSED"
                          ? "Selesai"
                          : batch.upload_status}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-[0.5rem] font-bold text-slate-600">
                          {getInitials(batch.uploader_name)}
                        </span>
                        <span className="text-[0.68rem] text-slate-600">
                          {batch.uploader_name}
                        </span>
                      </div>
                    </td>
                    <td className="text-[0.64rem] text-slate-500">
                      {formatDateTimeId(batch.created_at)}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => setSelectedBatch(batch)}
                      >
                        Detail <ArrowRight size={12} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            icon={<UploadCloud size={22} />}
            title="Belum ada batch"
            description="Unggah file nasabah untuk memulai screening pertama."
          />
        )}
      </section>

      <Drawer
        open={Boolean(selectedBatch)}
        onClose={() => setSelectedBatch(null)}
        title={selectedBatch?.batch_number ?? "Detail batch"}
        description={selectedBatch?.original_filename}
        width="max-w-3xl"
        footer={
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setSelectedBatch(null)}
          >
            Tutup
          </button>
        }
      >
        {detailLoading || !detail ? (
          <div className="space-y-2">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-2 sm:grid-cols-4">
              {[
                ["Total", detail.batch.total_records],
                ["Valid", detail.batch.valid_records],
                ["Error", detail.batch.error_records],
                ["Hits", detail.batch.hits],
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  className="rounded-lg border border-line bg-slate-50 px-3 py-2"
                >
                  <p className="text-[0.56rem] font-bold uppercase tracking-wider text-slate-400">
                    {label}
                  </p>
                  <p className="mt-0.5 text-[1rem] font-extrabold text-ink-900">
                    {value}
                  </p>
                </div>
              ))}
            </div>

            {detail.job ? (
              <div className="rounded-xl border border-line p-3.5">
                <div className="flex items-center justify-between">
                  <p className="text-[0.72rem] font-bold text-ink-900">
                    Screening job
                  </p>
                  <span className="badge badge-clean">{detail.job.job_status}</span>
                </div>
                <div className="mt-2 grid gap-2 text-[0.66rem] text-slate-500 sm:grid-cols-2">
                  <p>
                    Evaluated:{" "}
                    <span className="font-bold text-ink-800">
                      {detail.job.total_evaluated}
                    </span>
                  </p>
                  <p>
                    Threshold:{" "}
                    <span className="font-bold text-ink-800">
                      {detail.job.min_threshold_used}%
                    </span>
                  </p>
                  <p>
                    Mulai:{" "}
                    <span className="font-semibold text-ink-800">
                      {formatDateTimeId(detail.job.started_at)}
                    </span>
                  </p>
                  <p>
                    Selesai:{" "}
                    <span className="font-semibold text-ink-800">
                      {formatDateTimeId(detail.job.finished_at)}
                    </span>
                  </p>
                </div>
              </div>
            ) : null}

            {detail.errors.length ? (
              <div>
                <p className="mb-1.5 text-[0.72rem] font-bold text-ink-900">
                  Error validasi ({detail.errors.length})
                </p>
                <div className="space-y-1.5">
                  {detail.errors.map((error) => (
                    <div
                      key={error.id}
                      className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2"
                    >
                      <p className="text-[0.65rem] font-bold text-amber-900">
                        Baris {error.row_number} · {error.column_name}
                      </p>
                      <p className="mt-0.5 text-[0.63rem] text-amber-700">
                        {error.error_reason}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div>
              <p className="mb-1.5 text-[0.72rem] font-bold text-ink-900">
                Preview nasabah tersimpan
              </p>
              <div className="overflow-auto rounded-lg border border-line scroll-area">
                <table className="data-table min-w-[600px]">
                  <thead>
                    <tr>
                      <th>Nama</th>
                      <th>CIF</th>
                      <th>NIK</th>
                      <th>DOB</th>
                      <th>Tipe</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.customers.slice(0, 20).map((customer) => (
                      <tr key={customer.id}>
                        <td className="primary-cell text-[0.7rem]">
                          {customer.full_name}
                        </td>
                        <td className="mono text-[0.63rem] text-slate-500">
                          {customer.cif_number}
                        </td>
                        <td className="mono text-[0.63rem] text-slate-500">
                          {customer.national_id_masked}
                        </td>
                        <td className="text-[0.65rem] text-slate-500">
                          {formatDateId(customer.date_of_birth)}
                        </td>
                        <td>
                          <span className="badge badge-neutral">
                            {customer.customer_type}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <Alert variant="info" icon={<LockKeyhole size={15} />}>
              NIK dan nomor rekening ditampilkan dalam bentuk masker. Nilai asli
              tersimpan terenkripsi AES-256-GCM dan hanya didekripsi di server.
            </Alert>
          </div>
        )}
      </Drawer>
    </div>
  );
}
