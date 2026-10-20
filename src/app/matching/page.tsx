"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  Database,
  GitCompareArrows,
  Layers,
  Play,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  UploadCloud,
  UsersRound,
} from "lucide-react";
import { useDemoUser } from "@/components/user-provider";
import { useToast } from "@/components/toast-provider";
import {
  EmptyState,
  MetricCard,
  ProgressBar,
  Skeleton,
} from "@/components/ui";
import { formatDateTimeId } from "@/lib/normalize";
import { clsx, SEVERITY_META } from "@/lib/ui";

interface MatchingSnapshot {
  customers: number;
  customersWithMatches: number;
  activeEntities: number;
  totalEntities: number;
  aliases: number;
  documents: number;
  whitelist: number;
  matches: number;
  lastSyncAt: string | null;
  lastJobId: string | null;
  sourceCoverage: Array<{
    id: string;
    source_code: string;
    version_label: string;
    entities: number;
    last_uploaded_at: string;
  }>;
}

interface RecentJob {
  id: string;
  batch_number: string;
  file_name: string;
  status: string;
  evaluated: number;
  hits: number;
  threshold: number;
  started_at: string | null;
  finished_at: string | null;
  triggered_by: string;
}

interface RecentMatch {
  id: string;
  score: number;
  severity: string;
  matched_at: string;
  customer_name: string;
  customer_cif: string;
  entity_name: string;
  source_code: string;
  source_label: string;
  is_whitelisted: boolean;
}

interface MatchingResponse {
  snapshot: MatchingSnapshot;
  recentJobs: RecentJob[];
  recentMatches: RecentMatch[];
}

interface SyncSummary {
  completedAt: string;
  durationMs: number;
  customersEvaluated: number;
  entitiesEvaluated: number;
  candidates: number;
  created: number;
  updated: number;
  removed: number;
  preserved: number;
  jobIds: string[];
  batches: number;
}

const STEPS = [
  {
    title: "Ambil data nasabah",
    detail: "CIF, nama, NIK, paspor, tanggal & tempat lahir, kewarganegaraan.",
  },
  {
    title: "Normalisasi",
    detail: "Sanitasi nama, normalisasi dokumen, dan pemetaan tipe entitas.",
  },
  {
    title: "Multi-layer matching",
    detail: "Exact document, Jaro-Winkler, token sort, dan Double Metaphone.",
  },
  {
    title: "Skoring & keputusan",
    detail: "Bobot 50/25/15/10 dengan ambang 70 dan eskalasi ≥85.",
  },
];

