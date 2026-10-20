"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpDown,
  BadgeCheck,
  Ban,
  Building2,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Clock3,
  Download,
  ExternalLink,
  FileSearch,
  FileText,
  Filter,
  Fingerprint,
  FlaskConical,
  GitCompareArrows,
  Globe2,
  IdCard,
  Info,
  Link2,
  LockKeyhole,
  MapPin,
  RefreshCw,
  Scale,
  ScanSearch,
  ShieldAlert,
  ShieldCheck,
  SlidersHorizontal,
  Snowflake,
  Sparkles,
  UserRound,
  UsersRound,
  X,
  Zap,
} from "lucide-react";
import type {
  AnalystRecommendation,
  CaseStatus,
  MatchDetail,
  MatchListItem,
  SourceCode,
} from "@/lib/types";
import {
  formatDateId,
  formatDateTimeId,
} from "@/lib/normalize";
import {
  CASE_STATUS_META,
  RECOMMENDATION_META,
  SEVERITY_META,
  SOURCE_META,
  APPROVAL_STEP_META,
  ROLE_META,
  clsx,
  getInitials,
} from "@/lib/ui";
import { useDemoUser } from "@/components/user-provider";
import { useToast } from "@/components/toast-provider";
import {
  Alert,
  DiffText,
  EmptyState,
  Field,
  Modal,
  PageHeader,
  Pagination,
  ProgressBar,
  RiskBadge,
  ScoreRing,
  SearchInput,
  Skeleton,
} from "@/components/ui";

interface MatchesResponse {
  items: MatchListItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  metrics: {
    all: number;
    critical: number;
    high: number;
    medium: number;
    whitelisted: number;
    unhandled: number;
    openCases: number;
    averageScore: number;
  };
}

const SOURCE_CODES: SourceCode[] = ["DTTOT", "DPPSPM", "PEP", "UN_SANCTION"];

