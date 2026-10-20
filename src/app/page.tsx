"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Ban,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Database,
  FileWarning,
  ListChecks,
  ScanSearch,
  ShieldAlert,
  ShieldCheck,
  Snowflake,
  Sparkles,
  UploadCloud,
  UsersRound,
  WalletCards,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { DashboardData } from "@/lib/types";
import {
  formatCompact,
  formatCurrency,
  formatDateId,
} from "@/lib/normalize";
import {
  CASE_STATUS_META,
  SEVERITY_META,
  SOURCE_META,
  clsx,
  getInitials,
} from "@/lib/ui";
import { useDemoUser } from "@/components/user-provider";
import {
  EmptyState,
  MetricCard,
  RiskBadge,
  ScoreRing,
  Skeleton,
} from "@/components/ui";

const numberFormat = new Intl.NumberFormat("id-ID");

function TrendTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number; name?: string; color?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-line bg-white px-3 py-2 shadow-lg">
      <p className="text-[0.65rem] font-bold uppercase tracking-wider text-slate-400">
        {label}
      </p>
      {payload.map((item) => (
        <p key={item.name} className="mt-1 flex items-center gap-1.5 text-[0.72rem]">
          <span
            className="h-1.5 w-1.5 rounded-full"
            style={{ background: item.color }}
          />
          <span className="text-slate-500">{item.name}:</span>
          <span className="font-bold text-ink-900">{item.value}</span>
        </p>
      ))}
    </div>
  );
}