export default function MatchingPage() {
  const { apiFetch, user } = useDemoUser();
  const toast = useToast();
  const [data, setData] = useState<MatchingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [summary, setSummary] = useState<SyncSummary | null>(null);

  const canRun = user.role_code === "MAKER_ANALYST" || user.role_code === "ADMIN";

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await apiFetch<MatchingResponse>("/api/matching");
      setData(payload);
    } catch (error) {
      toast.error("Gagal memuat status matching", (error as Error).message);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  async function runSync() {
    setSyncing(true);
    setSummary(null);
    try {
      const payload = await apiFetch<{
        summary: SyncSummary;
        snapshot: MatchingSnapshot;
      }>("/api/matching", { method: "POST" });
      setSummary(payload.summary);
      setData((current) =>
        current ? { ...current, snapshot: payload.snapshot } : current,
      );
      toast.success(
        "Sinkronisasi selesai",
        `${payload.summary.customersEvaluated} nasabah dievaluasi, ${payload.summary.created} temuan baru, ${payload.summary.updated} diperbarui.`,
      );
      await load();
    } catch (error) {
      toast.error("Sinkronisasi gagal", (error as Error).message);
    } finally {
      setSyncing(false);
    }
  }

  const snapshot = data?.snapshot;
  const coverageRatio =
    snapshot && snapshot.customers
      ? Math.round((snapshot.customersWithMatches / snapshot.customers) * 100)
      : 0;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[0.66rem] font-bold uppercase tracking-[0.14em] text-brand-700">
            Sinkronisasi & Pencocokan
          </p>
          <h1 className="mt-0.5 text-[1.35rem] font-extrabold tracking-tight text-ink-900 sm:text-[1.55rem]">
            Matching Engine
          </h1>
          <p className="mt-1 max-w-3xl text-[0.78rem] leading-relaxed text-slate-500">
            Sinkronkan data nasabah dengan daftar DTTOT dan APU-PPT terkini.
            Setiap eksekusi membuat jejak audit dan memperbarui skor temuan.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/screening" className="btn btn-secondary btn-sm">
            <UploadCloud size={14} /> Upload nasabah
          </Link>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={runSync}
            disabled={!canRun || syncing}
            title={
              canRun
                ? "Jalankan sinkronisasi penuh"
                : "Hanya Maker/Analis dan Admin yang dapat menjalankan sinkronisasi"
            }
          >
            {syncing ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <Play size={14} />
            )}
            {syncing ? "Menyinkronkan..." : "Jalankan sinkronisasi"}
          </button>
        </div>
      </div>

      {!canRun ? (
        <div className="alert alert-info">
          <ShieldAlert size={16} className="mt-0.5 shrink-0" />
          <div>
            <p className="font-bold">Akses eksekusi dibatasi</p>
            <p className="mt-0.5">
              Anda masuk sebagai {user.full_name}. Hanya Maker/Analis dan Admin
              yang dapat menjalankan sinkronisasi. Anda tetap dapat melihat
              status, cakupan sumber, dan hasil matching.
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Nasabah tersinkron"
          value={snapshot?.customers ?? "—"}
          sub={`${snapshot?.customersWithMatches ?? 0} memiliki temuan`}
          icon={<UsersRound size={17} />}
          tone="brand"
        />
        <MetricCard
          label="Entitas aktif"
          value={snapshot?.activeEntities ?? "—"}
          sub={`Dari ${snapshot?.totalEntities ?? 0} entitas · ${snapshot?.aliases ?? 0} alias`}
          icon={<Database size={17} />}
          tone="ink"
          delay="stagger-1"
        />
        <MetricCard
          label="Total match tersimpan"
          value={snapshot?.matches ?? "—"}
          sub={`${snapshot?.whitelist ?? 0} whitelist dikecualikan`}
          icon={<GitCompareArrows size={17} />}
          tone="violet"
          delay="stagger-2"
        />
        <MetricCard
          label="Sinkronisasi terakhir"
          value={
            snapshot?.lastSyncAt
              ? formatDateTimeId(snapshot.lastSyncAt).split(",")[0]
              : "—"
          }
          sub={
            snapshot?.lastSyncAt
              ? formatDateTimeId(snapshot.lastSyncAt)
              : "Belum pernah dijalankan"
          }
          icon={<Clock3 size={17} />}
          tone="clean"
          delay="stagger-3"
        />
      </div>

      {summary ? (
        <div className="card border-brand-200 bg-brand-50/50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="flex items-center gap-1.5 text-[0.78rem] font-bold text-brand-900">
                <CheckCircle2 size={15} /> Sinkronisasi selesai dalam{" "}
                {summary.durationMs} ms
              </p>
              <p className="mt-1 text-[0.7rem] text-brand-800/80">
                {summary.customersEvaluated} nasabah × {summary.entitiesEvaluated}{" "}
                entitas aktif · {summary.batches} batch · {summary.candidates} kandidat
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-[0.66rem]">
              <span className="badge badge-clean">{summary.created} baru</span>
              <span className="badge badge-info">{summary.updated} diperbarui</span>
              <span className="badge badge-neutral">{summary.removed} dibersihkan</span>
              <span className="badge badge-neutral">{summary.preserved} dipertahankan</span>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-4">
          <div className="card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-[0.66rem] font-bold uppercase tracking-[0.1em] text-slate-400">
                  Alur matching engine
                </p>
                <p className="mt-0.5 text-[0.8rem] font-bold text-ink-900">
                  Empat lapis pencocokan, satu keputusan yang dapat diaudit
                </p>
              </div>
              <Link href="/results" className="btn btn-secondary btn-sm">
                Lihat hasil <ArrowUpRight size={12} />
              </Link>
            </div>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
              {STEPS.map((step, index) => (
                <div
                  key={step.title}
                  className="rounded-xl border border-line bg-slate-50/60 p-3"
                >
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink-900 text-[0.62rem] font-extrabold text-white">
                    {index + 1}
                  </span>
                  <p className="mt-2 text-[0.73rem] font-bold text-ink-900">
                    {step.title}
                  </p>
                  <p className="mt-0.5 text-[0.63rem] leading-relaxed text-slate-500">
                    {step.detail}
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-3 grid gap-2 sm:grid-cols-4">
              {[
                { label: "Nama", value: 50 },
                { label: "Tanggal lahir", value: 25 },
                { label: "Tempat lahir", value: 15 },
                { label: "Kewarganegaraan", value: 10 },
              ].map((weight) => (
                <div key={weight.label}>
                  <div className="flex items-center justify-between text-[0.64rem]">
                    <span className="text-slate-500">{weight.label}</span>
                    <span className="mono font-bold text-ink-900">{weight.value}%</span>
                  </div>
                  <div className="mt-1">
                    <ProgressBar value={weight.value} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-4 py-3">
              <p className="text-[0.72rem] font-bold text-ink-900">
                Riwayat eksekusi
              </p>
              <span className="text-[0.63rem] text-slate-400">
                {data?.recentJobs.length ?? 0} job terakhir
              </span>
            </div>
            {loading && !data ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 4 }).map((_, index) => (
                  <Skeleton key={index} className="h-11 w-full" />
                ))}
              </div>
            ) : data?.recentJobs.length ? (
              <div className="table-shell">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Batch / file</th>
                      <th>Status</th>
                      <th className="text-right">Dievaluasi</th>
                      <th className="text-right">Temuan</th>
                      <th>Ambang</th>
                      <th>Oleh</th>
                      <th>Selesai</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.recentJobs.map((job) => (
                      <tr key={job.id}>
                        <td>
                          <p className="primary-cell text-[0.74rem]">
                            {job.batch_number}
                          </p>
                          <p className="mt-0.5 max-w-[220px] truncate text-[0.61rem] text-slate-400">
                            {job.file_name}
                          </p>
                        </td>
                        <td>
                          <span
                            className={clsx(
                              "badge",
                              job.status === "COMPLETED"
                                ? "badge-clean"
                                : job.status === "FAILED"
                                  ? "badge-critical"
                                  : "badge-medium",
                            )}
                          >
                            {job.status}
                          </span>
                        </td>
                        <td className="text-right text-[0.73rem]">{job.evaluated}</td>
                        <td className="text-right text-[0.73rem] font-bold">{job.hits}</td>
                        <td className="mono text-[0.68rem]">{job.threshold}</td>
                        <td className="text-[0.7rem]">{job.triggered_by}</td>
                        <td className="text-[0.66rem] text-slate-500">
                          {formatDateTimeId(job.finished_at ?? job.started_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                icon={<Layers size={20} />}
                title="Belum ada eksekusi"
                description="Jalankan sinkronisasi untuk membuat job matching pertama."
              />
            )}
          </div>

          <div className="card p-4">
            <div className="flex items-center justify-between">
              <p className="text-[0.72rem] font-bold text-ink-900">Temuan terbaru</p>
              <Link href="/results" className="text-[0.65rem] font-semibold text-brand-700">
                Semua hasil
              </Link>
            </div>
            {data?.recentMatches.length ? (
              <div className="mt-2.5 space-y-2">
                {data.recentMatches.map((match) => {
                  const severity =
                    SEVERITY_META[match.severity as keyof typeof SEVERITY_META] ??
                    SEVERITY_META.LOW;
                  return (
                    <div
                      key={match.id}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="text-[0.74rem] font-bold text-ink-900">
                          {match.customer_name}{" "}
                          <span className="font-normal text-slate-400">vs</span>{" "}
                          {match.entity_name}
                        </p>
                        <p className="mt-0.5 text-[0.62rem] text-slate-400">
                          <span className="mono">{match.customer_cif}</span> ·{" "}
                          {match.source_label} ·{" "}
                          {formatDateTimeId(match.matched_at)}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="mono text-[0.7rem] font-bold text-ink-900">
                          {match.score.toFixed(2)}%
                        </span>
                        <span className={clsx("badge", severity.className)}>
                          {severity.label}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="mt-2 text-[0.7rem] text-slate-400">
                Belum ada temuan tersimpan.
              </p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-4">
            <p className="text-[0.66rem] font-bold uppercase tracking-[0.1em] text-slate-400">
              Cakupan sumber aktif
            </p>
            <div className="mt-2 flex items-center justify-between text-[0.7rem]">
              <span className="text-slate-500">Nasabah dengan temuan</span>
              <span className="font-bold text-ink-900">{coverageRatio}%</span>
            </div>
            <div className="mt-1.5">
              <ProgressBar value={coverageRatio} />
            </div>
            <div className="mt-3 space-y-2">
              {snapshot?.sourceCoverage.map((source) => (
                <div
                  key={source.id}
                  className="rounded-lg border border-line px-3 py-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="badge badge-info">{source.source_code}</span>
                    <span className="text-[0.66rem] font-bold text-ink-900">
                      {source.entities} entitas
                    </span>
                  </div>
                  <p className="mt-1 truncate text-[0.63rem] text-slate-500">
                    {source.version_label}
                  </p>
                  <p className="mt-0.5 text-[0.6rem] text-slate-400">
                    Diunggah {formatDateTimeId(source.last_uploaded_at)}
                  </p>
                </div>
              ))}
            </div>
            <Link
              href="/watchlist"
              className="mt-3 inline-flex items-center gap-1 text-[0.67rem] font-bold text-brand-700"
            >
              Kelola versi watchlist <ArrowUpRight size={12} />
            </Link>
          </div>

          <div className="card p-4">
            <p className="flex items-center gap-1.5 text-[0.66rem] font-bold uppercase tracking-[0.1em] text-slate-400">
              <Sparkles size={13} /> Ambang keputusan
            </p>
            <div className="mt-2.5 space-y-2 text-[0.7rem]">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Exact NIK / paspor</span>
                <span className="badge badge-critical">100 · Critical</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Skor ≥ 85</span>
                <span className="badge badge-high">High</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Skor 70–84</span>
                <span className="badge badge-medium">Potensial</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Skor &lt; 70</span>
                <span className="badge badge-clean">Bersih</span>
              </div>
            </div>
            <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-[0.62rem] leading-relaxed text-slate-500">
              Re-screening mempertahankan match yang sudah memiliki kasus atau
              whitelist agar jejak investigasi tidak hilang.
            </div>
          </div>

          <div className="hero-panel relative overflow-hidden rounded-2xl p-4 text-white">
            <p className="text-[0.62rem] font-bold uppercase tracking-[0.12em] text-gold-300">
              Jadwal berikutnya
            </p>
            <p className="mt-1.5 text-[0.82rem] font-bold">
              Re-screening harian 02.00 WIB
            </p>
            <p className="mt-1 text-[0.66rem] leading-relaxed text-slate-300">
              Dalam produksi, job dijalankan oleh worker Redis queue dengan
              idempotency key per versi watchlist.
            </p>
            <Link href="/screening" className="btn btn-gold btn-sm mt-3">
              <UploadCloud size={13} /> Upload batch baru
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
