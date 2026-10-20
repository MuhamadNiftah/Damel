"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowUpRight,
  Building2,
  Clock3,
  FolderKanban,
  Search,
  ShieldAlert,
  Sparkles,
  UserRound,
} from "lucide-react";
import type { GlobalSearchResult } from "@/lib/search";
import { useDemoUser } from "@/components/user-provider";
import { useToast } from "@/components/toast-provider";
import {
  EmptyState,
  Skeleton,
  Tabs,
} from "@/components/ui";
import { QualityBadge } from "@/components/quality";
import { formatDateId } from "@/lib/normalize";
import { clsx, SEVERITY_META } from "@/lib/ui";

type FilterKey = "all" | "customers" | "entities" | "cases";

const SUGGESTIONS = [
  "Muhammad Syarifuddin",
  "Global Waqf Foundation",
  "CIF-2026-1001",
  "DTTOT",
];

const SOURCE_CATEGORY: Record<string, "DTTOT" | "APUPPT"> = {
  DTTOT: "DTTOT",
  DPPSPM: "APUPPT",
  PEP: "APUPPT",
  UN_SANCTION: "APUPPT",
};

function Highlight({ text, query }: { text: string; query: string }) {
  const needle = query.trim();
  if (!needle) return <>{text}</>;
  const index = text.toLowerCase().indexOf(needle.toLowerCase());
  if (index < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, index)}
      <mark className="rounded bg-gold-200/70 px-0.5 text-ink-900">
        {text.slice(index, index + needle.length)}
      </mark>
      {text.slice(index + needle.length)}
    </>
  );
}

function SmartSearchContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { apiFetch } = useDemoUser();
  const toast = useToast();
  const initial = searchParams.get("q") ?? "";
  const [query, setQuery] = useState(initial);
  const [submitted, setSubmitted] = useState(initial);
  const [filter, setFilter] = useState<FilterKey>("all");
  const [result, setResult] = useState<GlobalSearchResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const next = searchParams.get("q") ?? "";
    setQuery(next);
    setSubmitted(next);
  }, [searchParams]);

  useEffect(() => {
    const needle = submitted.trim();
    if (needle.length < 2) {
      setResult(null);
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    const timer = setTimeout(() => {
      apiFetch<GlobalSearchResult>(`/api/search?q=${encodeURIComponent(needle)}`)
        .then((payload) => {
          if (active) setResult(payload);
        })
        .catch((error: Error) => {
          if (active) toast.error("Pencarian gagal", error.message);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 240);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [apiFetch, submitted, toast]);

  function runSearch(value?: string) {
    const next = (value ?? query).trim();
    setSubmitted(next);
    setQuery(next);
    setFilter("all");
    if (next) {
      router.replace(`/smart-search?q=${encodeURIComponent(next)}`, { scroll: false });
    } else {
      router.replace("/smart-search", { scroll: false });
    }
  }

  const counts = useMemo(
    () => ({
      all: result?.total ?? 0,
      customers: result?.customers.length ?? 0,
      entities: result?.entities.length ?? 0,
      cases: result?.cases.length ?? 0,
    }),
    [result],
  );

  const showCustomers = filter === "all" || filter === "customers";
  const showEntities = filter === "all" || filter === "entities";
  const showCases = filter === "all" || filter === "cases";

  return (
    <div className="space-y-4">
      <div className="hero-panel relative overflow-hidden rounded-2xl p-5 sm:p-6">
        <div className="relative z-10">
          <p className="flex items-center gap-1.5 text-[0.64rem] font-bold uppercase tracking-[0.16em] text-gold-300">
            <Sparkles size={13} /> Smart Search lintas modul
          </p>
          <h1 className="mt-1.5 text-[1.35rem] font-extrabold tracking-tight text-white sm:text-[1.6rem]">
            Cari nasabah, entitas watchlist, atau kasus dalam satu query
          </h1>
          <p className="mt-1 max-w-2xl text-[0.76rem] leading-relaxed text-slate-300">
            Pencarian mencakup nama, CIF, NIK, nomor rekening, alias DTTOT/APU-PPT,
            dasar hukum, hingga nomor kasus investigasi.
          </p>
          <form
            className="mt-4 flex flex-col gap-2 sm:flex-row"
            onSubmit={(event) => {
              event.preventDefault();
              runSearch();
            }}
          >
            <div className="relative flex-1">
              <Search
                size={17}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                autoFocus
                className="input h-11 rounded-xl border-white/20 bg-white pl-10 text-[0.82rem] shadow-lg"
                placeholder="Ketik minimal 2 karakter — nama, CIF, NIK, alias, atau nomor kasus..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-gold h-11 px-5">
              <Search size={15} /> Cari sekarang
            </button>
          </form>
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
            <span className="text-[0.62rem] font-semibold text-slate-400">Coba:</span>
            {SUGGESTIONS.map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                className="rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[0.62rem] font-semibold text-slate-300 transition hover:bg-white/[0.12] hover:text-white"
                onClick={() => runSearch(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      </div>

      {submitted.trim().length < 2 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <div className="card p-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <UserRound size={17} />
            </span>
            <p className="mt-2.5 text-[0.82rem] font-bold text-ink-900">Nasabah</p>
            <p className="mt-1 text-[0.7rem] leading-relaxed text-slate-500">
              Temukan profil, jabatan, kualitas data, dan hasil screening nasabah.
            </p>
            <Link href="/customers" className="mt-2.5 inline-flex items-center gap-1 text-[0.68rem] font-bold text-brand-700">
              Buka data nasabah <ArrowUpRight size={12} />
            </Link>
          </div>
          <div className="card p-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-50 text-amber-700">
              <ShieldAlert size={17} />
            </span>
            <p className="mt-2.5 text-[0.82rem] font-bold text-ink-900">Watchlist</p>
            <p className="mt-1 text-[0.7rem] leading-relaxed text-slate-500">
              Cari entitas DTTOT, DPPSPM, PEP, dan sanksi internasional beserta alias.
            </p>
            <div className="mt-2.5 flex gap-2">
              <Link href="/dttot" className="text-[0.68rem] font-bold text-brand-700">
                DTTOT
              </Link>
              <Link href="/apuppt" className="text-[0.68rem] font-bold text-brand-700">
                APU-PPT
              </Link>
            </div>
          </div>
          <div className="card p-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-violet-50 text-violet-700">
              <FolderKanban size={17} />
            </span>
            <p className="mt-2.5 text-[0.82rem] font-bold text-ink-900">Kasus investigasi</p>
            <p className="mt-1 text-[0.7rem] leading-relaxed text-slate-500">
              Lacak nomor kasus, status maker-checker, dan keputusan final.
            </p>
            <Link href="/cases" className="mt-2.5 inline-flex items-center gap-1 text-[0.68rem] font-bold text-brand-700">
              Buka kasus <ArrowUpRight size={12} />
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Tabs
              tabs={[
                { value: "all", label: "Semua", count: counts.all },
                { value: "customers", label: "Nasabah", count: counts.customers },
                { value: "entities", label: "Watchlist", count: counts.entities },
                { value: "cases", label: "Kasus", count: counts.cases },
              ]}
              value={filter}
              onChange={setFilter}
            />
            <p className="flex items-center gap-1 text-[0.66rem] text-slate-400">
              <Clock3 size={12} />
              {loading
                ? "Mencari..."
                : result
                  ? `${result.total} hasil dalam ${result.tookMs} ms`
                  : "Menunggu pencarian"}
            </p>
          </div>

          {loading ? (
            <div className="grid gap-3 lg:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-28 w-full" />
              ))}
            </div>
          ) : !result || result.total === 0 ? (
            <div className="card">
              <EmptyState
                icon={<Search size={22} />}
                title={`Tidak ada hasil untuk “${submitted}”`}
                description="Periksa ejaan, gunakan nama tanpa gelar, atau cari berdasarkan CIF/nomor kasus."
                action={
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => {
                      const next = SUGGESTIONS[0];
                      runSearch(next);
                    }}
                  >
                    Coba contoh pencarian
                  </button>
                }
              />
            </div>
          ) : (
            <div className="space-y-4">
              {showCustomers && result.customers.length ? (
                <section>
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className="flex items-center gap-1.5 text-[0.72rem] font-bold uppercase tracking-[0.09em] text-slate-500">
                      <UserRound size={14} /> Nasabah
                    </h2>
                    <Link href="/customers" className="text-[0.65rem] font-semibold text-brand-700">
                      Lihat semua
                    </Link>
                  </div>
                  <div className="grid gap-2.5 lg:grid-cols-2">
                    {result.customers.map((customer) => (
                      <Link
                        key={customer.id}
                        href={`/customers/${customer.id}`}
                        className="card card-hover flex items-start justify-between gap-3 p-3.5"
                      >
                        <div className="min-w-0">
                          <p className="text-[0.84rem] font-bold text-ink-900">
                            <Highlight text={customer.full_name} query={submitted} />
                          </p>
                          <p className="mt-0.5 text-[0.65rem] text-slate-400">
                            <span className="mono">{customer.cif_number}</span> ·{" "}
                            {customer.occupation} · {customer.branch_code}
                          </p>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                            <QualityBadge quality={customer.quality} />
                            <span
                              className={clsx(
                                "badge",
                                customer.risk_rating === "HIGH"
                                  ? "badge-critical"
                                  : customer.risk_rating === "MEDIUM"
                                    ? "badge-medium"
                                    : "badge-clean",
                              )}
                            >
                              Risiko {customer.risk_rating.toLowerCase()}
                            </span>
                            {customer.highest_severity ? (
                              <span className="badge badge-critical">
                                {customer.highest_severity}
                              </span>
                            ) : (
                              <span className="badge badge-clean">Bersih</span>
                            )}
                          </div>
                        </div>
                        <ArrowUpRight size={15} className="mt-1 shrink-0 text-slate-300" />
                      </Link>
                    ))}
                  </div>
                </section>
              ) : null}

              {showEntities && result.entities.length ? (
                <section>
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className="flex items-center gap-1.5 text-[0.72rem] font-bold uppercase tracking-[0.09em] text-slate-500">
                      <ShieldAlert size={14} /> Entitas watchlist
                    </h2>
                    <span className="text-[0.65rem] text-slate-400">
                      DTTOT & APU-PPT
                    </span>
                  </div>
                  <div className="grid gap-2.5 lg:grid-cols-2">
                    {result.entities.map((entity) => {
                      const category = SOURCE_CATEGORY[entity.source_code] ?? "DTTOT";
                      return (
                        <Link
                          key={entity.id}
                          href={category === "DTTOT" ? "/dttot" : "/apuppt"}
                          className="card card-hover flex items-start justify-between gap-3 p-3.5"
                        >
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="badge badge-info">
                                {entity.source_code}
                              </span>
                              <span className="badge badge-neutral">
                                {entity.entity_type === "CORPORATE" ? "Korporasi" : "Individu"}
                              </span>
                              <span className="badge badge-clean">
                                {entity.match_count} match
                              </span>
                            </div>
                            <p className="mt-1.5 text-[0.84rem] font-bold text-ink-900">
                              <Highlight text={entity.primary_name} query={submitted} />
                            </p>
                            <p className="mt-0.5 text-[0.65rem] text-slate-400">
                              {entity.nationality || "—"} ·{" "}
                              {entity.date_of_birth ? formatDateId(entity.date_of_birth) : "—"} ·{" "}
                              {entity.source_version}
                            </p>
                            {entity.aliases.length ? (
                              <p className="mt-1 line-clamp-1 text-[0.63rem] text-slate-500">
                                Alias:{" "}
                                {entity.aliases.map((alias, index) => (
                                  <span key={alias}>
                                    <Highlight text={alias} query={submitted} />
                                    {index < entity.aliases.length - 1 ? ", " : ""}
                                  </span>
                                ))}
                              </p>
                            ) : null}
                          </div>
                          <ArrowUpRight size={15} className="mt-1 shrink-0 text-slate-300" />
                        </Link>
                      );
                    })}
                  </div>
                </section>
              ) : null}

              {showCases && result.cases.length ? (
                <section>
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className="flex items-center gap-1.5 text-[0.72rem] font-bold uppercase tracking-[0.09em] text-slate-500">
                      <FolderKanban size={14} /> Kasus investigasi
                    </h2>
                    <Link href="/cases" className="text-[0.65rem] font-semibold text-brand-700">
                      Lihat semua
                    </Link>
                  </div>
                  <div className="card overflow-hidden">
                    <div className="table-shell">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Nomor kasus</th>
                            <th>Nasabah</th>
                            <th>Entitas</th>
                            <th>Status</th>
                            <th>Severity</th>
                            <th>Dibuka</th>
                          </tr>
                        </thead>
                        <tbody>
                          {result.cases.map((item) => {
                            const severity =
                              SEVERITY_META[item.severity] ?? SEVERITY_META.LOW;
                            return (
                              <tr key={item.id}>
                                <td>
                                  <Link
                                    href={`/cases?case=${item.id}`}
                                    className="primary-cell hover:text-brand-700"
                                  >
                                    <Highlight text={item.case_number} query={submitted} />
                                  </Link>
                                </td>
                                <td className="text-[0.73rem]">
                                  <Highlight text={item.customer_name} query={submitted} />
                                </td>
                                <td className="text-[0.73rem]">
                                  <Highlight text={item.entity_name} query={submitted} />
                                </td>
                                <td>
                                  <span className="badge badge-neutral">
                                    {item.status === "PENDING_APPROVAL"
                                      ? "Menunggu persetujuan"
                                      : item.status === "IN_ANALYSIS"
                                        ? "Analisis"
                                        : item.status === "CLOSED"
                                          ? "Selesai"
                                          : "Baru"}
                                  </span>
                                </td>
                                <td>
                                  <span className={clsx("badge", severity.className)}>
                                    {severity.label}
                                  </span>
                                </td>
                                <td className="text-[0.68rem] text-slate-500">
                                  {formatDateId(item.opened_at)}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </section>
              ) : null}
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-3 text-[0.66rem] text-slate-500">
        <Building2 size={14} className="text-brand-600" />
        Pencarian memproses data nasabah (termasuk NIK terenkripsi) dan watchlist
        secara lokal pada server demo. Tidak ada data yang dikirim ke pihak ketiga.
      </div>
    </div>
  );
}

export default function SmartSearchPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-44 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      }
    >
      <SmartSearchContent />
    </Suspense>
  );
}