export default function ResultsPage() {
  const { user, apiFetch, downloadFile } = useDemoUser();
  const toast = useToast();
  const router = useRouter();
  const [data, setData] = useState<MatchesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [severity, setSeverity] = useState("all");
  const [source, setSource] = useState("all");
  const [status, setStatus] = useState("all");
  const [whitelist, setWhitelist] = useState("exclude");
  const [minScore, setMinScore] = useState("70");
  const [sort, setSort] = useState("score_desc");
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MatchDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [exporting, setExporting] = useState(false);
  const autoOpened = useRef(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebounced(query);
      setPage(1);
    }, 280);
    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const params = new URLSearchParams({
      severity,
      source,
      status,
      whitelist,
      minScore,
      sort,
      page: String(page),
      pageSize: "20",
    });
    if (debounced) params.set("q", debounced);
    apiFetch<MatchesResponse>(`/api/matches?${params.toString()}`)
      .then((payload) => {
        if (active) setData(payload);
      })
      .catch((error) =>
        toast.error("Gagal memuat hasil screening", (error as Error).message),
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
    severity,
    source,
    status,
    whitelist,
    minScore,
    sort,
    page,
    refreshIndex,
    toast,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const initialQuery = params.get("q");
    const initialMatch = params.get("match");
    if (initialQuery) setQuery(initialQuery);
    if (initialMatch && !autoOpened.current) {
      autoOpened.current = true;
      setSelectedId(initialMatch);
    }
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    let active = true;
    setDetailLoading(true);
    apiFetch<{ match: MatchDetail }>(`/api/matches/${selectedId}`)
      .then((payload) => {
        if (active) setDetail(payload.match);
      })
      .catch((error) => {
        toast.error("Gagal memuat detail", (error as Error).message);
        if (active) setSelectedId(null);
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });
    return () => {
      active = false;
    };
  }, [apiFetch, selectedId, refreshIndex, toast]);

  function refreshDetail() {
    setRefreshIndex((index) => index + 1);
  }

  function closeDetail() {
    setSelectedId(null);
    setDetail(null);
    if (typeof window !== "undefined" && window.location.search.includes("match=")) {
      router.replace("/results");
    }
  }

  async function exportExcel() {
    setExporting(true);
    try {
      await downloadFile(
        "/api/export/screening",
        "Rekap_Screening_APUPPT_DMB.xlsx",
      );
      toast.success("Export berhasil", "Rekap audit OJK diunduh dalam format Excel.");
    } catch (error) {
      toast.error("Export gagal", (error as Error).message);
    } finally {
      setExporting(false);
    }
  }

  function resetFilters() {
    setQuery("");
    setSeverity("all");
    setSource("all");
    setStatus("all");
    setWhitelist("exclude");
    setMinScore("70");
    setSort("score_desc");
    setPage(1);
  }

  const metrics = data?.metrics;
  const activeFilterCount = [
    severity !== "all",
    source !== "all",
    status !== "all",
    whitelist !== "exclude",
    minScore !== "70",
    Boolean(query),
  ].filter(Boolean).length;

  return (
    <div>
      <PageHeader
        eyebrow="Monitoring"
        title="Hasil Screening"
        description="Tinjau kandidat match, bandingkan profil nasabah dengan entitas watchlist, dan buka kasus investigasi dengan alur maker-checker."
        icon={<ScanSearch size={19} />}
        actions={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setRefreshIndex((index) => index + 1)}
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
              <Download size={14} />
              {exporting ? "Menyiapkan..." : "Export Excel"}
            </button>
          </>
        }
      />

      <section className="card stat-strip mb-3 overflow-hidden">
        <div className="grid grid-cols-2 divide-x divide-y divide-line sm:grid-cols-3 xl:grid-cols-6 xl:divide-y-0">
          {[
            {
              label: "Semua hasil",
              value: metrics?.all ?? 0,
              color: "#0b263a",
              active: severity === "all",
              onClick: () => {
                setSeverity("all");
                setPage(1);
              },
            },
            {
              label: "Critical",
              value: metrics?.critical ?? 0,
              color: "#d92d20",
              active: severity === "CRITICAL",
              onClick: () => {
                setSeverity("CRITICAL");
                setPage(1);
              },
            },
            {
              label: "High risk",
              value: metrics?.high ?? 0,
              color: "#e66716",
              active: severity === "HIGH",
              onClick: () => {
                setSeverity("HIGH");
                setPage(1);
              },
            },
            {
              label: "Potential",
              value: metrics?.medium ?? 0,
              color: "#d69e0f",
              active: severity === "MEDIUM",
              onClick: () => {
                setSeverity("MEDIUM");
                setPage(1);
              },
            },
            {
              label: "Whitelisted",
              value: metrics?.whitelisted ?? 0,
              color: "#64748b",
              active: whitelist === "only",
              onClick: () => {
                setWhitelist(whitelist === "only" ? "exclude" : "only");
                setPage(1);
              },
            },
            {
              label: "Belum ditangani",
              value: metrics?.unhandled ?? 0,
              color: "#6d3cb5",
              active: status === "unhandled",
              onClick: () => {
                setStatus(status === "unhandled" ? "all" : "unhandled");
                setPage(1);
              },
            },
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={item.onClick}
              className={clsx(
                "px-4 py-3 text-left transition-colors hover:bg-slate-50",
                item.active && "bg-brand-50/50",
              )}
            >
              <p className="text-[0.6rem] font-bold uppercase tracking-[0.08em] text-slate-400">
                {item.label}
              </p>
              <p
                className="mt-1 text-[1.28rem] font-extrabold leading-none"
                style={{ color: item.color }}
              >
                {item.value}
              </p>
            </button>
          ))}
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="border-b border-line p-3">
          <div className="flex flex-col gap-2 xl:flex-row xl:items-center">
            <SearchInput
              value={query}
              onChange={setQuery}
              placeholder="Cari nama nasabah, CIF, entitas, no. kasus..."
              className="w-full xl:w-[340px]"
            />
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 text-[0.64rem] font-semibold text-slate-400">
                <SlidersHorizontal size={12} />
                Filter
              </div>
              <select
                className="select h-9 w-auto min-w-[125px] py-1.5 text-[0.71rem]"
                value={severity}
                onChange={(event) => {
                  setSeverity(event.target.value);
                  setPage(1);
                }}
              >
                <option value="all">Semua risiko</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Potential</option>
              </select>
              <select
                className="select h-9 w-auto min-w-[110px] py-1.5 text-[0.71rem]"
                value={source}
                onChange={(event) => {
                  setSource(event.target.value);
                  setPage(1);
                }}
              >
                <option value="all">Semua sumber</option>
                {SOURCE_CODES.map((code) => (
                  <option key={code} value={code}>
                    {SOURCE_META[code].label}
                  </option>
                ))}
              </select>
              <select
                className="select h-9 w-auto min-w-[135px] py-1.5 text-[0.71rem]"
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(1);
                }}
              >
                <option value="all">Semua status</option>
                <option value="unhandled">Belum ditangani</option>
                <option value="open">Kasus terbuka</option>
                <option value="PENDING_APPROVAL">Menunggu approval</option>
                <option value="closed">Selesai</option>
              </select>
              <select
                className="select h-9 w-auto min-w-[110px] py-1.5 text-[0.71rem]"
                value={minScore}
                onChange={(event) => {
                  setMinScore(event.target.value);
                  setPage(1);
                }}
              >
                <option value="70">Skor ≥ 70</option>
                <option value="80">Skor ≥ 80</option>
                <option value="85">Skor ≥ 85</option>
                <option value="95">Skor ≥ 95</option>
              </select>
              <select
                className="select h-9 w-auto min-w-[130px] py-1.5 text-[0.71rem]"
                value={sort}
                onChange={(event) => {
                  setSort(event.target.value);
                  setPage(1);
                }}
              >
                <option value="score_desc">Skor tertinggi</option>
                <option value="score_asc">Skor terendah</option>
                <option value="date_desc">Terbaru</option>
                <option value="name_asc">Nama A–Z</option>
              </select>
              {activeFilterCount > 0 ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={resetFilters}
                >
                  <X size={12} /> Reset ({activeFilterCount})
                </button>
              ) : null}
            </div>
            <div className="ml-auto hidden items-center gap-1.5 text-[0.64rem] text-slate-400 xl:flex">
              <ArrowUpDown size={12} /> {data?.total ?? 0} hasil
            </div>
          </div>
        </div>

        {loading && !data ? (
          <div className="space-y-2 p-3">
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <Skeleton key={index} className="h-14 w-full" />
            ))}
          </div>
        ) : data?.items.length ? (
          <>
            <div className="overflow-x-auto">
              <table className="data-table min-w-[1020px]">
                <thead>
                  <tr>
                    <th>Skor</th>
                    <th>Nasabah</th>
                    <th>Entitas watchlist</th>
                    <th>Lahir / Tempat</th>
                    <th>Kategori</th>
                    <th>Status kasus</th>
                    <th>Waktu match</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((match) => (
                    <tr key={match.id}>
                      <td>
                        <div className="flex items-center gap-2">
                          <ScoreRing value={match.score} size={44} stroke={5} />
                          <div>
                            <p className="text-[0.78rem] font-extrabold text-ink-900">
                              {Math.round(match.score)}%
                            </p>
                            <p className="mt-0.5 text-[0.56rem] text-slate-400">
                              {match.is_exact_identity_match
                                ? "Exact ID"
                                : "Weighted"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <span
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[0.56rem] font-extrabold text-white"
                            style={{
                              background:
                                match.severity === "CRITICAL"
                                  ? "#b42318"
                                  : match.severity === "HIGH"
                                    ? "#c45a10"
                                    : "#a37b0d",
                            }}
                          >
                            {getInitials(match.customer.full_name)}
                          </span>
                          <div>
                            <p className="primary-cell text-[0.75rem]">
                              {match.customer.full_name}
                            </p>
                            <p className="mono mt-0.5 text-[0.6rem] text-slate-400">
                              {match.customer.cif_number} ·{" "}
                              {match.customer.national_id_masked}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="flex items-start gap-2">
                          <span
                            className="badge mt-0.5 !px-1.5 !py-0.5"
                            style={{
                              background: SOURCE_META[match.source.code].bg,
                              color: SOURCE_META[match.source.code].color,
                            }}
                          >
                            {SOURCE_META[match.source.code].short}
                          </span>
                          <div>
                            <p className="max-w-[180px] text-[0.72rem] font-semibold leading-snug text-ink-800">
                              {match.entity.primary_name}
                            </p>
                            <p className="mt-0.5 max-w-[180px] truncate text-[0.59rem] text-slate-400">
                              {match.source.version_label}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <p className="text-[0.69rem] font-semibold text-ink-800">
                          {formatDateId(match.customer.date_of_birth)}
                        </p>
                        <p className="mt-0.5 text-[0.6rem] text-slate-400">
                          {match.customer.place_of_birth} ·{" "}
                          {match.customer.nationality}
                        </p>
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
                          <div>
                            <span
                              className={clsx(
                                "badge",
                                CASE_STATUS_META[match.case.status].className,
                              )}
                            >
                              {CASE_STATUS_META[match.case.status].label}
                            </span>
                            <p className="mono mt-1 text-[0.58rem] text-slate-400">
                              {match.case.case_number}
                            </p>
                          </div>
                        ) : match.is_whitelisted ? (
                          <span className="badge badge-neutral">
                            <ShieldCheck size={10} /> Dikecualikan
                          </span>
                        ) : (
                          <span className="badge badge-neutral">
                            Belum ditangani
                          </span>
                        )}
                      </td>
                      <td className="text-[0.64rem] text-slate-500">
                        {formatDateTimeId(match.matched_at)}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => setSelectedId(match.id)}
                        >
                          <GitCompareArrows size={13} /> Bandingkan
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="border-t border-line px-3">
              <Pagination
                page={data.page}
                pageCount={data.pageCount}
                total={data.total}
                onChange={setPage}
              />
            </div>
          </>
        ) : (
          <EmptyState
            icon={<FileSearch size={22} />}
            title="Tidak ada hasil yang cocok"
            description="Ubah filter risiko, sumber watchlist, atau kata kunci pencarian."
            action={
              <button type="button" className="btn btn-secondary btn-sm" onClick={resetFilters}>
                Reset filter
              </button>
            }
          />
        )}
      </section>

      <p className="mt-2.5 flex items-center gap-1.5 px-1 text-[0.62rem] text-slate-400">
        <LockKeyhole size={11} />
        NIK dan nomor rekening ditampilkan dalam bentuk masker. Setiap pembukaan
        detail dicatat pada audit trail.
      </p>

      <ComparatorModal
        open={Boolean(selectedId)}
        loading={detailLoading}
        match={detail}
        onClose={closeDetail}
        onChanged={refreshDetail}
      />
    </div>
  );
}