export default function DashboardPage() {
  const { user, apiFetch } = useDemoUser();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState("Selamat datang");
  const [today, setToday] = useState("—");

  useEffect(() => {
    const now = new Date();
    const hour = now.getHours();
    setGreeting(
      hour < 11
        ? "Selamat pagi"
        : hour < 15
          ? "Selamat siang"
          : hour < 19
            ? "Selamat sore"
            : "Selamat malam",
    );
    setToday(
      new Intl.DateTimeFormat("id-ID", {
        weekday: "long",
        day: "2-digit",
        month: "long",
        year: "numeric",
      }).format(now),
    );
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    apiFetch<DashboardData>("/api/dashboard")
      .then((payload) => {
        if (active) setData(payload);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [apiFetch, user.id]);

  const metrics = data?.metrics;
  const universe = data?.dataUniverse;
  const total = metrics?.totalScreened ?? 0;
  const cleanRate = total ? Math.round(((metrics?.clean ?? 0) / total) * 1000) / 10 : 0;
  const severityTotal =
    data?.severityDistribution.reduce((sum, item) => sum + item.value, 0) ?? 0;
  const maxSource = Math.max(
    1,
    ...(data?.sourceCoverage.map((source) => source.entities) ?? [1]),
  );

  if (loading && !data) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-[210px] w-full !rounded-2xl" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-[116px] w-full !rounded-2xl" />
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          <Skeleton className="h-[300px] w-full !rounded-2xl xl:col-span-2" />
          <Skeleton className="h-[300px] w-full !rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <section className="hero-panel animate-fade-up rounded-2xl px-5 py-5 sm:px-6 sm:py-6">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-gold-300/25 bg-gold-400/10 px-2.5 py-1 text-[0.6rem] font-bold uppercase tracking-[0.12em] text-gold-200">
                <ShieldCheck size={12} /> POJK 8/2023 · PPATK
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-1 text-[0.6rem] font-semibold text-slate-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                Sistem aktif
              </span>
            </div>
            <p className="mt-4 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-slate-400">
              {today}
            </p>
            <h1 className="mt-1 text-[1.5rem] font-extrabold leading-tight tracking-tight text-white sm:text-[1.8rem]">
              {greeting}, {user.full_name.split(" ")[0]}.
            </h1>
            <p className="mt-1.5 max-w-xl text-[0.78rem] leading-relaxed text-slate-300/90">
              Pantau data nasabah, entitas DTTOT, dan daftar APU-PPT secara
              terpisah. Jalankan matching engine untuk memprioritaskan temuan
              kritis hari ini.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <Link href="/customers" className="btn btn-gold btn-sm">
                <UsersRound size={14} /> Kelola data nasabah
              </Link>
              <Link
                href="/matching"
                className="btn btn-sm border-white/15 bg-white/[0.07] text-white hover:bg-white/[0.12]"
              >
                Matching engine <ArrowRight size={14} />
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 xl:w-[465px]">
            <div className="rounded-xl border border-white/10 bg-white/[0.055] p-3 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <span className="text-[0.6rem] font-bold uppercase tracking-wider text-slate-400">
                  Watchlist
                </span>
                <Database size={13} className="text-gold-300" />
              </div>
              <p className="mt-2 text-[1.3rem] font-extrabold text-white">
                {((universe?.dttotEntities ?? 0) + (universe?.apupptEntities ?? 0)) || 0}
                <span className="ml-1 text-[0.62rem] font-medium text-slate-400">
                  entitas
                </span>
              </p>
              <p className="mt-1 text-[0.6rem] text-emerald-300">
                {data?.sourceCoverage.length ?? 0} sumber · 100% tersinkron
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/[0.055] p-3 backdrop-blur-sm">
              <div className="flex items-center justify-between">
                <span className="text-[0.6rem] font-bold uppercase tracking-wider text-slate-400">
                  Kasus aktif
                </span>
                <Activity size={13} className="text-sky-300" />
              </div>
              <p className="mt-2 text-[1.3rem] font-extrabold text-white">
                {metrics?.openCases ?? 0}
              </p>
              <p className="mt-1 text-[0.6rem] text-slate-400">
                {data?.casePipeline.find((item) => item.stage === "PENDING_APPROVAL")?.count ?? 0} menunggu approval
              </p>
            </div>
            <div className="col-span-2 flex items-center gap-3 rounded-xl border border-gold-300/15 bg-gradient-to-r from-gold-400/[0.12] to-transparent p-3 sm:col-span-1">
              <ScoreRing value={100} size={48} stroke={6} />
              <div>
                <p className="text-[0.58rem] font-bold uppercase tracking-wider text-gold-200">
                  Kepatuhan
                </p>
                <p className="mt-0.5 text-[0.74rem] font-bold text-white">Terkendali</p>
                <p className="text-[0.58rem] text-slate-400">Audit trail aktif</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Link href="/customers" className="block">
          <MetricCard
            label="Data nasabah"
            value={numberFormat.format(universe?.customers ?? 0)}
            sub={
              <span className="flex items-center gap-1">
                <UsersRound size={12} className="text-brand-600" />
                {universe?.activeCustomers ?? 0} aktif · kualitas rata-rata{" "}
                {universe?.averageQuality ?? 0}/100
              </span>
            }
            icon={<UsersRound size={17} />}
            tone="brand"
          />
        </Link>
        <Link href="/dttot" className="block">
          <MetricCard
            label="Entitas DTTOT"
            value={numberFormat.format(universe?.dttotEntities ?? 0)}
            sub={
              <span className="flex items-center gap-1">
                <ShieldAlert size={12} className="text-red-600" />
                {universe?.dttotSources ?? 0} versi sumber aktif · PPATK/BNPT
              </span>
            }
            icon={<ShieldAlert size={17} />}
            tone="critical"
            delay="stagger-1"
          />
        </Link>
        <Link href="/apuppt" className="block">
          <MetricCard
            label="Entitas APU-PPT"
            value={numberFormat.format(universe?.apupptEntities ?? 0)}
            sub={
              <span className="flex items-center gap-1">
                <ListChecks size={12} className="text-violet-600" />
                {universe?.apupptSources ?? 0} sumber · DPPSPM, PEP, UN
              </span>
            }
            icon={<ListChecks size={17} />}
            tone="violet"
            delay="stagger-2"
          />
        </Link>
        <Link href="/results" className="block">
          <MetricCard
            label="Total temuan"
            value={numberFormat.format(metrics?.totalHits ?? 0)}
            sub={
              <span className="flex items-center gap-1">
                <ScanSearch size={12} className="text-amber-600" />
                {metrics?.suspect ?? 0} critical/high · {metrics?.openCases ?? 0} kasus
              </span>
            }
            icon={<ScanSearch size={17} />}
            tone="medium"
            delay="stagger-3"
          />
        </Link>
      </section>

      <section className="card stat-strip animate-fade-up stagger-1 grid gap-0 divide-y divide-line px-1 py-1 sm:grid-cols-2 sm:divide-y-0 xl:grid-cols-4">
        {[
          {
            label: "Total record diproses",
            value: metrics?.totalScreened ?? 0,
            note: `${numberFormat.format(total)} record valid · 2 batch (1 arsip)`,
            icon: <BadgeCheck size={14} className="text-brand-600" />,
          },
          {
            label: "Record bersih",
            value: metrics?.clean ?? 0,
            note: `${cleanRate}% dari total record dinilai`,
            icon: <CheckCircle2 size={14} className="text-emerald-600" />,
          },
          {
            label: "Perlu review",
            value: metrics?.potential ?? 0,
            note: "Potential match 70–84%",
            icon: <Clock3 size={14} className="text-amber-600" />,
          },
          {
            label: "Suspect kritis",
            value: metrics?.suspect ?? 0,
            note: `${metrics?.frozenAccounts ?? 0} rekening dibekukan`,
            icon: <Ban size={14} className="text-red-600" />,
          },
        ].map((item) => (
          <div key={item.label} className="px-4 py-3">
            <p className="flex items-center gap-1.5 text-[0.62rem] font-bold uppercase tracking-[0.07em] text-slate-500">
              {item.icon} {item.label}
            </p>
            <p className="mt-1 text-[1.2rem] font-extrabold leading-none text-ink-900">
              {numberFormat.format(item.value)}
            </p>
            <p className="mt-1 text-[0.62rem] text-slate-400">{item.note}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
        <div className="card animate-fade-up p-4 sm:p-5 stagger-2">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[0.82rem] font-bold text-ink-900">
                Volume screening
              </p>
              <p className="mt-0.5 text-[0.68rem] text-slate-500">
                Data nasabah yang dievaluasi dan temuan kandidat dalam 7 hari.
              </p>
            </div>
            <div className="flex items-center gap-3 text-[0.62rem] font-semibold text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-brand-500" /> Dievaluasi
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-gold-400" /> Kandidat
              </span>
            </div>
          </div>
          <div className="mt-4 h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data?.trend ?? []} margin={{ left: -20, right: 6, top: 4, bottom: 0 }}>
                <defs>
                  <linearGradient id="screenedFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#228f80" stopOpacity={0.26} />
                    <stop offset="100%" stopColor="#228f80" stopOpacity={0.015} />
                  </linearGradient>
                  <linearGradient id="hitsFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#d3a43b" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#d3a43b" stopOpacity={0.015} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#eef2f7" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                  dy={8}
                />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 10, fill: "#94a3b8" }}
                />
                <Tooltip content={<TrendTooltip />} />
                <Area
                  type="monotone"
                  dataKey="screened"
                  name="Dievaluasi"
                  stroke="#228f80"
                  strokeWidth={2.2}
                  fill="url(#screenedFill)"
                  dot={false}
                />
                <Area
                  type="monotone"
                  dataKey="hits"
                  name="Kandidat"
                  stroke="#d3a43b"
                  strokeWidth={2}
                  fill="url(#hitsFill)"
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card animate-fade-up p-4 sm:p-5 stagger-3">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[0.82rem] font-bold text-ink-900">
                Distribusi risiko
              </p>
              <p className="mt-0.5 text-[0.68rem] text-slate-500">
                Klasifikasi hasil smart matching.
              </p>
            </div>
            <span className="badge badge-info">{severityTotal} hit</span>
          </div>
          <div className="mt-2 flex flex-col items-center gap-4 sm:flex-row">
            <div className="relative h-[150px] w-[150px] shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data?.severityDistribution ?? []}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={47}
                    outerRadius={68}
                    paddingAngle={3}
                    stroke="none"
                  >
                    {(data?.severityDistribution ?? []).map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [
                      `${value ?? 0}`,
                      String(name ?? ""),
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-[1.32rem] font-extrabold leading-none text-ink-900">
                  {severityTotal}
                </span>
                <span className="mt-1 text-[0.55rem] font-bold uppercase tracking-wider text-slate-400">
                  total hit
                </span>
              </div>
            </div>
            <div className="w-full space-y-2">
              {(data?.severityDistribution ?? []).map((entry) => (
                <div key={entry.name} className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: entry.color }}
                  />
                  <span className="flex-1 text-[0.7rem] text-slate-600">
                    {entry.name}
                  </span>
                  <span className="text-[0.72rem] font-bold text-ink-900">
                    {entry.value}
                  </span>
                  <div className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${severityTotal ? (entry.value / severityTotal) * 100 : 0}%`,
                        background: entry.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-slate-50 px-3 py-2.5">
              <p className="text-[0.58rem] font-bold uppercase tracking-wider text-slate-400">
                Saldo dibekukan
              </p>
              <p className="mt-1 text-[0.82rem] font-extrabold text-ink-900">
                {formatCurrency(metrics?.frozenBalance ?? 0)}
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2.5">
              <p className="text-[0.58rem] font-bold uppercase tracking-wider text-slate-400">
                Rata-rata skor
              </p>
              <p className="mt-1 text-[0.82rem] font-extrabold text-ink-900">
                {severityTotal
                  ? `${Math.round(
                      (data?.recentMatches.reduce((sum, item) => sum + item.score, 0) ?? 0) /
                        Math.max(1, data?.recentMatches.length ?? 1),
                    )}%`
                  : "—"}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
        <div className="card animate-fade-up overflow-hidden stagger-4">
          <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3.5 sm:px-5">
            <div>
              <p className="text-[0.82rem] font-bold text-ink-900">
                Temuan prioritas
              </p>
              <p className="mt-0.5 text-[0.68rem] text-slate-500">
                Kandidat dengan skor tertinggi untuk segera ditinjau.
              </p>
            </div>
            <Link href="/results" className="btn btn-ghost btn-sm">
              Semua hasil <ArrowUpRight size={13} />
            </Link>
          </div>
          {data?.recentMatches.length ? (
            <div className="overflow-x-auto">
              <table className="data-table min-w-[680px]">
                <thead>
                  <tr>
                    <th>Nasabah</th>
                    <th>Entitas watchlist</th>
                    <th>Skor</th>
                    <th>Kategori</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.recentMatches.map((match) => (
                    <tr key={match.id}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <span
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[0.58rem] font-extrabold text-white"
                            style={{
                              background:
                                match.score >= 85 ? "#b42318" : "#b45309",
                            }}
                          >
                            {getInitials(match.customer.full_name)}
                          </span>
                          <div>
                            <p className="primary-cell text-[0.76rem]">
                              {match.customer.full_name}
                            </p>
                            <p className="mono mt-0.5 text-[0.61rem] text-slate-400">
                              {match.customer.cif_number}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <p className="text-[0.74rem] font-semibold text-ink-800">
                          {match.entity.primary_name}
                        </p>
                        <p className="mt-0.5 text-[0.61rem] text-slate-400">
                          {SOURCE_META[match.source.code].label} ·{" "}
                          {match.source.published_by}
                        </p>
                      </td>
                      <td>
                        <div className="flex items-center gap-2">
                          <span className="text-[0.8rem] font-extrabold text-ink-900">
                            {Math.round(match.score)}%
                          </span>
                          <div className="h-1.5 w-10 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${match.score}%`,
                                background: SEVERITY_META[match.severity].color,
                              }}
                            />
                          </div>
                        </div>
                      </td>
                      <td>
                        <RiskBadge
                          severity={match.severity}
                          whitelisted={match.is_whitelisted}
                          exact={match.is_exact_identity_match}
                        />
                      </td>
                      <td>
                        {match.case ? (
                          <span
                            className={clsx(
                              "badge",
                              CASE_STATUS_META[match.case.status].className,
                            )}
                          >
                            {CASE_STATUS_META[match.case.status].label}
                          </span>
                        ) : (
                          <span className="badge badge-neutral">Belum ditangani</span>
                        )}
                      </td>
                      <td>
                        <Link
                          href={`/results?match=${match.id}`}
                          className="icon-btn h-7 w-7"
                          aria-label="Buka perbandingan"
                        >
                          <ChevronRight size={15} />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              icon={<ShieldCheck size={22} />}
              title="Tidak ada temuan"
              description="Seluruh data nasabah pada batch terakhir berada di bawah threshold."
            />
          )}
        </div>

        <div className="space-y-4">
          <div className="card animate-fade-up p-4 stagger-5 sm:p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[0.82rem] font-bold text-ink-900">
                  Cakupan watchlist
                </p>
                <p className="mt-0.5 text-[0.68rem] text-slate-500">
                  Sumber aktif dan jumlah entitas.
                </p>
              </div>
              <Database size={16} className="text-brand-600" />
            </div>
            <div className="mt-3 space-y-3">
              {(data?.sourceCoverage ?? []).map((source) => {
                const meta = SOURCE_META[source.code];
                return (
                  <div key={source.code}>
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className="badge !px-2 !py-0.5"
                          style={{ background: meta.bg, color: meta.color }}
                        >
                          {meta.short}
                        </span>
                        <span className="max-w-[170px] truncate text-[0.69rem] text-slate-600">
                          {source.version}
                        </span>
                      </div>
                      <span className="text-[0.72rem] font-bold text-ink-900">
                        {source.entities}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(source.entities / maxSource) * 100}%`,
                          background: meta.color,
                        }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-brand-50/70 px-2.5 py-2 text-[0.62rem] text-brand-800">
              <CheckCircle2 size={12} />
              Versi efektif sejak{" "}
              {formatDateId(
                data?.sourceCoverage.find((source) => source.code === "DTTOT")
                  ?.effective_date,
              )}
            </div>
          </div>

          <div className="card animate-fade-up p-4 stagger-6 sm:p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[0.82rem] font-bold text-ink-900">
                  Pipeline kasus
                </p>
                <p className="mt-0.5 text-[0.68rem] text-slate-500">
                  Status penanganan temuan.
                </p>
              </div>
              <UsersRound size={16} className="text-slate-400" />
            </div>
            <div className="mt-3 space-y-2">
              {(data?.casePipeline ?? []).map((stage) => (
                <div
                  key={stage.stage}
                  className="flex items-center gap-2.5 rounded-lg border border-line/70 px-2.5 py-2"
                >
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: stage.color }}
                  />
                  <span className="flex-1 text-[0.69rem] font-semibold text-slate-600">
                    {CASE_STATUS_META[stage.stage as keyof typeof CASE_STATUS_META]
                      ?.label ?? stage.stage}
                  </span>
                  <span className="text-[0.76rem] font-extrabold text-ink-900">
                    {stage.count}
                  </span>
                  <div className="h-1.5 w-14 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${Math.min(100, stage.count * 22 + 4)}%`,
                        background: stage.color,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
            <Link href="/cases" className="btn btn-secondary btn-sm mt-3 w-full">
              Buka workspace kasus <ArrowRight size={13} />
            </Link>
          </div>
        </div>
      </section>

      <section className="animate-fade-up rounded-xl border border-gold-200 bg-gradient-to-r from-gold-50 to-white px-4 py-3.5 stagger-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-lg bg-gold-100 text-gold-700">
              <Sparkles size={15} />
            </span>
            <div>
              <p className="text-[0.74rem] font-bold text-ink-900">
                Kewajiban pemutakhiran DTTOT berikutnya
              </p>
              <p className="mt-0.5 text-[0.66rem] leading-relaxed text-slate-500">
                Verifikasi berkala daftar sanksi minimal setiap 6 bulan dan
                dokumentasikan dalam audit trail. Versi terakhir: DTTOT Tahap II
                Tahun 2026.
              </p>
            </div>
          </div>
          <Link href="/watchlist" className="btn btn-secondary btn-sm shrink-0">
            Kelola watchlist <ChevronRight size={13} />
          </Link>
        </div>
      </section>
    </div>
  );
}
