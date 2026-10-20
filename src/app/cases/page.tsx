"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Ban,
  Building2,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Clock3,
  Download,
  ExternalLink,
  FileCheck2,
  FileText,
  FolderKanban,
  GitBranch,
  History,
  LockKeyhole,
  MessageSquare,
  RefreshCw,
  Scale,
  Send,
  ShieldAlert,
  ShieldCheck,
  Snowflake,
  UserCheck,
  UsersRound,
  WalletCards,
  XCircle,
} from "lucide-react";
import type {
  AnalystRecommendation,
  ApprovalListItem,
  CaseListItem,
  CaseStatus,
  FreezeStatus,
  MatchDetail,
  NoteType,
} from "@/lib/types";
import {
  formatCurrency,
  formatDateId,
  formatDateTimeId,
} from "@/lib/normalize";
import {
  APPROVAL_STEP_META,
  CASE_STATUS_META,
  RECOMMENDATION_META,
  ROLE_META,
  SEVERITY_META,
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
  RiskBadge,
  ScoreRing,
  SearchInput,
  Skeleton,
  Tabs,
} from "@/components/ui";

interface FreezeView {
  id: string;
  case_id: string;
  cif_number: string;
  account_number: string;
  legal_warrant_number: string;
  total_balance_frozen: number;
  freeze_status: FreezeStatus;
  frozen_at: string;
  lifted_at: string | null;
  freeze_reason: string;
  case_number: string;
  customer_name: string;
}

interface CasesResponse {
  cases: CaseListItem[];
  approvals: ApprovalListItem[];
  freezes: FreezeView[];
  metrics: {
    total: number;
    open: number;
    pendingApproval: number;
    confirmed: number;
    falsePositive: number;
    frozenAccounts: number;
    frozenBalance: number;
    pipeline: Array<{ stage: CaseStatus; count: number }>;
  };
  users: Array<{
    id: string;
    full_name: string;
    role_code: string;
    branch_code: string;
  }>;
}

const NOTE_TYPE_LABELS: Record<NoteType, string> = {
  INTERNAL_ANALYSIS: "Analisis internal",
  VERIFICATION_CALL: "Verifikasi telepon",
  BRANCH_REPLY: "Balasan cabang",
};