/* --------------------------- Comparator modal ---------------------------- */

function ComparatorModal({
  open,
  loading,
  match,
  onClose,
  onChanged,
}: {
  open: boolean;
  loading: boolean;
  match: MatchDetail | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { user, apiFetch } = useDemoUser();
  const toast = useToast();
  const [tab, setTab] = useState<"compare" | "score" | "case">("compare");
  const [recommendation, setRecommendation] =
    useState<AnalystRecommendation>("CONFIRM_HIT");
  const [note, setNote] = useState("");
  const [priority, setPriority] = useState<"NORMAL" | "HIGH">("HIGH");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      setTab("compare");
      setNote("");
      setRecommendation("CONFIRM_HIT");
      setPriority("HIGH");
    }
  }, [open, match?.id]);

  async function createCase() {
    if (!match) return;
    if (note.trim().length < 10) {
      toast.error("Catatan minimal 10 karakter");
      return;
    }
    setSubmitting(true);
    try {
      const payload = await apiFetch<{
        case: { case_number: string };
      }>(`/api/matches/${match.id}/case`, {
        method: "POST",
        body: JSON.stringify({
          recommendation,
          note: note.trim(),
          priority,
        }),
      });
      toast.success(
        "Kasus berhasil dibuka",
        `${payload.case.case_number} siap dianalisis dan diajukan ke checker.`,
      );
      onChanged();
      setTab("case");
    } catch (error) {
      toast.error("Gagal membuka kasus", (error as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  const breakdown = match?.breakdown;
  const exact = match?.is_exact_identity_match;
  const matchedName = match
    ? match.breakdown.matched_on_alias ?? match.entity.primary_name
    : "";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Side-by-Side Comparator"
      description="Bandingkan profil nasabah dengan entitas sanksi dan tinjau dasar skor kemiripan."
      size="full"
      footer={
        match ? (
          <>
            <span className="mr-auto hidden items-center gap-1.5 text-[0.63rem] text-slate-400 sm:flex">
              <Fingerprint size={12} /> Match ID {match.id}
            </span>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Tutup
            </button>
            {match.case_detail ? (
              <Link
                href={`/cases?case=${match.case_detail.id}`}
                className="btn btn-primary"
                onClick={onClose}
              >
                Buka workspace kasus <ArrowRight size={14} />
              </Link>
            ) : match.is_whitelisted ? (
              <button type="button" className="btn btn-secondary" disabled>
                <ShieldCheck size={14} /> Whitelisted
              </button>
            ) : user.role_code === "MAKER_ANALYST" ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setTab("case")}
              >
                <FileText size={14} /> Buka kasus investigasi
              </button>
            ) : null}
          </>
        ) : null
      }
    >
      {loading || !match ? (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full" />
          <div className="grid gap-3 md:grid-cols-2">
            <Skeleton className="h-72 w-full" />
            <Skeleton className="h-72 w-full" />
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-col gap-3 rounded-xl border border-line bg-slate-50/70 p-3.5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <ScoreRing value={match.score} size={64} stroke={7} label="Score" />
              <div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <RiskBadge
                    severity={match.severity}
                    whitelisted={match.is_whitelisted}
                    exact={match.is_exact_identity_match}
                  />
                  {match.is_exact_identity_match ? (
                    <span className="badge badge-info">
                      <Fingerprint size={10} /> Exact identity
                    </span>
                  ) : null}
                  <span className="badge badge-neutral">
                    Threshold ≥ 70%
                  </span>
                </div>
                <p className="mt-1.5 text-[0.8rem] font-bold text-ink-900">
                  {match.customer.full_name}{" "}
                  <span className="font-normal text-slate-400">vs</span>{" "}
                  {match.entity.primary_name}
                </p>
                <p className="mt-0.5 text-[0.64rem] text-slate-500">
                  {SOURCE_META[match.source.code].label} ·{" "}
                  {match.source.version_label} · Match{" "}
                  {formatDateTimeId(match.matched_at)}
                </p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:ml-auto">
              {[
                ["Nama", breakdown?.name_similarity_score ?? 0],
                ["DOB", breakdown?.dob_match_score ?? 0],
                ["POB", breakdown?.pob_match_score ?? 0],
                ["Negara", breakdown?.nationality_match_score ?? 0],
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  className="rounded-lg border border-line bg-white px-2.5 py-2 text-center"
                >
                  <p className="text-[0.55rem] font-bold uppercase tracking-wider text-slate-400">
                    {label}
                  </p>
                  <p className="mt-0.5 text-[0.8rem] font-extrabold text-ink-900">
                    {exact ? 100 : Math.round(Number(value))}%
                  </p>
                </div>
              ))}
            </div>
          </div>

          {match.is_whitelisted ? (
            <Alert variant="success" icon={<ShieldCheck size={16} />} title="Whitelist aktif">
              Pasangan nasabah–entitas ini telah diverifikasi sebagai false
              positive dan dikecualikan dari eskalasi kasus.
            </Alert>
          ) : null}

          <div className="tabs">
            <button
              type="button"
              className={clsx("tab", tab === "compare" && "active")}
              onClick={() => setTab("compare")}
            >
              <GitCompareArrows size={13} /> Perbandingan
            </button>
            <button
              type="button"
              className={clsx("tab", tab === "score" && "active")}
              onClick={() => setTab("score")}
            >
              <FlaskConical size={13} /> Rincian skor
            </button>
            <button
              type="button"
              className={clsx("tab", tab === "case" && "active")}
              onClick={() => setTab("case")}
            >
              <FileText size={13} /> Kasus & tindakan
              {match.case_detail ? (
                <span className="rounded-full bg-slate-200 px-1.5 py-0.5 text-[0.55rem] font-bold text-slate-600">
                  1
                </span>
              ) : null}
            </button>
          </div>

          {tab === "compare" ? (
            <div className="grid gap-3 lg:grid-cols-2">
              <section className="overflow-hidden rounded-xl border border-line">
                <div className="flex items-center justify-between border-b border-line bg-slate-50 px-3.5 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                      <UserRound size={14} />
                    </span>
                    <div>
                      <p className="text-[0.72rem] font-bold text-ink-900">
                        Data Nasabah
                      </p>
                      <p className="mono text-[0.58rem] text-slate-400">
                        {match.customer.cif_number}
                      </p>
                    </div>
                  </div>
                  <span className="badge badge-neutral">
                    {match.customer.customer_type}
                  </span>
                </div>
                <div className="space-y-4 p-3.5">
                  <div className="rounded-lg bg-brand-50/50 p-3">
                    <p className="text-[0.56rem] font-bold uppercase tracking-wider text-brand-700">
                      Nama lengkap
                    </p>
                    <p className="mt-1 text-[1rem] font-extrabold leading-snug text-ink-900">
                      <DiffText
                        value={match.customer.full_name}
                        compare={matchedName}
                      />
                    </p>
                    <p className="mt-1 text-[0.61rem] text-slate-500">
                      Nama tersanitasi · {match.customer.full_name.split(" ").length} token
                    </p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <CompareField
                      icon={<IdCard size={12} />}
                      label="NIK"
                      value={match.customer.national_id_masked}
                      matched={match.is_exact_identity_match}
                      mono
                    />
                    <CompareField
                      icon={<Globe2 size={12} />}
                      label="Kewarganegaraan"
                      value={match.customer.nationality}
                      matched={
                        (breakdown?.nationality_match_score ?? 0) === 100
                      }
                    />
                    <CompareField
                      icon={<CalendarDays size={12} />}
                      label="Tanggal lahir"
                      value={formatDateId(match.customer.date_of_birth)}
                      matched={(breakdown?.dob_match_score ?? 0) === 100}
                    />
                    <CompareField
                      icon={<MapPin size={12} />}
                      label="Tempat lahir"
                      value={match.customer.place_of_birth}
                      matched={(breakdown?.pob_match_score ?? 0) >= 85}
                    />
                    <CompareField
                      icon={<Link2 size={12} />}
                      label="No. rekening"
                      value={match.customer.account_number_masked}
                      mono
                    />
                    <CompareField
                      icon={<IdCard size={12} />}
                      label="Paspor"
                      value={match.customer_full.passport_number}
                      mono
                    />
                  </div>
                  <Field label="Alamat" value={match.customer_full.address} />
                </div>
              </section>

              <section className="overflow-hidden rounded-xl border border-line">
                <div className="flex items-center justify-between border-b border-line bg-slate-50 px-3.5 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 text-red-700">
                      {match.entity.entity_type === "CORPORATE" ? (
                        <Building2 size={14} />
                      ) : (
                        <ShieldAlert size={14} />
                      )}
                    </span>
                    <div>
                      <p className="text-[0.72rem] font-bold text-ink-900">
                        Profil Watchlist
                      </p>
                      <p className="text-[0.58rem] text-slate-400">
                        {SOURCE_META[match.source.code].label} ·{" "}
                        {match.source.published_by}
                      </p>
                    </div>
                  </div>
                  <span
                    className="badge !px-2 !py-0.5"
                    style={{
                      background: SOURCE_META[match.source.code].bg,
                      color: SOURCE_META[match.source.code].color,
                    }}
                  >
                    {match.source.code}
                  </span>
                </div>
                <div className="space-y-4 p-3.5">
                  <div className="rounded-lg bg-red-50/45 p-3">
                    <p className="text-[0.56rem] font-bold uppercase tracking-wider text-red-700">
                      Nama resmi / alias yang cocok
                    </p>
                    <p className="mt-1 text-[1rem] font-extrabold leading-snug text-ink-900">
                      <DiffText
                        value={match.entity.primary_name}
                        compare={match.customer.full_name}
                      />
                    </p>
                    {match.breakdown.matched_on_alias ? (
                      <p className="mt-1 text-[0.61rem] text-slate-500">
                        Match melalui alias{" "}
                        <strong className="text-ink-800">
                          “{match.breakdown.matched_on_alias}”
                        </strong>
                      </p>
                    ) : (
                      <p className="mt-1 text-[0.61rem] text-slate-500">
                        Match melalui nama primer
                      </p>
                    )}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <CompareField
                      icon={<Globe2 size={12} />}
                      label="Kewarganegaraan"
                      value={match.entity.nationality ?? "—"}
                      matched={
                        (breakdown?.nationality_match_score ?? 0) === 100
                      }
                    />
                    <CompareField
                      icon={<CalendarDays size={12} />}
                      label="Tanggal lahir"
                      value={formatDateId(match.entity.date_of_birth)}
                      matched={(breakdown?.dob_match_score ?? 0) === 100}
                    />
                    <CompareField
                      icon={<MapPin size={12} />}
                      label="Tempat lahir"
                      value={match.entity.place_of_birth ?? "—"}
                      matched={(breakdown?.pob_match_score ?? 0) >= 85}
                    />
                    <CompareField
                      icon={<Scale size={12} />}
                      label="Dasar hukum"
                      value={match.entity.legal_reference ?? "—"}
                    />
                  </div>
                  <div>
                    <p className="mb-1 text-[0.58rem] font-bold uppercase tracking-wider text-slate-400">
                      Alias ({match.aliases.length})
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {match.aliases.length ? (
                        match.aliases.map((alias) => (
                          <span
                            key={alias}
                            className={clsx(
                              "rounded-md border px-1.5 py-0.5 text-[0.61rem]",
                              alias === match.breakdown.matched_on_alias
                                ? "border-amber-300 bg-amber-50 font-bold text-amber-800"
                                : "border-line bg-slate-50 text-slate-600",
                            )}
                          >
                            {alias}
                          </span>
                        ))
                      ) : (
                        <span className="text-[0.65rem] text-slate-400">
                          Tidak ada alias
                        </span>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="mb-1 text-[0.58rem] font-bold uppercase tracking-wider text-slate-400">
                      Dokumen identitas
                    </p>
                    {match.documents.length ? (
                      <div className="flex flex-wrap gap-1">
                        {match.documents.map((document) => (
                          <span
                            key={`${document.document_type}-${document.id}`}
                            className="mono rounded-md border border-line bg-slate-50 px-1.5 py-0.5 text-[0.61rem] text-slate-600"
                          >
                            {document.document_type} · {document.document_number}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[0.65rem] text-slate-400">—</span>
                    )}
                  </div>
                </div>
              </section>
            </div>
          ) : null}

          {tab === "score" ? (
            <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
              <section className="rounded-xl border border-line p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-[0.8rem] font-bold text-ink-900">
                      Multi-attribute weighted scoring
                    </p>
                    <p className="mt-0.5 text-[0.66rem] text-slate-500">
                      Skor akhir = Σ (skor atribut × bobot).
                    </p>
                  </div>
                  {exact ? (
                    <span className="badge badge-critical">
                      Exact override 100%
                    </span>
                  ) : (
                    <span className="badge badge-info">
                      Weighted score {Math.round(match.score)}%
                    </span>
                  )}
                </div>
                <div className="mt-4 space-y-4">
                  {[
                    {
                      label: "Kemiripan nama / alias",
                      weight: 50,
                      value: breakdown?.name_similarity_score ?? 0,
                    },
                    {
                      label: "Tanggal lahir (DOB)",
                      weight: 25,
                      value: breakdown?.dob_match_score ?? 0,
                    },
                    {
                      label: "Tempat lahir (POB)",
                      weight: 15,
                      value: breakdown?.pob_match_score ?? 0,
                    },
                    {
                      label: "Kewarganegaraan",
                      weight: 10,
                      value: breakdown?.nationality_match_score ?? 0,
                    },
                  ].map((item) => (
                    <div key={item.label}>
                      <div className="flex items-center justify-between">
                        <span className="text-[0.71rem] font-semibold text-slate-600">
                          {item.label}
                        </span>
                        <span className="text-[0.65rem] text-slate-400">
                          bobot {item.weight}% ·{" "}
                          <strong className="text-ink-900">
                            {Math.round(item.value)}%
                          </strong>
                        </span>
                      </div>
                      <div className="mt-1.5">
                        <ProgressBar
                          value={item.value}
                          color={
                            item.value >= 85
                              ? "#0f9f6e"
                              : item.value >= 70
                                ? "#d69e0f"
                                : "#94a3b8"
                          }
                        />
                      </div>
                      <p className="mt-1 text-[0.59rem] text-slate-400">
                        Kontribusi{" "}
                        <strong className="text-slate-600">
                          {(
                            (item.value * item.weight) /
                            100
                          ).toFixed(2)}
                        </strong>{" "}
                        poin
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-4 flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2.5">
                  <span className="text-[0.7rem] font-bold text-ink-900">
                    Total confidence
                  </span>
                  <span className="text-[1.1rem] font-extrabold text-ink-900">
                    {match.score.toFixed(2)}%
                  </span>
                </div>
              </section>

              <section className="space-y-3">
                <div className="rounded-xl border border-line p-4">
                  <p className="text-[0.8rem] font-bold text-ink-900">
                    Algorithm telemetry
                  </p>
                  <p className="mt-0.5 text-[0.66rem] text-slate-500">
                    Bukti perhitungan untuk kebutuhan audit.
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {[
                      [
                        "Jaro-Winkler",
                        String(
                          match.breakdown.algorithm_telemetry.jaro_winkler ?? "—",
                        ),
                      ],
                      [
                        "Token Sort",
                        String(
                          match.breakdown.algorithm_telemetry.token_sort_ratio ??
                            "—",
                        ),
                      ],
                      [
                        "Double Metaphone",
                        String(
                          match.breakdown.algorithm_telemetry.phonetic_overlap ??
                            "—",
                        ),
                      ],
                      [
                        "Exact document",
                        match.breakdown.algorithm_telemetry.exact_document_match
                          ? String(
                              match.breakdown.algorithm_telemetry
                                .exact_document_match,
                            )
                          : "Tidak",
                      ],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-lg border border-line bg-slate-50 px-2.5 py-2"
                      >
                        <p className="text-[0.55rem] font-bold uppercase tracking-wider text-slate-400">
                          {label}
                        </p>
                        <p className="mono mt-0.5 text-[0.7rem] font-bold text-ink-900">
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="rounded-xl border border-line p-4">
                  <p className="text-[0.8rem] font-bold text-ink-900">
                    Kategorisasi
                  </p>
                  <div className="mt-2 space-y-2">
                    {[
                      ["Critical / exact identity", "100%", "#d92d20"],
                      ["High / suspect", "≥ 85%", "#e66716"],
                      ["Potential", "70–84%", "#d69e0f"],
                      ["Clean", "< 70%", "#0f9f6e"],
                    ].map(([label, range, color]) => (
                      <div key={label} className="flex items-center gap-2">
                        <span
                          className="h-2 w-2 rounded-full"
                          style={{ background: color }}
                        />
                        <span className="flex-1 text-[0.67rem] text-slate-500">
                          {label}
                        </span>
                        <span className="text-[0.66rem] font-bold text-ink-900">
                          {range}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex items-start gap-1.5 rounded-lg bg-brand-50/60 px-2.5 py-2 text-[0.61rem] leading-relaxed text-brand-800">
                    <CircleHelp size={12} className="mt-0.5 shrink-0" />
                    Exact NIK/paspor menghasilkan skor 100% dan severity CRITICAL
                    tanpa menunggu skor terbobot.
                  </div>
                </div>
              </section>
            </div>
          ) : null}

          {tab === "case" ? (
            <div>
              {match.case_detail ? (
                <CaseSummary detail={match} />
              ) : match.is_whitelisted ? (
                <Alert
                  variant="success"
                  icon={<ShieldCheck size={16} />}
                  title="Tidak perlu eskalasi"
                >
                  Pasangan ini sudah masuk whitelist. Tidak ada kasus yang perlu
                  dibuka.
                </Alert>
              ) : user.role_code !== "MAKER_ANALYST" ? (
                <Alert
                  variant="info"
                  icon={<UsersRound size={16} />}
                  title={`Persona aktif: ${ROLE_META[user.role_code].label}`}
                >
                  Pembukaan kasus hanya dapat dilakukan oleh Maker / Analis AML.
                  Beralih persona melalui menu profil untuk menguji alur ini.
                </Alert>
              ) : (
                <div className="grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
                  <section className="rounded-xl border border-line p-4">
                    <p className="text-[0.82rem] font-bold text-ink-900">
                      Buka kasus investigasi
                    </p>
                    <p className="mt-0.5 text-[0.66rem] text-slate-500">
                      Kasus akan masuk ke pipeline dan dapat diajukan ke checker
                      setelah bukti lengkap.
                    </p>
                    <div className="mt-3 space-y-3">
                      <div>
                        <label className="field-label">Rekomendasi awal</label>
                        <select
                          className="select"
                          value={recommendation}
                          onChange={(event) =>
                            setRecommendation(
                              event.target.value as AnalystRecommendation,
                            )
                          }
                        >
                          <option value="CONFIRM_HIT">
                            Konfirmasi Hit — eskalasi ke maker-checker
                          </option>
                          <option value="ESCALATE_EDD">
                            Eskalasi EDD — perlu pemeriksaan mendalam
                          </option>
                          <option value="DISMISS_FALSE_POSITIVE">
                            False Positive — usulkan pengecualian
                          </option>
                        </select>
                      </div>
                      <div>
                        <label className="field-label">Prioritas</label>
                        <div className="grid grid-cols-2 gap-2">
                          {(["HIGH", "NORMAL"] as const).map((value) => (
                            <button
                              key={value}
                              type="button"
                              onClick={() => setPriority(value)}
                              className={clsx(
                                "rounded-lg border px-3 py-2 text-left text-[0.7rem] transition",
                                priority === value
                                  ? "border-brand-400 bg-brand-50 text-brand-800"
                                  : "border-line bg-white text-slate-500 hover:bg-slate-50",
                              )}
                            >
                              <span className="font-bold">
                                {value === "HIGH" ? "High" : "Normal"}
                              </span>
                              <span className="mt-0.5 block text-[0.6rem]">
                                {value === "HIGH"
                                  ? "Tindak lanjut segera"
                                  : "Sesuai antrean analis"}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="field-label">
                          Catatan investigasi *
                        </label>
                        <textarea
                          className="textarea"
                          value={note}
                          onChange={(event) => setNote(event.target.value)}
                          placeholder="Ringkas hasil verifikasi dokumen, perbedaan identitas, dan alasan rekomendasi..."
                        />
                        <p className="mt-1 text-[0.6rem] text-slate-400">
                          {note.trim().length}/10 karakter minimum.
                        </p>
                      </div>
                      <button
                        type="button"
                        className="btn btn-primary w-full"
                        onClick={createCase}
                        disabled={submitting}
                      >
                        {submitting ? (
                          <RefreshCw size={14} className="animate-spin" />
                        ) : (
                          <Zap size={14} />
                        )}
                        Buka kasus & simpan catatan
                      </button>
                    </div>
                  </section>
                  <section className="rounded-xl border border-line bg-slate-50/60 p-4">
                    <p className="text-[0.76rem] font-bold text-ink-900">
                      Kontrol four-eyes
                    </p>
                    <div className="mt-3 space-y-3">
                      {[
                        {
                          title: "Maker / Analis",
                          body: "Membuka kasus, mengumpulkan bukti, memberi rekomendasi.",
                          color: "#0f766e",
                        },
                        {
                          title: "Checker / Supervisor",
                          body: "Memverifikasi kelengkapan dan ketepatan analisis.",
                          color: "#1d4ed8",
                        },
                        {
                          title: "Approver / Compliance Head",
                          body: "Menetapkan verdict final dan pemblokiran rekening.",
                          color: "#b45309",
                        },
                      ].map((step, index) => (
                        <div key={step.title} className="flex items-start gap-2.5">
                          <span
                            className="step-dot text-white"
                            style={{ background: step.color }}
                          >
                            {index + 1}
                          </span>
                          <div>
                            <p className="text-[0.69rem] font-bold text-ink-800">
                              {step.title}
                            </p>
                            <p className="mt-0.5 text-[0.61rem] leading-relaxed text-slate-500">
                              {step.body}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[0.61rem] leading-relaxed text-amber-800">
                      Maker tidak dapat menyetujui kasusnya sendiri. Keputusan
                      final hanya oleh Approver.
                    </div>
                  </section>
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}
    </Modal>
  );
}

function CompareField({
  icon,
  label,
  value,
  matched,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  matched?: boolean;
  mono?: boolean;
}) {
  return (
    <div>
      <p className="flex items-center gap-1 text-[0.56rem] font-bold uppercase tracking-wider text-slate-400">
        {icon} {label}
      </p>
      <div className="mt-0.5 flex items-center gap-1.5">
        <p
          className={clsx(
            "text-[0.73rem] font-semibold text-ink-900",
            mono && "mono text-[0.67rem]",
          )}
        >
          {value || "—"}
        </p>
        {matched ? (
          <CheckCircle2 size={11} className="shrink-0 text-emerald-600" />
        ) : null}
      </div>
    </div>
  );
}

function CaseSummary({ detail }: { detail: MatchDetail }) {
  const investigation = detail.case_detail!;
  const approval = investigation.approval;
  return (
    <div className="grid gap-3 lg:grid-cols-[1.1fr_0.9fr]">
      <section className="rounded-xl border border-line p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="mono text-[0.67rem] text-slate-400">
              {investigation.case_number}
            </p>
            <p className="mt-1 text-[0.9rem] font-extrabold text-ink-900">
              {CASE_STATUS_META[investigation.status].label}
            </p>
          </div>
          <span
            className={clsx(
              "badge",
              CASE_STATUS_META[investigation.status].className,
            )}
          >
            {investigation.priority === "HIGH" ? "Prioritas tinggi" : "Normal"}
          </span>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field
            label="Rekomendasi analis"
            value={
              investigation.recommendation
                ? RECOMMENDATION_META[investigation.recommendation].label
                : "—"
            }
          />
          <Field
            label="Tahap approval"
            value={
              approval
                ? APPROVAL_STEP_META[approval.current_step].label
                : "Belum diajukan"
            }
          />
          <Field
            label="Dibuka"
            value={formatDateTimeId(investigation.opened_at)}
          />
          <Field
            label="Verdict final"
            value={approval?.final_verdict ?? "—"}
          />
        </div>
        <div className="mt-3">
          <p className="mb-1.5 text-[0.61rem] font-bold uppercase tracking-wider text-slate-400">
            Catatan terbaru
          </p>
          <div className="space-y-1.5">
            {investigation.notes.slice(0, 2).map((item) => (
              <div key={item.id} className="rounded-lg bg-slate-50 px-2.5 py-2">
                <p className="text-[0.63rem] leading-relaxed text-slate-600">
                  {item.note_content}
                </p>
                <p className="mt-1 text-[0.57rem] text-slate-400">
                  {item.author_name} · {formatDateTimeId(item.created_at)}
                </p>
              </div>
            ))}
            {!investigation.notes.length ? (
              <p className="text-[0.65rem] text-slate-400">
                Belum ada catatan.
              </p>
            ) : null}
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-line p-4">
        <p className="text-[0.76rem] font-bold text-ink-900">
          Maker-checker progress
        </p>
        <div className="mt-3 space-y-3">
          {[
            {
              label: "Analis (Maker)",
              value: approval?.maker_name ?? "—",
              done: true,
            },
            {
              label: "Supervisor (Checker)",
              value: approval?.checker_name ?? "—",
              done:
                approval?.current_step === "APPROVER_SIGN_OFF" ||
                approval?.current_step === "COMPLETED",
            },
            {
              label: "Compliance Head (Approver)",
              value: approval?.approver_name ?? "—",
              done: approval?.current_step === "COMPLETED",
            },
          ].map((step) => (
            <div key={step.label} className="flex items-start gap-2.5">
              <span
                className={clsx(
                  "step-dot",
                  step.done
                    ? "bg-emerald-600 text-white"
                    : "bg-slate-100 text-slate-400",
                )}
              >
                {step.done ? <CheckCircle2 size={11} /> : <Clock3 size={11} />}
              </span>
              <div>
                <p className="text-[0.67rem] font-bold text-ink-800">
                  {step.label}
                </p>
                <p className="text-[0.6rem] text-slate-500">{step.value}</p>
              </div>
            </div>
          ))}
        </div>
        {investigation.freeze ? (
          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-2.5 py-2">
            <p className="flex items-center gap-1.5 text-[0.66rem] font-bold text-red-800">
              <Snowflake size={12} /> Rekening dibekukan
            </p>
            <p className="mt-0.5 text-[0.6rem] text-red-700">
              {investigation.freeze.legal_warrant_number}
            </p>
          </div>
        ) : null}
        {investigation.evidence.length ? (
          <p className="mt-3 flex items-center gap-1.5 text-[0.61rem] text-slate-500">
            <FileText size={11} /> {investigation.evidence.length} dokumen bukti
            terlampir
          </p>
        ) : null}
      </section>
    </div>
  );
}
