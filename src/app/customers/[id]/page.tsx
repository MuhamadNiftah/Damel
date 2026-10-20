"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  BadgeCheck,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CircleDollarSign,
  Clock3,
  Eye,
  EyeOff,
  Fingerprint,
  GitCompareArrows,
  Landmark,
  MapPin,
  Pencil,
  ShieldAlert,
  ShieldCheck,
  UserRound,
  WalletCards,
} from "lucide-react";
import type {
  CustomerDetail,
  CustomerProfileStatus,
  CustomerRiskRating,
  EmploymentStatus,
} from "@/lib/types";
import { useDemoUser } from "@/components/user-provider";
import { useToast } from "@/components/toast-provider";
import {
  EmptyState,
  Field,
  MetricCard,
  Modal,
  Skeleton,
  Tabs,
} from "@/components/ui";
import { QualityBadge, QualityPanel } from "@/components/quality";
import {
  formatCurrency,
  formatDateId,
  formatDateTimeId,
} from "@/lib/normalize";
import { clsx, SEVERITY_META } from "@/lib/ui";

const RISK_META = {
  LOW: { label: "Risiko rendah", className: "badge-clean" },
  MEDIUM: { label: "Risiko sedang", className: "badge-medium" },
  HIGH: { label: "Risiko tinggi", className: "badge-critical" },
} as const;

const STATUS_META = {
  ACTIVE: { label: "Aktif", className: "badge-clean" },
  DORMANT: { label: "Dormant", className: "badge-neutral" },
  CLOSED: { label: "Tutup", className: "badge-neutral" },
} as const;

const EMPLOYMENT_LABELS: Record<EmploymentStatus, string> = {
  PERMANENT: "Karyawan tetap",
  CONTRACT: "Kontrak",
  SELF_EMPLOYED: "Wirausaha",
  RETIRED: "Pensiunan",
};

const TRANSACTION_LABELS: Record<string, string> = {
  BUY: "Pembelian",
  SELL: "Penjualan",
  DEPOSIT: "Setoran",
  WITHDRAWAL: "Penarikan",
  TRANSFER: "Transfer",
};

type TabKey = "profil" | "pekerjaan" | "transaksi" | "matching";

interface EditForm {
  full_name: string;
  occupation: string;
  employer_name: string;
  employment_status: EmploymentStatus;
  risk_rating: CustomerRiskRating;
  profile_status: CustomerProfileStatus;
  branch_code: string;
  monthly_income: string;
  source_of_fund: string;
  address: string;
  place_of_birth: string;
  nationality: string;
  date_of_birth: string;
  passport_number: string;
}