export default function CasesPage() {
  const { user, apiFetch, downloadFile } = useDemoUser();
  const toast = useToast();
  const [data, setData] = useState<CasesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"cases" | "approvals" | "freeze">("cases");
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [status, setStatus] = useState("all");
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MatchDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [selectedApproval, setSelectedApproval] =
    useState<ApprovalListItem | null>(null);
  const [selectedFreeze, setSelectedFreeze] = useState<FreezeView | null>(null);
  const [exporting, setExporting] = useState(false);
  const pendingCase = useRef<string | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebounced(query);
    }, 260);
    return () => window.clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    pendingCase.current = new URLSearchParams(window.location.search).get("case");
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const params = new URLSearchParams();
    if (debounced) params.set("q", debounced);
    if (status !== "all") params.set("status", status);
    apiFetch<CasesResponse>(`/api/cases?${params.toString()}`)
      .then((payload) => {
        if (!active) return;
        setData(payload);
        if (pendingCase.current) {
          setSelectedCaseId(pendingCase.current);
          pendingCase.current = null;
        }
      })
      .catch((error) =>
        toast.error("Gagal memuat kasus", (error as Error).message),
      )
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [apiFetch, debounced, status, refreshIndex, toast]);

  const selectedCase = data?.cases.find((item) => item.id === selectedCaseId) ?? null;

  useEffect(() => {
    if (!selectedCase) {
      setDetail(null);
      return;
    }
    let active = true;
    setDetailLoading(true);
    apiFetch<{ match: MatchDetail }>(`/api/matches/${selectedCase.match_id}`)
      .then((payload) => {
        if (active) setDetail(payload.match);
      })
      .catch((error) => {
        toast.error("Gagal memuat detail kasus", (error as Error).message);
      })
      .finally(() => {
        if (active) setDetailLoading(false);
      });
    return () => {
      active = false;
    };
  }, [apiFetch, refreshIndex, selectedCase, toast]);

  function refresh() {
    setRefreshIndex((index) => index + 1);
  }

  async function exportExcel() {
    setExporting(true);
    try {
      await downloadFile(
        "/api/export/screening",
        "Rekap_Screening_APUPPT_DMB.xlsx",
      );
      toast.success("Export berhasil", "Rekap audit OJK berhasil diunduh.");
    } catch (error) {
      toast.error("Export gagal", (error as Error).message);
    } finally {
      setExporting(false);
    }
  }

  const metrics = data?.metrics;

  return (
    <div>
      <PageHeader
        eyebrow="Monitoring"
        title="Kasus & Persetujuan"
        description="Workspace investigasi terpadu dengan prinsip four-eyes, eskalasi berjenjang, dan protokol pembekuan rekening seketika."
        icon={<FolderKanban size={19} />}
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
              <Download size={14} /> {exporting ? "Menyiapkan..." : "Export Excel"}
            </button>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Kasus aktif"
          value={metrics?.open ?? "—"}
          sub={`${metrics?.total ?? 0} total kasus di pipeline`}
          icon={<FolderKanban size={17} />}
          tone="brand"
          delay="stagger-1"
        />
        <MetricCard
          label="Menunggu approval"
          value={metrics?.pendingApproval ?? "—"}
          sub="Checker / Approver perlu tindakan"
          icon={<Clock3 size={17} />}
          tone="medium"
          delay="stagger-2"
        />
        <MetricCard
          label="Confirmed hit"
          value={metrics?.confirmed ?? "—"}
          sub={`${metrics?.falsePositive ?? 0} false positive disetujui`}
          icon={<ShieldAlert size={17} />}
          tone="critical"
          delay="stagger-3"
        />
        <MetricCard
          label="Rekening dibekukan"
          value={metrics?.frozenAccounts ?? "—"}
          sub={formatCurrency(metrics?.frozenBalance ?? 0)}
          icon={<Snowflake size={17} />}
          tone="ink"
          delay="stagger-4"
        />
      </div>

      <section className="mt-4">
        <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
          <Tabs
            value={tab}
            onChange={setTab}
            tabs={[
              { value: "cases", label: "Kasus", count: metrics?.total },
              {
                value: "approvals",
                label: "Approval",
                count: metrics?.pendingApproval,
              },
              {
                value: "freeze",
                label: "Pemblokiran",
                count: metrics?.frozenAccounts,
              },
            ]}
          />
          <div className="flex items-center gap-2">
            {tab === "cases" ? (
              <>
                <SearchInput
                  value={query}
                  onChange={setQuery}
                  placeholder="Cari kasus, nasabah, CIF..."
                  className="w-[230px]"
                />
                <select
                  className="select h-9 w-auto min-w-[135px] py-1.5 text-[0.71rem]"
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                >
                  <option value="all">Semua status</option>
                  <option value="OPEN">Terbuka</option>
                  <option value="IN_ANALYSIS">Dalam analisis</option>
                  <option value="PENDING_APPROVAL">Menunggu approval</option>
                  <option value="CLOSED">Selesai</option>
                </select>
              </>
            ) : null}
          </div>
        </div>

        {tab === "cases" ? (
          <div className="card overflow-hidden">
            {loading && !data ? (
              <div className="space-y-2 p-3">
                {[0, 1, 2, 3, 4].map((index) => (
                  <Skeleton key={index} className="h-14 w-full" />
                ))}
              </div>
            ) : data?.cases.length ? (
              <div className="overflow-x-auto">
                <table className="data-table min-w-[1050px]">
                  <thead>
                    <tr>
                      <th>No. Kasus</th>
                      <th>Nasabah</th>
                      <th>Entitas</th>
                      <th>Skor</th>
                      <th>Status</th>
                      <th>Rekomendasi</th>
                      <th>Approval</th>
                      <th>Dibuka</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {data.cases.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <div className="flex items-start gap-2">
                            {item.priority === "HIGH" ? (
                              <span
                                className="mt-1 h-2 w-2 shrink-0 rounded-full bg-red-500"
                                title="Prioritas tinggi"
                              />
                            ) : (
                              <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-slate-300" />
                            )}
                            <div>
                              <p className="primary-cell mono text-[0.66rem]">
                                {item.case_number}
                              </p>
                              <p className="mt-0.5 text-[0.58rem] text-slate-400">
                                {item.note_count} catatan · {item.evidence_count} bukti
                              </p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-2.5">
                            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-[0.52rem] font-bold text-slate-600">
                              {getInitials(item.customer_name)}
                            </span>
                            <div>
                              <p className="text-[0.73rem] font-semibold text-ink-900">
                                {item.customer_name}
                              </p>
                              <p className="mono mt-0.5 text-[0.59rem] text-slate-400">
                                {item.customer_cif}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td>
                          <p className="max-w-[150px] truncate text-[0.71rem] font-semibold text-ink-800">
                            {item.entity_name}
                          </p>
                          <p className="mt-0.5 text-[0.59rem] text-slate-400">
                            {item.source_code}
                          </p>
                        </td>
                        <td>
                          <div className="flex items-center gap-1.5">
                            <span className="text-[0.76rem] font-extrabold text-ink-900">
                              {Math.round(item.score)}%
                            </span>
                            <span
                              className="h-1.5 w-1.5 rounded-full"
                              style={{
                                background: SEVERITY_META[item.severity].color,
                              }}
                            />
                          </div>
                        </td>
                        <td>
                          <span
                            className={clsx(
                              "badge",
                              CASE_STATUS_META[item.status].className,
                            )}
                          >
                            {CASE_STATUS_META[item.status].label}
                          </span>
                        </td>
                        <td>
                          {item.recommendation ? (
                            <span
                              className={clsx(
                                "badge",
                                RECOMMENDATION_META[item.recommendation]
                                  .className,
                              )}
                            >
                              {RECOMMENDATION_META[item.recommendation].label}
                            </span>
                          ) : (
                            <span className="text-[0.64rem] text-slate-400">—</span>
                          )}
                        </td>
                        <td>
                          {item.approval_step ? (
                            <span
                              className={clsx(
                                "badge",
                                APPROVAL_STEP_META[item.approval_step]
                                  .className,
                              )}
                            >
                              {APPROVAL_STEP_META[item.approval_step].short}
                            </span>
                          ) : (
                            <span className="text-[0.64rem] text-slate-400">
                              Belum diajukan
                            </span>
                          )}
                          {item.freeze_status === "ACTIVE_FROZEN" ? (
                            <p className="mt-1 flex items-center gap-1 text-[0.57rem] font-semibold text-red-600">
                              <Snowflake size={9} /> Frozen
                            </p>
                          ) : null}
                        </td>
                        <td className="text-[0.63rem] text-slate-500">
                          {formatDateTimeId(item.opened_at)}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setSelectedCaseId(item.id)}
                          >
                            Workspace <ArrowRight size={12} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState
                icon={<FolderKanban size={22} />}
                title="Tidak ada kasus"
                description="Kasus akan muncul setelah analis membuka investigasi dari hasil screening."
                action={
                  <Link href="/results" className="btn btn-secondary btn-sm">
                    Buka hasil screening <ArrowRight size={12} />
                  </Link>
                }
              />
            )}
          </div>
        ) : null}

        {tab === "approvals" ? (
          <div className="card overflow-hidden">
            <div className="border-b border-line px-4 py-3.5">
              <p className="text-[0.82rem] font-bold text-ink-900">
                Maker-checker approvals
              </p>
              <p className="mt-0.5 text-[0.68rem] text-slate-500">
                Maker mengajukan, Checker memverifikasi, Approver menetapkan
                keputusan final. Maker tidak dapat menyetujui pengajuannya sendiri.
              </p>
            </div>
            {data?.approvals.length ? (
              <div className="divide-y divide-line">
                {data.approvals.map((approval) => {
                  const canDecide =
                    (approval.current_step === "CHECKER_REVIEW" &&
                      user.role_code === "CHECKER_SUPERVISOR" &&
                      user.id === approval.checker_user_id) ||
                    (approval.current_step === "APPROVER_SIGN_OFF" &&
                      user.role_code === "APPROVER_HEAD" &&
                      user.id === approval.approver_user_id);
                  const done =
                    approval.current_step === "COMPLETED" ||
                    approval.current_step === "REJECTED";
                  return (
                    <div
                      key={approval.id}
                      className="flex flex-col gap-3 px-4 py-3.5 lg:flex-row lg:items-center"
                    >
                      <div className="flex min-w-[220px] items-start gap-2.5">
                        <span
                          className={clsx(
                            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                            approval.current_step === "COMPLETED"
                              ? "bg-emerald-50 text-emerald-700"
                              : approval.current_step === "REJECTED"
                                ? "bg-red-50 text-red-700"
                                : "bg-amber-50 text-amber-700",
                          )}
                        >
                          {approval.current_step === "COMPLETED" ? (
                            <CheckCircle2 size={16} />
                          ) : approval.current_step === "REJECTED" ? (
                            <XCircle size={16} />
                          ) : (
                            <Clock3 size={16} />
                          )}
                        </span>
                        <div>
                          <p className="mono text-[0.63rem] text-slate-400">
                            {approval.case_number}
                          </p>
                          <p className="mt-0.5 text-[0.77rem] font-bold text-ink-900">
                            {approval.customer_name}
                          </p>
                          <p className="mt-0.5 text-[0.61rem] text-slate-500">
                            vs {approval.entity_name}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-1 flex-wrap items-center gap-2">
                        <span className="badge badge-neutral">
                          Score {Math.round(approval.score)}%
                        </span>
                        <RiskBadge severity={approval.severity} />
                        {approval.recommendation ? (
                          <span
                            className={clsx(
                              "badge",
                              RECOMMENDATION_META[approval.recommendation]
                                .className,
                            )}
                          >
                            {RECOMMENDATION_META[approval.recommendation].label}
                          </span>
                        ) : null}
                      </div>

                      <div className="flex min-w-[220px] items-center gap-2">
                        {[
                          { label: "Maker", name: approval.maker_name, done: true },
                          {
                            label: "Checker",
                            name: approval.checker_name,
                            done:
                              approval.current_step === "APPROVER_SIGN_OFF" ||
                              approval.current_step === "COMPLETED",
                          },
                          {
                            label: "Approver",
                            name: approval.approver_name,
                            done: approval.current_step === "COMPLETED",
                          },
                        ].map((step) => (
                          <div key={step.label} className="flex-1 text-center">
                            <span
                              className={clsx(
                                "mx-auto flex h-5 w-5 items-center justify-center rounded-full text-[0.48rem] font-bold",
                                step.done
                                  ? "bg-brand-600 text-white"
                                  : "bg-slate-100 text-slate-400",
                              )}
                            >
                              {step.done ? <CheckCircle2 size={10} /> : "•"}
                            </span>
                            <p className="mt-1 text-[0.52rem] font-bold uppercase tracking-wider text-slate-400">
                              {step.label}
                            </p>
                            <p className="max-w-[75px] truncate text-[0.56rem] text-slate-500">
                              {step.name.split(" ")[0]}
                            </p>
                          </div>
                        ))}
                      </div>

                      <div className="flex min-w-[140px] flex-col items-start gap-1">
                        <span
                          className={clsx(
                            "badge",
                            APPROVAL_STEP_META[approval.current_step].className,
                          )}
                        >
                          {APPROVAL_STEP_META[approval.current_step].label}
                        </span>
                        <span className="text-[0.57rem] text-slate-400">
                          {formatDateTimeId(approval.submitted_at)}
                        </span>
                      </div>

                      <button
                        type="button"
                        className={clsx(
                          "btn btn-sm shrink-0",
                          canDecide ? "btn-primary" : "btn-secondary",
                        )}
                        onClick={() => setSelectedApproval(approval)}
                      >
                        {done ? "Lihat" : canDecide ? "Putuskan" : "Tinjau"}
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={<GitBranch size={22} />}
                title="Belum ada approval"
                description="Ajukan kasus dari workspace analis untuk memulai alur maker-checker."
              />
            )}
          </div>
        ) : null}

        {tab === "freeze" ? (
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="card p-3.5">
                <p className="text-[0.6rem] font-bold uppercase tracking-wider text-slate-400">
                  Pemblokiran aktif
                </p>
                <p className="mt-1 text-[1.2rem] font-extrabold text-ink-900">
                  {data?.freezes.filter((item) => item.freeze_status === "ACTIVE_FROZEN").length ?? 0}
                </p>
              </div>
              <div className="card p-3.5">
                <p className="text-[0.6rem] font-bold uppercase tracking-wider text-slate-400">
                  Total saldo dibekukan
                </p>
                <p className="mt-1 text-[1.05rem] font-extrabold text-ink-900">
                  {formatCurrency(
                    data?.freezes
                      .filter((item) => item.freeze_status === "ACTIVE_FROZEN")
                      .reduce((sum, item) => sum + item.total_balance_frozen, 0) ?? 0,
                  )}
                </p>
              </div>
              <div className="card p-3.5">
                <p className="text-[0.6rem] font-bold uppercase tracking-wider text-slate-400">
                  Dasar kewenangan
                </p>
                <p className="mt-1 text-[0.71rem] font-semibold leading-relaxed text-slate-600">
                  UU TPPT No. 9/2013 · POJK 8/2023 · SIPESAT
                </p>
              </div>
            </div>

            <div className="card overflow-hidden">
              <div className="border-b border-line px-4 py-3.5">
                <p className="text-[0.82rem] font-bold text-ink-900">
                  Perintah pemblokiran rekening
                </p>
                <p className="mt-0.5 text-[0.68rem] text-slate-500">
                  Diterbitkan otomatis saat Approver menetapkan Confirmed Hit.
                </p>
              </div>
              {data?.freezes.length ? (
                <div className="overflow-x-auto">
                  <table className="data-table min-w-[980px]">
                    <thead>
                      <tr>
                        <th>Kasus</th>
                        <th>Nasabah</th>
                        <th>Rekening</th>
                        <th>Surat perintah</th>
                        <th>Saldo</th>
                        <th>Status</th>
                        <th>Waktu</th>
                        <th />
                      </tr>
                    </thead>
                    <tbody>
                      {data.freezes.map((freeze) => (
                        <tr key={freeze.id}>
                          <td className="primary-cell mono text-[0.66rem]">
                            {freeze.case_number}
                          </td>
                          <td>
                            <p className="text-[0.72rem] font-semibold text-ink-900">
                              {freeze.customer_name}
                            </p>
                            <p className="mono mt-0.5 text-[0.59rem] text-slate-400">
                              {freeze.cif_number}
                            </p>
                          </td>
                          <td className="mono text-[0.65rem] text-slate-500">
                            {freeze.account_number}
                          </td>
                          <td>
                            <p className="mono max-w-[190px] truncate text-[0.63rem] text-slate-600">
                              {freeze.legal_warrant_number}
                            </p>
                          </td>
                          <td className="text-[0.7rem] font-bold text-ink-900">
                            {formatCurrency(freeze.total_balance_frozen)}
                          </td>
                          <td>
                            <span
                              className={clsx(
                                "badge",
                                freeze.freeze_status === "ACTIVE_FROZEN"
                                  ? "badge-critical"
                                  : "badge-neutral",
                              )}
                            >
                              {freeze.freeze_status === "ACTIVE_FROZEN"
                                ? "Frozen"
                                : "Dicabut"}
                            </span>
                          </td>
                          <td className="text-[0.63rem] text-slate-500">
                            {formatDateTimeId(freeze.frozen_at)}
                          </td>
                          <td>
                            {freeze.freeze_status === "ACTIVE_FROZEN" ? (
                              <button
                                type="button"
                                className="btn btn-secondary btn-sm"
                                onClick={() => setSelectedFreeze(freeze)}
                              >
                                Cabut
                              </button>
                            ) : (
                              <span className="text-[0.62rem] text-slate-400">
                                {freeze.lifted_at
                                  ? formatDateId(freeze.lifted_at)
                                  : "—"}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState
                  icon={<Snowflake size={22} />}
                  title="Tidak ada pemblokiran"
                  description="Perintah pemblokiran akan terbit setelah approval Confirmed Hit."
                />
              )}
            </div>
          </div>
        ) : null}
      </section>

      <CaseWorkspace
        open={Boolean(selectedCaseId)}
        loading={detailLoading}
        detail={detail}
        fallbackCase={selectedCase}
        onClose={() => setSelectedCaseId(null)}
        onChanged={refresh}
      />

      <ApprovalDecisionModal
        approval={selectedApproval}
        onClose={() => setSelectedApproval(null)}
        onChanged={refresh}
      />

      <LiftFreezeModal
        freeze={selectedFreeze}
        onClose={() => setSelectedFreeze(null)}
        onChanged={refresh}
      />
    </div>
  );
}

/* ----------------------------- Case workspace ---------------------------- */

function CaseWorkspace({
  open,
  loading,
  detail,
  fallbackCase,
  onClose,
  onChanged,
}: {
  open: boolean;
  loading: boolean;
  detail: MatchDetail | null;
  fallbackCase: CaseListItem | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { user, apiFetch } = useDemoUser();
  const toast = useToast();
  const [noteType, setNoteType] = useState<NoteType>("INTERNAL_ANALYSIS");
  const [note, setNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [submitReason, setSubmitReason] = useState(
    "Analisis dan kelengkapan bukti telah diverifikasi. Mengajukan keputusan maker-checker.",
  );
  const [submitting, setSubmitting] = useState(false);

  const investigation = detail?.case_detail ?? null;
  const canAddNote = Boolean(
    investigation &&
      investigation.status !== "CLOSED" &&
      user.role_code !== "AUDITOR",
  );
  const canSubmit =
    Boolean(investigation) &&
    investigation?.status !== "CLOSED" &&
    investigation?.status !== "PENDING_APPROVAL" &&
    user.role_code === "MAKER_ANALYST" &&
    investigation?.assigned_analyst_id === user.id;

  async function addNote() {
    if (!investigation) return;
    if (note.trim().length < 5) {
      toast.error("Catatan minimal 5 karakter");
      return;
    }
    setSavingNote(true);
    try {
      await apiFetch(`/api/cases/${investigation.id}/notes`, {
        method: "POST",
        body: JSON.stringify({ content: note.trim(), note_type: noteType }),
      });
      setNote("");
      toast.success("Catatan ditambahkan", "Audit trail kasus diperbarui.");
      onChanged();
    } catch (error) {
      toast.error("Gagal menambahkan catatan", (error as Error).message);
    } finally {
      setSavingNote(false);
    }
  }

  async function submitApproval() {
    if (!investigation) return;
    if (submitReason.trim().length < 10) {
      toast.error("Alasan pengajuan minimal 10 karakter");
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch(`/api/cases/${investigation.id}/submit`, {
        method: "POST",
        body: JSON.stringify({ decision_reason: submitReason.trim() }),
      });
      setSubmitOpen(false);
      toast.success(
        "Approval diajukan",
        "Kasus diteruskan ke Checker / Supervisor.",
      );
      onChanged();
    } catch (error) {
      toast.error("Gagal mengajukan approval", (error as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={
          investigation?.case_number ??
          fallbackCase?.case_number ??
          "Workspace kasus"
        }
        description={
          fallbackCase
            ? `${fallbackCase.customer_name} vs ${fallbackCase.entity_name}`
            : "Investigasi kasus APU-PPT"
        }
        size="full"
        footer={
          <>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Tutup
            </button>
            {canSubmit ? (
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setSubmitOpen(true)}
              >
                <Send size={14} /> Ajukan ke Checker
              </button>
            ) : null}
          </>
        }
      >
        {loading || !detail || !investigation ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full" />
            <div className="grid gap-3 lg:grid-cols-2">
              <Skeleton className="h-72 w-full" />
              <Skeleton className="h-72 w-full" />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 rounded-xl border border-line bg-slate-50/70 p-3.5 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <ScoreRing value={detail.score} size={56} stroke={6} label="Score" />
                <div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span
                      className={clsx(
                        "badge",
                        CASE_STATUS_META[investigation.status].className,
                      )}
                    >
                      {CASE_STATUS_META[investigation.status].label}
                    </span>
                    <RiskBadge
                      severity={detail.severity}
                      whitelisted={detail.is_whitelisted}
                      exact={detail.is_exact_identity_match}
                    />
                    {investigation.priority === "HIGH" ? (
                      <span className="badge badge-critical">Prioritas tinggi</span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-[0.8rem] font-bold text-ink-900">
                    {detail.customer.full_name}{" "}
                    <span className="font-normal text-slate-400">vs</span>{" "}
                    {detail.entity.primary_name}
                  </p>
                  <p className="mt-0.5 text-[0.63rem] text-slate-500">
                    Dibuka {formatDateTimeId(investigation.opened_at)} ·{" "}
                    {investigation.notes.length} catatan ·{" "}
                    {investigation.evidence.length} bukti
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {investigation.recommendation ? (
                  <span
                    className={clsx(
                      "badge",
                      RECOMMENDATION_META[investigation.recommendation].className,
                    )}
                  >
                    {RECOMMENDATION_META[investigation.recommendation].label}
                  </span>
                ) : null}
                {investigation.freeze ? (
                  <span className="badge badge-critical">
                    <Snowflake size={10} /> Rekening frozen
                  </span>
                ) : null}
              </div>
            </div>

            <div className="grid gap-3 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-3">
                <section className="rounded-xl border border-line p-3.5">
                  <div className="flex items-center justify-between">
                    <p className="text-[0.78rem] font-bold text-ink-900">
                      Profil perbandingan
                    </p>
                    <Link
                      href={`/results?match=${detail.id}`}
                      className="btn btn-ghost btn-sm"
                    >
                      Comparator <ExternalLink size={11} />
                    </Link>
                  </div>
                  <div className="mt-2.5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-lg border border-line bg-slate-50/60 p-2.5">
                      <p className="text-[0.56rem] font-bold uppercase tracking-wider text-slate-400">
                        Nasabah
                      </p>
                      <p className="mt-0.5 text-[0.74rem] font-bold text-ink-900">
                        {detail.customer.full_name}
                      </p>
                      <p className="mono mt-0.5 text-[0.6rem] text-slate-500">
                        {detail.customer.cif_number} ·{" "}
                        {detail.customer.national_id_masked}
                      </p>
                      <p className="mt-1 text-[0.61rem] text-slate-500">
                        {formatDateId(detail.customer.date_of_birth)} ·{" "}
                        {detail.customer.place_of_birth}
                      </p>
                    </div>
                    <div className="rounded-lg border border-line bg-slate-50/60 p-2.5">
                      <p className="text-[0.56rem] font-bold uppercase tracking-wider text-slate-400">
                        Entitas watchlist
                      </p>
                      <p className="mt-0.5 text-[0.74rem] font-bold text-ink-900">
                        {detail.entity.primary_name}
                      </p>
                      <p className="mt-0.5 text-[0.6rem] text-slate-500">
                        {detail.source.code} · {detail.source.published_by}
                      </p>
                      <p className="mt-1 text-[0.61rem] text-slate-500">
                        {formatDateId(detail.entity.date_of_birth)} ·{" "}
                        {detail.entity.place_of_birth}
                      </p>
                    </div>
                  </div>
                  <div className="mt-2.5">
                    <p className="text-[0.57rem] font-bold uppercase tracking-wider text-slate-400">
                      Dasar hukum
                    </p>
                    <p className="mt-0.5 text-[0.67rem] leading-relaxed text-slate-600">
                      {detail.entity.legal_reference ?? "—"}
                    </p>
                  </div>
                </section>

                <section className="rounded-xl border border-line p-3.5">
                  <div className="flex items-center justify-between">
                    <p className="flex items-center gap-1.5 text-[0.78rem] font-bold text-ink-900">
                      <MessageSquare size={14} /> Catatan investigasi
                    </p>
                    <span className="badge badge-neutral">
                      {investigation.notes.length}
                    </span>
                  </div>

                  {canAddNote ? (
                    <div className="mt-2.5 rounded-lg border border-line bg-slate-50/60 p-2.5">
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <select
                          className="select h-8 w-auto min-w-[145px] py-1 text-[0.68rem]"
                          value={noteType}
                          onChange={(event) =>
                            setNoteType(event.target.value as NoteType)
                          }
                        >
                          {Object.entries(NOTE_TYPE_LABELS).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                        <textarea
                          className="textarea min-h-[58px] flex-1 text-[0.72rem]"
                          value={note}
                          onChange={(event) => setNote(event.target.value)}
                          placeholder="Tambahkan hasil analisis atau verifikasi..."
                        />
                      </div>
                      <div className="mt-1.5 flex justify-end">
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={addNote}
                          disabled={savingNote}
                        >
                          {savingNote ? (
                            <RefreshCw size={12} className="animate-spin" />
                          ) : (
                            <Send size={12} />
                          )}
                          Simpan catatan
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p className="mt-2 text-[0.65rem] text-slate-400">
                      {investigation.status === "CLOSED"
                        ? "Kasus selesai — catatan bersifat read-only."
                        : "Persona auditor tidak dapat menambah catatan."}
                    </p>
                  )}

                  <div className="mt-3 space-y-3">
                    {investigation.notes.map((item, index) => (
                      <div key={item.id} className="flex items-start gap-2.5">
                        <span
                          className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[0.48rem] font-bold text-white"
                          style={{
                            background:
                              index === 0 ? "#0f766e" : "#94a3b8",
                          }}
                        >
                          {getInitials(item.author_name)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <p className="text-[0.66rem] font-bold text-ink-800">
                              {item.author_name}
                            </p>
                            <span className="badge badge-neutral !px-1.5 !py-0 text-[0.53rem]">
                              {NOTE_TYPE_LABELS[item.note_type]}
                            </span>
                            <span className="text-[0.56rem] text-slate-400">
                              {formatDateTimeId(item.created_at)}
                            </span>
                          </div>
                          <p className="mt-1 text-[0.66rem] leading-relaxed text-slate-600">
                            {item.note_content}
                          </p>
                        </div>
                      </div>
                    ))}
                    {!investigation.notes.length ? (
                      <p className="text-[0.65rem] text-slate-400">
                        Belum ada catatan investigasi.
                      </p>
                    ) : null}
                  </div>
                </section>

                <section className="rounded-xl border border-line p-3.5">
                  <div className="flex items-center justify-between">
                    <p className="flex items-center gap-1.5 text-[0.78rem] font-bold text-ink-900">
                      <FileCheck2 size={14} /> Bukti pendukung
                    </p>
                    <span className="badge badge-neutral">
                      {investigation.evidence.length} file
                    </span>
                  </div>
                  <div className="mt-2 grid gap-1.5 sm:grid-cols-2">
                    {investigation.evidence.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center gap-2 rounded-lg border border-line px-2.5 py-2"
                      >
                        <FileText size={15} className="shrink-0 text-slate-400" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[0.64rem] font-semibold text-ink-800">
                            {file.file_name}
                          </p>
                          <p className="text-[0.55rem] text-slate-400">
                            {file.file_type} ·{" "}
                            {(file.file_size_bytes / 1024).toFixed(0)} KB
                          </p>
                        </div>
                        <LockKeyhole size={11} className="text-slate-300" />
                      </div>
                    ))}
                    {!investigation.evidence.length ? (
                      <p className="text-[0.65rem] text-slate-400">
                        Belum ada file bukti.
                      </p>
                    ) : null}
                  </div>
                </section>
              </div>

              <div className="space-y-3">
                <section className="rounded-xl border border-line p-3.5">
                  <p className="text-[0.78rem] font-bold text-ink-900">
                    Four-eyes approval
                  </p>
                  <div className="mt-3 space-y-3">
                    {[
                      {
                        label: "Maker / Analis",
                        name:
                          investigation.approval?.maker_name ??
                          (user.role_code === "MAKER_ANALYST"
                            ? user.full_name
                            : "Belum diajukan"),
                        done: true,
                        current: false,
                      },
                      {
                        label: "Checker / Supervisor",
                        name: investigation.approval?.checker_name ?? "Menunggu",
                        done:
                          investigation.approval?.current_step ===
                            "APPROVER_SIGN_OFF" ||
                          investigation.approval?.current_step === "COMPLETED",
                        current:
                          investigation.approval?.current_step ===
                          "CHECKER_REVIEW",
                      },
                      {
                        label: "Approver / Compliance Head",
                        name: investigation.approval?.approver_name ?? "Menunggu",
                        done:
                          investigation.approval?.current_step === "COMPLETED",
                        current:
                          investigation.approval?.current_step ===
                          "APPROVER_SIGN_OFF",
                      },
                    ].map((step) => (
                      <div key={step.label} className="flex items-start gap-2.5">
                        <span
                          className={clsx(
                            "step-dot",
                            step.done
                              ? "bg-emerald-600 text-white"
                              : step.current
                                ? "bg-amber-500 text-white"
                                : "bg-slate-100 text-slate-400",
                          )}
                        >
                          {step.done ? (
                            <CheckCircle2 size={11} />
                          ) : step.current ? (
                            <Clock3 size={11} />
                          ) : (
                            "•"
                          )}
                        </span>
                        <div>
                          <p className="text-[0.66rem] font-bold text-ink-800">
                            {step.label}
                          </p>
                          <p className="mt-0.5 text-[0.6rem] text-slate-500">
                            {step.name}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {investigation.approval ? (
                    <div className="mt-3 rounded-lg bg-slate-50 px-2.5 py-2">
                      <p className="text-[0.56rem] font-bold uppercase tracking-wider text-slate-400">
                        Tahap saat ini
                      </p>
                      <span
                        className={clsx(
                          "badge mt-1",
                          APPROVAL_STEP_META[investigation.approval.current_step]
                            .className,
                        )}
                      >
                        {APPROVAL_STEP_META[investigation.approval.current_step].label}
                      </span>
                      {investigation.approval.decision_reason ? (
                        <p className="mt-1.5 text-[0.6rem] leading-relaxed text-slate-500">
                          {investigation.approval.decision_reason}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  {user.role_code !== "MAKER_ANALYST" && canSubmit ? null : null}
                </section>

                <section className="rounded-xl border border-line p-3.5">
                  <p className="flex items-center gap-1.5 text-[0.78rem] font-bold text-ink-900">
                    <Scale size={14} /> Tindakan & kepatuhan
                  </p>
                  <div className="mt-2.5 space-y-2 text-[0.65rem]">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Rekomendasi</span>
                      <span className="font-semibold text-ink-800">
                        {investigation.recommendation
                          ? RECOMMENDATION_META[investigation.recommendation].label
                          : "—"}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Dibuka</span>
                      <span className="font-semibold text-ink-800">
                        {formatDateId(investigation.opened_at)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-500">Ditutup</span>
                      <span className="font-semibold text-ink-800">
                        {investigation.closed_at
                          ? formatDateId(investigation.closed_at)
                          : "—"}
                      </span>
                    </div>
                  </div>
                  {investigation.freeze ? (
                    <div className="mt-3 rounded-lg border border-red-200 bg-red-50 px-2.5 py-2">
                      <p className="flex items-center gap-1.5 text-[0.64rem] font-bold text-red-800">
                        <Snowflake size={12} /> Rekening diblokir
                      </p>
                      <p className="mt-0.5 text-[0.59rem] text-red-700">
                        {investigation.freeze.legal_warrant_number}
                      </p>
                      <p className="mt-0.5 text-[0.59rem] text-red-700">
                        Saldo:{" "}
                        {formatCurrency(investigation.freeze.total_balance_frozen)}
                      </p>
                    </div>
                  ) : null}
                  {investigation.reports.length ? (
                    <div className="mt-3">
                      <p className="text-[0.56rem] font-bold uppercase tracking-wider text-slate-400">
                        Laporan terkait
                      </p>
                      {investigation.reports.map((report) => (
                        <div
                          key={report.id}
                          className="mt-1 flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-2 py-1.5"
                        >
                          <span className="mono text-[0.58rem] text-slate-500">
                            {report.reference_number}
                          </span>
                          <span className="badge badge-neutral">
                            {report.submission_status}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : null}
                </section>

                {canSubmit ? (
                  <button
                    type="button"
                    className="btn btn-primary w-full"
                    onClick={() => setSubmitOpen(true)}
                  >
                    <Send size={14} /> Ajukan ke Checker
                  </button>
                ) : investigation.status === "PENDING_APPROVAL" ? (
                  <Alert
                    variant="info"
                    icon={<Clock3 size={15} />}
                    title="Menunggu keputusan"
                  >
                    Kasus sedang ditinjau{" "}
                    {investigation.approval?.current_step === "CHECKER_REVIEW"
                      ? "Checker"
                      : "Approver"}
                    . Gunakan tab Approval untuk memproses.
                  </Alert>
                ) : investigation.status === "CLOSED" ? (
                  <Alert
                    variant="success"
                    icon={<CheckCircle2 size={15} />}
                    title="Kasus selesai"
                  >
                    Verdict:{" "}
                    {investigation.approval?.final_verdict ??
                      "tidak ada verdict final"}
                    .
                  </Alert>
                ) : null}
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal
        open={submitOpen}
        onClose={() => setSubmitOpen(false)}
        title="Ajukan approval maker-checker"
        description={
          investigation
            ? `${investigation.case_number} akan diteruskan ke Checker / Supervisor.`
            : undefined
        }
        size="md"
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setSubmitOpen(false)}
            >
              Batal
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={submitApproval}
              disabled={submitting}
            >
              {submitting ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <Send size={14} />
              )}
              Kirim pengajuan
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <Alert variant="info" icon={<ShieldCheck size={15} />}>
            Pastikan seluruh bukti dan catatan telah lengkap. Setelah diajukan,
            rekomendasi tidak dapat diubah sampai proses approval selesai atau
            ditolak.
          </Alert>
          <div>
            <label className="field-label">Catatan pengajuan *</label>
            <textarea
              className="textarea"
              value={submitReason}
              onChange={(event) => setSubmitReason(event.target.value)}
            />
          </div>
          <div className="rounded-lg border border-line bg-slate-50 px-3 py-2.5 text-[0.65rem] text-slate-500">
            <p>
              <strong className="text-ink-800">Rekomendasi:</strong>{" "}
              {investigation?.recommendation
                ? RECOMMENDATION_META[investigation.recommendation].label
                : "—"}
            </p>
            <p className="mt-1">
              <strong className="text-ink-800">Checker:</strong>{" "}
              {investigation?.approval?.checker_name ??
                "Supervisor aktif akan ditugaskan"}
            </p>
          </div>
        </div>
      </Modal>
    </>
  );
}

/* --------------------------- Approval decision --------------------------- */

function ApprovalDecisionModal({
  approval,
  onClose,
  onChanged,
}: {
  approval: ApprovalListItem | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { user, apiFetch } = useDemoUser();
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [action, setAction] = useState<"APPROVE" | "REJECT">("APPROVE");
  const [warrant, setWarrant] = useState("");
  const [balance, setBalance] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (approval) {
      setReason("");
      setAction("APPROVE");
      setWarrant("");
      setBalance("");
    }
  }, [approval]);

  if (!approval) {
    return (
      <Modal
        open={false}
        onClose={onClose}
        title=""
      >
        <div />
      </Modal>
    );
  }

  const isCheckerStep = approval.current_step === "CHECKER_REVIEW";
  const isApproverStep = approval.current_step === "APPROVER_SIGN_OFF";
  const terminal =
    approval.current_step === "COMPLETED" || approval.current_step === "REJECTED";
  const isMaker = user.id === approval.maker_user_id;
  const canAct = isCheckerStep
    ? user.role_code === "CHECKER_SUPERVISOR" &&
      user.id === approval.checker_user_id &&
      !isMaker
    : isApproverStep
      ? user.role_code === "APPROVER_HEAD" &&
        user.id === approval.approver_user_id &&
        !isMaker
      : false;
  const expectedRole = isCheckerStep
    ? "Checker / Supervisor"
    : isApproverStep
      ? "Approver / Compliance Head"
      : "—";
  const confirmedFlow =
    isApproverStep &&
    (approval.recommendation === "CONFIRM_HIT" ||
      approval.recommendation === "ESCALATE_EDD");

  async function submit() {
    if (reason.trim().length < 10) {
      toast.error("Alasan keputusan minimal 10 karakter");
      return;
    }
    setSubmitting(true);
    try {
      const payload = await apiFetch<{ message: string }>(
        `/api/approvals/${approval!.id}/decision`,
        {
          method: "POST",
          body: JSON.stringify({
            action,
            decision_reason: reason.trim(),
            legal_warrant_number: warrant.trim(),
            total_balance_frozen: balance ? Number(balance) : 0,
          }),
        },
      );
      toast.success("Keputusan tersimpan", payload.message);
      onChanged();
      onClose();
    } catch (error) {
      toast.error("Gagal memproses keputusan", (error as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={
        terminal
          ? "Detail approval"
          : isCheckerStep
            ? "Keputusan Checker"
            : "Keputusan Approver"
      }
      description={`${approval.case_number} · ${approval.customer_name} vs ${approval.entity_name}`}
      size="lg"
      footer={
        terminal ? (
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Tutup
          </button>
        ) : canAct ? (
          <>
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Batal
            </button>
            <button
              type="button"
              className={clsx(
                "btn",
                action === "REJECT" ? "btn-danger" : "btn-primary",
              )}
              onClick={submit}
              disabled={submitting}
            >
              {submitting ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : action === "REJECT" ? (
                <XCircle size={14} />
              ) : (
                <CheckCircle2 size={14} />
              )}
              {action === "REJECT"
                ? "Tolak pengajuan"
                : isApproverStep
                  ? "Setujui keputusan final"
                  : "Setujui & teruskan"}
            </button>
          </>
        ) : (
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Tutup
          </button>
        )
      }
    >
      <div className="space-y-4">
        <div className="grid gap-2 sm:grid-cols-3">
          {[
            {
              label: "Skor",
              value: `${Math.round(approval.score)}%`,
              color: SEVERITY_META[approval.severity].color,
            },
            {
              label: "Rekomendasi",
              value: approval.recommendation
                ? RECOMMENDATION_META[approval.recommendation].label
                : "—",
              color: "#0b263a",
            },
            {
              label: "Tahap",
              value: APPROVAL_STEP_META[approval.current_step].label,
              color: "#946b06",
            },
          ].map((item) => (
            <div
              key={item.label}
              className="rounded-lg border border-line bg-slate-50 px-3 py-2.5"
            >
              <p className="text-[0.56rem] font-bold uppercase tracking-wider text-slate-400">
                {item.label}
              </p>
              <p
                className="mt-0.5 text-[0.72rem] font-bold"
                style={{ color: item.color }}
              >
                {item.value}
              </p>
            </div>
          ))}
        </div>

        <div className="relative flex items-start justify-between gap-1 rounded-xl border border-line p-3">
          {[
            {
              label: "Maker",
              name: approval.maker_name,
              done: true,
              active: false,
            },
            {
              label: "Checker",
              name: approval.checker_name,
              done:
                approval.current_step === "APPROVER_SIGN_OFF" ||
                approval.current_step === "COMPLETED",
              active: approval.current_step === "CHECKER_REVIEW",
            },
            {
              label: "Approver",
              name: approval.approver_name,
              done: approval.current_step === "COMPLETED",
              active: approval.current_step === "APPROVER_SIGN_OFF",
            },
          ].map((step, index) => (
            <div key={step.label} className="relative z-10 flex flex-1 flex-col items-center">
              <span
                className={clsx(
                  "flex h-7 w-7 items-center justify-center rounded-full text-[0.6rem] font-bold",
                  step.done
                    ? "bg-emerald-600 text-white"
                    : step.active
                      ? "border-2 border-amber-500 bg-white text-amber-700"
                      : "bg-slate-100 text-slate-400",
                )}
              >
                {step.done ? <CheckCircle2 size={13} /> : index + 1}
              </span>
              <p className="mt-1 text-[0.62rem] font-bold text-ink-800">
                {step.label}
              </p>
              <p className="max-w-[100px] truncate text-[0.58rem] text-slate-400">
                {step.name}
              </p>
            </div>
          ))}
          <div className="absolute left-[16%] right-[16%] top-[26px] h-px bg-line" />
        </div>

        {terminal ? (
          <Alert
            variant={
              approval.current_step === "COMPLETED" && approval.final_verdict
                ? "success"
                : "warning"
            }
            icon={<ShieldCheck size={15} />}
            title={APPROVAL_STEP_META[approval.current_step].label}
          >
            {approval.decision_reason || "Tidak ada catatan keputusan."}
          </Alert>
        ) : isMaker ? (
          <Alert
            variant="danger"
            icon={<ShieldAlert size={16} />}
            title="Four-eyes principle"
          >
            Anda adalah maker pengaju kasus ini. Maker tidak dapat menyetujui
            pengajuannya sendiri. Beralih ke persona Checker/Approver.
          </Alert>
        ) : !canAct ? (
          <Alert
            variant="warning"
            icon={<UsersRound size={16} />}
            title={`Membutuhkan persona ${expectedRole}`}
          >
            Persona aktif adalah <strong>{ROLE_META[user.role_code].label}</strong>.
            Beralih melalui menu profil untuk memproses tahap ini. Approver yang
            ditunjuk: <strong>{approval.approver_name}</strong>.
          </Alert>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              {(["APPROVE", "REJECT"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setAction(value)}
                  className={clsx(
                    "rounded-xl border px-3 py-2.5 text-left transition",
                    action === value
                      ? value === "APPROVE"
                        ? "border-emerald-300 bg-emerald-50"
                        : "border-red-300 bg-red-50"
                      : "border-line bg-white hover:bg-slate-50",
                  )}
                >
                  <p
                    className={clsx(
                      "text-[0.72rem] font-bold",
                      value === "APPROVE"
                        ? "text-emerald-800"
                        : "text-red-800",
                    )}
                  >
                    {value === "APPROVE"
                      ? isCheckerStep
                        ? "Setujui & teruskan ke Approver"
                        : "Setujui keputusan final"
                      : "Tolak & kembalikan ke analis"}
                  </p>
                  <p className="mt-0.5 text-[0.61rem] text-slate-500">
                    {value === "APPROVE"
                      ? isCheckerStep
                        ? "Kelengkapan bukti dinyatakan sesuai."
                        : confirmedFlow
                          ? "Akan menerbitkan perintah pemblokiran rekening."
                          : "Kasus akan ditutup sebagai false positive."
                      : "Kasus kembali ke tahap analisis."}
                  </p>
                </button>
              ))}
            </div>

            {confirmedFlow && action === "APPROVE" ? (
              <div className="grid gap-3 rounded-xl border border-red-200 bg-red-50/50 p-3 sm:grid-cols-2">
                <div>
                  <label className="field-label">Nomor surat perintah</label>
                  <input
                    className="input"
                    value={warrant}
                    onChange={(event) => setWarrant(event.target.value)}
                    placeholder="SPRIN/…/2026/DITTIP"
                  />
                  <p className="mt-1 text-[0.58rem] text-slate-400">
                    Opsional — nomor otomatis jika kosong.
                  </p>
                </div>
                <div>
                  <label className="field-label">Saldo dibekukan (IDR)</label>
                  <input
                    type="number"
                    min={0}
                    className="input"
                    value={balance}
                    onChange={(event) => setBalance(event.target.value)}
                    placeholder="875000000"
                  />
                  <p className="mt-1 text-[0.58rem] text-slate-400">
                    Akan dicatat pada perintah pemblokiran.
                  </p>
                </div>
              </div>
            ) : null}

            <div>
              <label className="field-label">Alasan keputusan *</label>
              <textarea
                className="textarea"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                placeholder={
                  action === "APPROVE"
                    ? "Jelaskan dasar persetujuan dan kelengkapan bukti..."
                    : "Jelaskan alasan penolakan dan perbaikan yang diperlukan..."
                }
              />
            </div>

            {confirmedFlow && action === "APPROVE" ? (
              <Alert
                variant="danger"
                icon={<Snowflake size={16} />}
                title="Protokol pembekuan seketika"
              >
                Keputusan Confirmed Hit akan menerbitkan perintah Hold/Freeze
                pada rekening nasabah serta mencatatnya di audit trail. Pastikan
                dasar hukum dan saldo telah diverifikasi.
              </Alert>
            ) : null}
          </>
        )}
      </div>
    </Modal>
  );
}

/* ------------------------------- Lift freeze ------------------------------ */

function LiftFreezeModal({
  freeze,
  onClose,
  onChanged,
}: {
  freeze: FreezeView | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { user, apiFetch } = useDemoUser();
  const toast = useToast();
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (freeze) setReason("");
  }, [freeze]);

  async function submit() {
    if (!freeze) return;
    if (reason.trim().length < 10) {
      toast.error("Alasan pencabutan minimal 10 karakter");
      return;
    }
    setSubmitting(true);
    try {
      const payload = await apiFetch<{ message: string }>(
        `/api/freeze/${freeze.id}/lift`,
        {
          method: "POST",
          body: JSON.stringify({ reason: reason.trim() }),
        },
      );
      toast.success("Pemblokiran dicabut", payload.message);
      onChanged();
      onClose();
    } catch (error) {
      toast.error("Gagal mencabut pemblokiran", (error as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal
      open={Boolean(freeze)}
      onClose={onClose}
      title="Cabut pemblokiran rekening"
      description={freeze ? `${freeze.case_number} · ${freeze.customer_name}` : undefined}
      size="md"
      footer={
        <>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Batal
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={submit}
            disabled={
              submitting ||
              user.role_code !== "APPROVER_HEAD" ||
              !freeze
            }
          >
            {submitting ? (
              <RefreshCw size={14} className="animate-spin" />
            ) : (
              <Snowflake size={14} />
            )}
            Cabut pemblokiran
          </button>
        </>
      }
    >
      {freeze ? (
        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2">
            <div className="rounded-lg border border-line bg-slate-50 px-3 py-2">
              <p className="text-[0.56rem] font-bold uppercase tracking-wider text-slate-400">
                Rekening
              </p>
              <p className="mono mt-0.5 text-[0.7rem] font-bold text-ink-900">
                {freeze.account_number}
              </p>
            </div>
            <div className="rounded-lg border border-line bg-slate-50 px-3 py-2">
              <p className="text-[0.56rem] font-bold uppercase tracking-wider text-slate-400">
                Saldo diblokir
              </p>
              <p className="mt-0.5 text-[0.7rem] font-bold text-ink-900">
                {formatCurrency(freeze.total_balance_frozen)}
              </p>
            </div>
          </div>
          {user.role_code !== "APPROVER_HEAD" ? (
            <Alert variant="warning" icon={<UsersRound size={15} />}>
              Hanya Approver / Compliance Head yang dapat mencabut pemblokiran.
            </Alert>
          ) : null}
          <div>
            <label className="field-label">Alasan pencabutan *</label>
            <textarea
              className="textarea"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="Contoh: pencabutan berdasarkan surat keputusan pengadilan / hasil verifikasi ulang..."
            />
          </div>
          <Alert variant="danger" icon={<AlertTriangle size={15} />}>
            Tindakan ini akan mengubah status menjadi LIFTED dan tercatat permanen
            pada audit trail.
          </Alert>
        </div>
      ) : null}
    </Modal>
  );
}