export default function CustomerProfilePage() {
  const params = useParams<{ id: string }>();
  const id = params?.id ?? "";
  const { apiFetch, user } = useDemoUser();
  const toast = useToast();
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("profil");
  const [showNik, setShowNik] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [form, setForm] = useState<EditForm | null>(null);
  const [saving, setSaving] = useState(false);

  const canEdit = user.role_code === "MAKER_ANALYST" || user.role_code === "ADMIN";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const payload = await apiFetch<{ customer: CustomerDetail }>(
        `/api/customers/${encodeURIComponent(id)}`,
      );
      setCustomer(payload.customer);
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, id]);

  useEffect(() => {
    if (id) void load();
  }, [id, load]);

  const riskMeta = customer ? RISK_META[customer.risk_rating] : null;
  const statusMeta = customer ? STATUS_META[customer.profile_status] : null;

  const tabs = useMemo(
    () => [
      { value: "profil" as const, label: "Profil & identitas" },
      { value: "pekerjaan" as const, label: "Riwayat kepegawaian", count: customer?.employment_history.length },
      { value: "transaksi" as const, label: "Transaksi", count: customer?.transaction_count },
      { value: "matching" as const, label: "Hasil matching", count: customer?.matches.length },
    ],
    [customer],
  );

  function openEdit() {
    if (!customer) return;
    setForm({
      full_name: customer.full_name,
      occupation: customer.occupation,
      employer_name: customer.employer_name,
      employment_status: customer.employment_status ?? "PERMANENT",
      risk_rating: customer.risk_rating,
      profile_status: customer.profile_status,
      branch_code: customer.branch_code,
      monthly_income: String(customer.monthly_income),
      source_of_fund: customer.source_of_fund === "—" ? "" : customer.source_of_fund,
      address: customer.address,
      place_of_birth: customer.place_of_birth,
      nationality: customer.nationality,
      date_of_birth: customer.date_of_birth,
      passport_number: customer.passport_number === "—" ? "" : customer.passport_number,
    });
    setEditOpen(true);
  }

  async function saveProfile() {
    if (!form || !customer) return;
    setSaving(true);
    try {
      const payload = await apiFetch<{ customer: CustomerDetail }>(
        `/api/customers/${customer.id}`,
        {
          method: "PATCH",
          body: JSON.stringify({
            ...form,
            monthly_income: Number(form.monthly_income) || 0,
          }),
        },
      );
      setCustomer(payload.customer);
      setEditOpen(false);
      toast.success("Profil diperbarui", "Perubahan tercatat pada log system (WORM).");
    } catch (saveError) {
      toast.error("Gagal menyimpan", (saveError as Error).message);
    } finally {
      setSaving(false);
    }
  }

  if (loading && !customer) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-24 w-full" />
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
          <Skeleton className="h-[420px] w-full" />
          <Skeleton className="h-[420px] w-full" />
        </div>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="card">
        <EmptyState
          icon={<UserRound size={22} />}
          title="Profil nasabah tidak dapat dimuat"
          description={error ?? "Nasabah tidak ditemukan."}
          action={
            <Link href="/customers" className="btn btn-secondary btn-sm">
              <ArrowLeft size={14} /> Kembali ke data nasabah
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link
            href="/customers"
            className="inline-flex items-center gap-1 text-[0.68rem] font-semibold text-slate-500 hover:text-brand-700"
          >
            <ArrowLeft size={13} /> Data Nasabah
          </Link>
          <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
            <h1 className="text-[1.35rem] font-extrabold tracking-tight text-ink-900 sm:text-[1.55rem]">
              {customer.full_name}
            </h1>
            <QualityBadge quality={customer.quality} />
            {riskMeta ? (
              <span className={clsx("badge", riskMeta.className)}>
                <span className="badge-dot" /> {riskMeta.label}
              </span>
            ) : null}
            {statusMeta ? (
              <span className={clsx("badge", statusMeta.className)}>{statusMeta.label}</span>
            ) : null}
          </div>
          <p className="mt-1 text-[0.74rem] text-slate-500">
            <span className="mono">{customer.cif_number}</span> ·{" "}
            {customer.customer_type === "CORPORATE" ? "Korporasi" : "Individu"} ·{" "}
            {customer.occupation} di {customer.employer_name}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/results?q=${encodeURIComponent(customer.full_name)}`}
            className="btn btn-secondary btn-sm"
          >
            <GitCompareArrows size={14} /> Hasil screening
          </Link>
          {canEdit ? (
            <button type="button" className="btn btn-primary btn-sm" onClick={openEdit}>
              <Pencil size={14} /> Edit profil
            </button>
          ) : (
            <span className="badge badge-neutral">
              <ShieldCheck size={12} /> Mode baca
            </span>
          )}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total nilai transaksi"
          value={formatCurrency(customer.total_transaction_value)}
          sub={`${customer.transaction_count} transaksi tercatat`}
          icon={<WalletCards size={17} />}
          tone="brand"
        />
        <MetricCard
          label="Rata-rata transaksi"
          value={formatCurrency(customer.average_transaction_value)}
          sub={`Transaksi terakhir ${
            customer.last_transaction_at
              ? formatDateId(customer.last_transaction_at)
              : "belum tersedia"
          }`}
          icon={<CircleDollarSign size={17} />}
          tone="clean"
          delay="stagger-1"
        />
        <MetricCard
          label="Temuan matching"
          value={customer.match_count}
          sub={`${customer.open_case_count} kasus investigasi aktif`}
          icon={<ShieldAlert size={17} />}
          tone={customer.highest_severity === "CRITICAL" ? "critical" : "medium"}
          delay="stagger-2"
        />
        <MetricCard
          label="Kualitas data"
          value={`${customer.quality.score}/100`}
          sub={`Grade ${customer.quality.grade} · ${customer.quality.label}`}
          icon={<BadgeCheck size={17} />}
          tone="violet"
          delay="stagger-3"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_370px]">
        <div className="space-y-4">
          <div className="card overflow-hidden">
            <div className="border-b border-line px-4 pt-3.5">
              <Tabs tabs={tabs} value={tab} onChange={setTab} />
            </div>

            <div className="p-4">
              {tab === "profil" ? (
                <div className="space-y-5">
                  <div>
                    <p className="mb-2.5 flex items-center gap-1.5 text-[0.66rem] font-bold uppercase tracking-[0.1em] text-slate-400">
                      <Fingerprint size={13} /> Identitas & kontak
                    </p>
                    <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                      <Field label="NIK" value={
                        showNik ? (
                          <span className="mono">{customer.national_id_number}</span>
                        ) : (
                          <span className="mono">{customer.national_id_masked}</span>
                        )
                      } />
                      <Field label="Paspor" value={customer.passport_number} mono />
                      <Field label="Tanggal lahir" value={formatDateId(customer.date_of_birth)} />
                      <Field label="Tempat lahir" value={customer.place_of_birth} />
                      <Field label="Kewarganegaraan" value={customer.nationality} />
                      <Field label="Nomor rekening" value={customer.account_number_masked} mono />
                      <div className="sm:col-span-2 lg:col-span-3">
                        <Field label="Alamat" value={customer.address} />
                      </div>
                    </div>
                    <button
                      type="button"
                      className="mt-2 inline-flex items-center gap-1 text-[0.65rem] font-semibold text-brand-700 hover:underline"
                      onClick={() => setShowNik((current) => !current)}
                    >
                      {showNik ? <EyeOff size={12} /> : <Eye size={12} />}
                      {showNik ? "Sembunyikan NIK" : "Tampilkan NIK lengkap"}
                    </button>
                  </div>

                  <div className="divider" />

                  <div>
                    <p className="mb-2.5 flex items-center gap-1.5 text-[0.66rem] font-bold uppercase tracking-[0.1em] text-slate-400">
                      <BriefcaseBusiness size={13} /> Pekerjaan & keuangan
                    </p>
                    <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                      <Field label="Jabatan" value={customer.occupation} />
                      <Field label="Perusahaan" value={customer.employer_name} />
                      <Field
                        label="Status kepegawaian"
                        value={
                          customer.employment_status
                            ? EMPLOYMENT_LABELS[customer.employment_status]
                            : "—"
                        }
                      />
                      <Field label="Penghasilan bulanan" value={formatCurrency(customer.monthly_income)} />
                      <Field label="Sumber dana" value={customer.source_of_fund} />
                      <Field label="Cabang" value={customer.branch_code} mono />
                    </div>
                  </div>

                  <div className="divider" />

                  <div>
                    <p className="mb-2.5 flex items-center gap-1.5 text-[0.66rem] font-bold uppercase tracking-[0.1em] text-slate-400">
                      <CalendarDays size={13} /> Administrasi
                    </p>
                    <div className="grid gap-x-5 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                      <Field label="Terdaftar sejak" value={formatDateId(customer.onboarded_at)} />
                      <Field label="Batch asal" value={customer.batch_number} mono />
                      <Field label="Risk rating" value={riskMeta?.label ?? customer.risk_rating} />
                    </div>
                  </div>
                </div>
              ) : null}

              {tab === "pekerjaan" ? (
                customer.employment_history.length ? (
                  <div className="space-y-3">
                    {customer.employment_history.map((item) => (
                      <div
                        key={item.id}
                        className={clsx(
                          "rounded-xl border p-3",
                          item.is_current
                            ? "border-brand-200 bg-brand-50/40"
                            : "border-line bg-white",
                        )}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="flex items-start gap-2.5">
                            <span
                              className={clsx(
                                "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                                item.is_current
                                  ? "bg-brand-100 text-brand-700"
                                  : "bg-slate-100 text-slate-500",
                              )}
                            >
                              <BriefcaseBusiness size={14} />
                            </span>
                            <div>
                              <p className="text-[0.82rem] font-bold text-ink-900">
                                {item.position}
                              </p>
                              <p className="mt-0.5 flex items-center gap-1 text-[0.72rem] text-slate-500">
                                <Building2 size={12} /> {item.company_name}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span
                              className={clsx(
                                "badge",
                                item.is_current ? "badge-clean" : "badge-neutral",
                              )}
                            >
                              {item.is_current ? "Posisi saat ini" : "Riwayat"}
                            </span>
                            <p className="mt-1 text-[0.64rem] text-slate-400">
                              {item.start_year} — {item.end_year ?? "sekarang"}
                            </p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    icon={<BriefcaseBusiness size={20} />}
                    title="Riwayat kepegawaian belum tersedia"
                    description="Data pekerjaan dapat dilengkapi melalui edit profil."
                  />
                )
              ) : null}

              {tab === "transaksi" ? (
                customer.transactions.length ? (
                  <div className="table-shell -mx-4 -mb-4">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Tanggal</th>
                          <th>Jenis</th>
                          <th>Lawan transaksi</th>
                          <th>Kanal</th>
                          <th className="text-right">Nominal</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {customer.transactions.map((transaction) => (
                          <tr key={transaction.id}>
                            <td className="whitespace-nowrap text-[0.72rem]">
                              {formatDateId(transaction.transaction_date)}
                            </td>
                            <td>
                              <span className="badge badge-info">
                                {TRANSACTION_LABELS[transaction.transaction_type]}
                              </span>
                            </td>
                            <td className="text-[0.73rem]">{transaction.counterparty}</td>
                            <td className="mono text-[0.68rem] text-slate-500">
                              {transaction.channel}
                            </td>
                            <td className="text-right font-semibold text-ink-900">
                              {formatCurrency(transaction.amount)}
                            </td>
                            <td>
                              <span
                                className={clsx(
                                  "badge",
                                  transaction.status === "COMPLETED"
                                    ? "badge-clean"
                                    : transaction.status === "PENDING"
                                      ? "badge-medium"
                                      : "badge-critical",
                                )}
                              >
                                {transaction.status === "COMPLETED"
                                  ? "Selesai"
                                  : transaction.status === "PENDING"
                                    ? "Pending"
                                    : "Dibatalkan"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyState
                    icon={<WalletCards size={20} />}
                    title="Belum ada transaksi"
                    description="Riwayat transaksi akan tampil setelah aktivitas rekening tercatat."
                  />
                )
              ) : null}

              {tab === "matching" ? (
                customer.matches.length ? (
                  <div className="space-y-2.5">
                    {customer.matches.map((match) => {
                      const severity =
                        SEVERITY_META[match.severity] ?? SEVERITY_META.LOW;
                      return (
                        <div
                          key={match.match_id}
                          className="rounded-xl border border-line bg-white p-3 transition hover:border-slate-300"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-2">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={clsx("badge", severity.className)}>
                                  <span className="badge-dot" /> {severity.label}
                                </span>
                                <span className="badge badge-neutral">
                                  {match.source_code}
                                </span>
                                {match.is_whitelisted ? (
                                  <span className="badge badge-clean">Whitelisted</span>
                                ) : null}
                              </div>
                              <p className="mt-1.5 text-[0.8rem] font-bold text-ink-900">
                                {match.entity_name}
                              </p>
                              <p className="mt-0.5 text-[0.65rem] text-slate-400">
                                {match.source_version} · Skor {match.score.toFixed(2)}%
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {match.case_id ? (
                                <Link
                                  href={`/cases?case=${match.case_id}`}
                                  className="btn btn-secondary btn-sm"
                                >
                                  {match.case_number} <ArrowUpRight size={12} />
                                </Link>
                              ) : (
                                <Link
                                  href={`/results?q=${encodeURIComponent(customer.full_name)}`}
                                  className="btn btn-secondary btn-sm"
                                >
                                  Tinjau hasil
                                </Link>
                              )}
                            </div>
                          </div>
                          {match.case_status ? (
                            <p className="mt-2 text-[0.64rem] text-slate-500">
                              Status kasus:{" "}
                              <span className="font-semibold text-ink-800">
                                {match.case_status === "CLOSED"
                                  ? "Selesai"
                                  : match.case_status === "PENDING_APPROVAL"
                                    ? "Menunggu persetujuan"
                                    : match.case_status === "IN_ANALYSIS"
                                      ? "Dalam analisis"
                                      : "Baru"}
                              </span>
                            </p>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <EmptyState
                    icon={<ShieldCheck size={20} />}
                    title="Tidak ada temuan watchlist"
                    description="Nasabah ini bersih terhadap DTTOT dan APU-PPT pada versi watchlist saat ini."
                    action={
                      <Link href="/matching" className="btn btn-secondary btn-sm">
                        <GitCompareArrows size={13} /> Buka matching engine
                      </Link>
                    }
                  />
                )
              ) : null}
            </div>
          </div>

          <div className="card p-4">
            <p className="text-[0.66rem] font-bold uppercase tracking-[0.1em] text-slate-400">
              Catatan kepatuhan
            </p>
            <div className="mt-2 grid gap-3 text-[0.7rem] leading-relaxed text-slate-600 sm:grid-cols-2">
              <div className="flex items-start gap-2">
                <Landmark size={14} className="mt-0.5 shrink-0 text-brand-600" />
                <p>
                  Data disimpan dengan enkripsi AES-256-GCM untuk NIK dan nomor
                  rekening. Penilaian kualitas bersifat indikatif untuk kelengkapan
                  CDD.
                </p>
              </div>
              <div className="flex items-start gap-2">
                <MapPin size={14} className="mt-0.5 shrink-0 text-brand-600" />
                <p>
                  Setiap perubahan profil dicatat pada log system yang bersifat
                  immutable (WORM) sesuai POJK No. 8 Tahun 2023.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="card p-4">
            <QualityPanel quality={customer.quality} />
          </div>

          <div className="card p-4">
            <p className="text-[0.66rem] font-bold uppercase tracking-[0.1em] text-slate-400">
              Ringkasan hubungan
            </p>
            <div className="mt-3 space-y-2.5">
              <div className="flex items-center justify-between text-[0.72rem]">
                <span className="text-slate-500">CIF</span>
                <span className="mono font-semibold text-ink-900">{customer.cif_number}</span>
              </div>
              <div className="flex items-center justify-between text-[0.72rem]">
                <span className="text-slate-500">Batch</span>
                <span className="mono font-semibold text-ink-900">{customer.batch_number}</span>
              </div>
              <div className="flex items-center justify-between text-[0.72rem]">
                <span className="text-slate-500">Terdaftar</span>
                <span className="font-semibold text-ink-900">
                  {formatDateId(customer.onboarded_at)}
                </span>
              </div>
              <div className="flex items-center justify-between text-[0.72rem]">
                <span className="text-slate-500">Aktivitas transaksi</span>
                <span className="font-semibold text-ink-900">
                  {customer.last_transaction_at
                    ? formatDateTimeId(`${customer.last_transaction_at}T00:00:00+07:00`)
                    : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between text-[0.72rem]">
                <span className="text-slate-500">Temuan aktif</span>
                <span className="font-semibold text-ink-900">
                  {customer.matches.filter((match) => !match.is_whitelisted).length}
                </span>
              </div>
            </div>
            <div className="mt-3 rounded-lg border border-line bg-slate-50 px-3 py-2">
              <p className="flex items-center gap-1.5 text-[0.64rem] font-semibold text-slate-500">
                <Clock3 size={12} /> Terakhir diperbarui melalui log system
              </p>
            </div>
          </div>

          <div className="hero-panel relative overflow-hidden rounded-2xl p-4 text-white">
            <p className="text-[0.62rem] font-bold uppercase tracking-[0.12em] text-gold-300">
              Tindak lanjut
            </p>
            <p className="mt-1.5 text-[0.82rem] font-bold">
              {customer.open_case_count > 0
                ? "Ada kasus investigasi aktif"
                : customer.quality.grade === "D"
                  ? "Lengkapi data CDD nasabah"
                  : "Tidak ada tindakan mendesak"}
            </p>
            <p className="mt-1 text-[0.66rem] leading-relaxed text-slate-300">
              {customer.open_case_count > 0
                ? "Tinjau kasus dan pastikan maker-checker berjalan sesuai SLA."
                : customer.quality.grade === "D"
                  ? "Gap data material dapat menurunkan kualitas CDD dan skor risiko."
                  : "Pertahankan kualitas data dan lakukan re-screening berkala."}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Link href="/cases" className="btn btn-gold btn-sm">
                Buka kasus
              </Link>
              <Link
                href="/matching"
                className="btn btn-sm border-white/15 bg-white/[0.07] text-white hover:bg-white/[0.12]"
              >
                Re-screening
              </Link>
            </div>
          </div>
        </div>
      </div>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit profil nasabah"
        description="Perubahan akan tercatat pada log system dan diaudit."
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setEditOpen(false)}
              disabled={saving}
            >
              Batal
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={saveProfile}
              disabled={saving}
            >
              {saving ? "Menyimpan..." : "Simpan perubahan"}
            </button>
          </>
        }
      >
        {form ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="sm:col-span-2">
              <span className="field-label">Nama lengkap</span>
              <input
                className="input"
                value={form.full_name}
                onChange={(event) => setForm({ ...form, full_name: event.target.value })}
              />
            </label>
            <label>
              <span className="field-label">Jabatan</span>
              <input
                className="input"
                value={form.occupation}
                onChange={(event) => setForm({ ...form, occupation: event.target.value })}
              />
            </label>
            <label>
              <span className="field-label">Perusahaan</span>
              <input
                className="input"
                value={form.employer_name}
                onChange={(event) => setForm({ ...form, employer_name: event.target.value })}
              />
            </label>
            <label>
              <span className="field-label">Status kepegawaian</span>
              <select
                className="select"
                value={form.employment_status}
                onChange={(event) =>
                  setForm({
                    ...form,
                    employment_status: event.target.value as EmploymentStatus,
                  })
                }
              >
                {Object.entries(EMPLOYMENT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span className="field-label">Profil risiko</span>
              <select
                className="select"
                value={form.risk_rating}
                onChange={(event) =>
                  setForm({
                    ...form,
                    risk_rating: event.target.value as CustomerRiskRating,
                  })
                }
              >
                <option value="LOW">Rendah</option>
                <option value="MEDIUM">Sedang</option>
                <option value="HIGH">Tinggi</option>
              </select>
            </label>
            <label>
              <span className="field-label">Status profil</span>
              <select
                className="select"
                value={form.profile_status}
                onChange={(event) =>
                  setForm({
                    ...form,
                    profile_status: event.target.value as CustomerProfileStatus,
                  })
                }
              >
                <option value="ACTIVE">Aktif</option>
                <option value="DORMANT">Dormant</option>
                <option value="CLOSED">Tutup</option>
              </select>
            </label>
            <label>
              <span className="field-label">Cabang</span>
              <input
                className="input"
                value={form.branch_code}
                onChange={(event) => setForm({ ...form, branch_code: event.target.value })}
              />
            </label>
            <label>
              <span className="field-label">Penghasilan bulanan (IDR)</span>
              <input
                className="input"
                type="number"
                min={0}
                step={100000}
                value={form.monthly_income}
                onChange={(event) => setForm({ ...form, monthly_income: event.target.value })}
              />
            </label>
            <label>
              <span className="field-label">Sumber dana</span>
              <input
                className="input"
                value={form.source_of_fund}
                onChange={(event) => setForm({ ...form, source_of_fund: event.target.value })}
              />
            </label>
            <label>
              <span className="field-label">Tempat lahir</span>
              <input
                className="input"
                value={form.place_of_birth}
                onChange={(event) => setForm({ ...form, place_of_birth: event.target.value })}
              />
            </label>
            <label>
              <span className="field-label">Kewarganegaraan</span>
              <input
                className="input"
                value={form.nationality}
                onChange={(event) => setForm({ ...form, nationality: event.target.value })}
              />
            </label>
            <label>
              <span className="field-label">Tanggal lahir</span>
              <input
                className="input"
                type="date"
                value={form.date_of_birth}
                onChange={(event) => setForm({ ...form, date_of_birth: event.target.value })}
              />
            </label>
            <label>
              <span className="field-label">Paspor</span>
              <input
                className="input"
                value={form.passport_number}
                onChange={(event) => setForm({ ...form, passport_number: event.target.value })}
              />
            </label>
            <label className="sm:col-span-2">
              <span className="field-label">Alamat</span>
              <textarea
                className="textarea"
                rows={2}
                value={form.address}
                onChange={(event) => setForm({ ...form, address: event.target.value })}
              />
            </label>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
