"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Bell,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Database,
  FileBarChart2,
  FolderKanban,
  GitCompareArrows,
  History,
  LayoutDashboard,
  ListChecks,
  Menu,
  ScanSearch,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  UserCog,
  UserRoundCog,
  UsersRound,
  X,
} from "lucide-react";
import { NAV_ITEMS, ROLE_META, clsx, getInitials, roleColor } from "@/lib/ui";
import { useDemoUser } from "./user-provider";
import { useToast } from "./toast-provider";

const ICON_MAP: Record<string, ReactNode> = {
  "/": <LayoutDashboard size={17} />,
  "/smart-search": <Search size={17} />,
  "/results": <ScanSearch size={17} />,
  "/cases": <FolderKanban size={17} />,
  "/customers": <UsersRound size={17} />,
  "/dttot": <ShieldAlert size={17} />,
  "/apuppt": <ListChecks size={17} />,
  "/matching": <GitCompareArrows size={17} />,
  "/watchlist": <Database size={17} />,
  "/screening": <UploadCloud size={17} />,
  "/reports": <FileBarChart2 size={17} />,
  "/admin": <UserCog size={17} />,
  "/audit": <History size={17} />,
};

const PAGE_TITLES: Record<string, string> = {
  "/": "Ringkasan",
  "/smart-search": "Smart Search",
  "/results": "Hasil Screening",
  "/cases": "Kasus & Persetujuan",
  "/customers": "Data Nasabah",
  "/dttot": "Data DTTOT",
  "/apuppt": "Data APU-PPT",
  "/matching": "Matching Engine",
  "/watchlist": "Watchlist Sanksi",
  "/screening": "Upload & Screening",
  "/reports": "Laporan Kepatuhan",
  "/admin": "Admin Management",
  "/audit": "Log System",
};

const GROUPS = ["Monitoring", "Manajemen Data", "Tata Kelola"];

export function AppShell({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const { user, users, setUser, apiFetch } = useDemoUser();
  const toast = useToast();
  const router = useRouter();
  const [badges, setBadges] = useState<{ hits: number; pending: number }>({
    hits: 0,
    pending: 0,
  });
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [globalQuery, setGlobalQuery] = useState("");
  const profileRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSidebarOpen(false);
    setProfileOpen(false);
    setNotificationsOpen(false);
  }, [pathname]);

  useEffect(() => {
    let active = true;
    async function loadBadges() {
      try {
        const [dashboard, cases] = await Promise.all([
          apiFetch<{ metrics: { totalHits: number } }>("/api/dashboard"),
          apiFetch<{ metrics: { pendingApproval: number } }>("/api/cases"),
        ]);
        if (!active) return;
        setBadges({
          hits: dashboard.metrics.totalHits,
          pending: cases.metrics.pendingApproval,
        });
      } catch {
        // Sidebar badges are non-critical.
      }
    }
    void loadBadges();
    return () => {
      active = false;
    };
  }, [apiFetch, pathname]);

  useEffect(() => {
    const click = (event: MouseEvent) => {
      if (
        profileRef.current &&
        !profileRef.current.contains(event.target as Node)
      ) {
        setProfileOpen(false);
      }
      if (
        notificationsRef.current &&
        !notificationsRef.current.contains(event.target as Node)
      ) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener("mousedown", click);
    return () => document.removeEventListener("mousedown", click);
  }, []);

  const currentTitle = useMemo(() => {
    if (pathname.startsWith("/matches/")) return "Hasil Screening";
    if (pathname.startsWith("/customers/")) return "Profil Nasabah";
    return PAGE_TITLES[pathname] ?? "Compliance Suite";
  }, [pathname]);

  const role = ROLE_META[user.role_code];

  function switchUser(nextId: string) {
    const next = users.find((item) => item.id === nextId);
    if (!next) return;
    setUser(next);
    setProfileOpen(false);
    toast.info(
      `Beralih ke ${next.full_name}`,
      `${ROLE_META[next.role_code].label} · ${next.branch_code}`,
    );
    router.refresh();
  }

  function submitGlobalSearch(event: React.FormEvent) {
    event.preventDefault();
    if (!globalQuery.trim()) return;
    router.push(`/smart-search?q=${encodeURIComponent(globalQuery.trim())}`);
  }

  return (
    <div className="min-h-screen">
      {sidebarOpen ? (
        <div
          className="fixed inset-0 z-[60] bg-ink-950/55 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      ) : null}

      <aside
        className={clsx(
          "sidebar sidebar-grid fixed inset-y-0 left-0 z-[70] flex w-[266px] flex-col overflow-hidden text-white transition-transform duration-200 lg:translate-x-0",
          sidebarOpen ? "open" : "",
        )}
      >
        <div className="relative flex items-center gap-3 border-b border-white/[0.07] px-5 py-5">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-gold-300/30 bg-gradient-to-br from-gold-400 to-gold-600 text-ink-950 shadow-lg shadow-black/20">
            <ShieldCheck size={22} strokeWidth={2.4} />
            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border-2 border-ink-900 bg-emerald-400" />
          </div>
          <div className="min-w-0">
            <p className="text-[0.82rem] font-extrabold tracking-[0.09em] text-white">
              DMB COMPLIANCE
            </p>
            <p className="mt-0.5 truncate text-[0.58rem] font-semibold uppercase tracking-[0.16em] text-slate-400">
              PT Didi Max Berjangka
            </p>
          </div>
          <button
            type="button"
            className="icon-btn ml-auto text-slate-400 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Tutup menu"
          >
            <X size={17} />
          </button>
        </div>

        <div className="relative flex-1 overflow-y-auto scroll-area px-3 py-4">
          <div className="mb-4 rounded-xl border border-white/[0.07] bg-white/[0.035] px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className="live-dot" />
              <span className="text-[0.63rem] font-bold uppercase tracking-[0.12em] text-emerald-300">
                Sistem Kepatuhan Aktif
              </span>
            </div>
            <p className="mt-1 text-[0.63rem] leading-relaxed text-slate-400">
              Screening engine & watchlist sync berjalan normal.
            </p>
          </div>

          {GROUPS.map((group) => (
            <div key={group} className="mb-4">
              <p className="mb-1.5 px-3 text-[0.56rem] font-bold uppercase tracking-[0.17em] text-slate-500">
                {group}
              </p>
              <nav className="space-y-0.5">
                {NAV_ITEMS.filter((item) => item.group === group).map((item) => {
                  const active =
                    item.href === "/"
                      ? pathname === "/"
                      : pathname.startsWith(item.href);
                  const badge =
                    item.href === "/results"
                      ? badges.hits
                      : item.href === "/cases"
                        ? badges.pending
                        : 0;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={clsx("sidebar-link", active && "active")}
                    >
                      {ICON_MAP[item.href]}
                      <span className="flex-1">{item.label}</span>
                      {badge > 0 ? (
                        <span
                          className={clsx(
                            "flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[0.58rem] font-extrabold",
                            item.href === "/cases"
                              ? "bg-gold-400/20 text-gold-300"
                              : "bg-white/10 text-slate-300",
                          )}
                        >
                          {badge}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </nav>
            </div>
          ))}

          <div className="mt-5 rounded-xl border border-gold-300/15 bg-gradient-to-br from-gold-400/[0.09] to-transparent p-3">
            <div className="flex items-start gap-2.5">
              <Sparkles size={15} className="mt-0.5 shrink-0 text-gold-300" />
              <div>
                <p className="text-[0.7rem] font-bold text-gold-100">
                  POJK No. 8 Tahun 2023
                </p>
                <p className="mt-1 text-[0.62rem] leading-relaxed text-slate-400">
                  Seluruh keputusan wajib melalui maker-checker dan tercatat
                  immutable.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="relative border-t border-white/[0.07] p-3">
          <div className="flex items-center gap-2.5 rounded-xl bg-white/[0.04] p-2.5">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[0.65rem] font-extrabold text-white"
              style={{ background: roleColor(user.role_code) }}
            >
              {getInitials(user.full_name)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[0.72rem] font-bold text-white">
                {user.full_name}
              </p>
              <p className="truncate text-[0.59rem] text-slate-400">
                {role.short} · {user.branch_code}
              </p>
            </div>
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          </div>
          <p className="mt-2 px-1 text-center text-[0.53rem] tracking-wide text-slate-500">
            DMB-ERD-DaMeL-IT-2410 · v1.0
          </p>
        </div>
      </aside>

      <div className="app-main min-h-screen lg:pl-[266px]">
        <header className="header-glass sticky top-0 z-40 border-b border-line/80">
          <div className="flex h-[62px] items-center gap-3 px-4 sm:px-6">
            <button
              type="button"
              className="icon-btn lg:hidden"
              onClick={() => setSidebarOpen(true)}
              aria-label="Buka menu"
            >
              <Menu size={19} />
            </button>

            <div className="hidden min-w-0 items-center gap-2 text-[0.71rem] text-slate-400 sm:flex">
              <span className="font-semibold text-slate-500">DMB</span>
              <ChevronRight size={13} />
              <span className="truncate font-bold text-ink-800">{currentTitle}</span>
            </div>

            <form
              onSubmit={submitGlobalSearch}
              className="relative ml-auto hidden w-full max-w-[280px] md:block"
            >
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                value={globalQuery}
                onChange={(event) => setGlobalQuery(event.target.value)}
                className="input h-9 pl-8 pr-10 text-[0.73rem]"
                placeholder="Cari nama, CIF, no. kasus..."
              />
              <span className="command-key absolute right-2.5 top-1/2 -translate-y-1/2">
                /
              </span>
            </form>

            <div className="ml-auto flex items-center gap-1 md:ml-0">
              <div className="hidden items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50 px-2.5 py-1 text-[0.62rem] font-bold text-emerald-700 xl:flex">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                AML Engine Online
              </div>

              <div className="relative" ref={notificationsRef}>
                <button
                  type="button"
                  className="icon-btn relative"
                  onClick={() => setNotificationsOpen((open) => !open)}
                  aria-label="Notifikasi"
                >
                  <Bell size={17} />
                  <span className="absolute right-2 top-1.5 h-2 w-2 rounded-full border-2 border-white bg-gold-500" />
                </button>
                {notificationsOpen ? (
                  <div className="animate-fade-up absolute right-0 top-11 w-[310px] overflow-hidden rounded-xl border border-line bg-white shadow-xl">
                    <div className="flex items-center justify-between border-b border-line px-3.5 py-2.5">
                      <p className="text-[0.76rem] font-bold text-ink-900">
                        Notifikasi Kepatuhan
                      </p>
                      <span className="badge badge-gold">3 baru</span>
                    </div>
                    <div className="divide-y divide-line">
                      <button
                        type="button"
                        onClick={() => router.push("/cases")}
                        className="flex w-full items-start gap-2.5 px-3.5 py-3 text-left hover:bg-slate-50"
                      >
                        <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg bg-amber-50 text-amber-700">
                          <FolderKanban size={14} />
                        </span>
                        <span>
                          <span className="block text-[0.72rem] font-semibold text-ink-900">
                            {badges.pending} approval menunggu tindakan
                          </span>
                          <span className="mt-0.5 block text-[0.65rem] text-slate-500">
                            Checker/Approver perlu meninjau kasus aktif.
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => router.push("/watchlist")}
                        className="flex w-full items-start gap-2.5 px-3.5 py-3 text-left hover:bg-slate-50"
                      >
                        <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                          <Database size={14} />
                        </span>
                        <span>
                          <span className="block text-[0.72rem] font-semibold text-ink-900">
                            DTTOT Tahap II Tahun 2026 aktif
                          </span>
                          <span className="mt-0.5 block text-[0.65rem] text-slate-500">
                            Versi watchlist berlaku sejak 21 Sep 2026.
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => router.push("/cases")}
                        className="flex w-full items-start gap-2.5 px-3.5 py-3 text-left hover:bg-slate-50"
                      >
                        <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-lg bg-red-50 text-red-700">
                          <ShieldCheck size={14} />
                        </span>
                        <span>
                          <span className="block text-[0.72rem] font-semibold text-ink-900">
                            Pemblokiran rekening aktif
                          </span>
                          <span className="mt-0.5 block text-[0.65rem] text-slate-500">
                            Pastikan surat perintah dan pelaporan SIPESAT lengkap.
                          </span>
                        </span>
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="mx-1 hidden h-6 w-px bg-line sm:block" />

              <div className="relative" ref={profileRef}>
                <button
                  type="button"
                  className="flex items-center gap-2 rounded-lg border border-transparent px-1.5 py-1 transition-colors hover:border-line hover:bg-white"
                  onClick={() => setProfileOpen((open) => !open)}
                >
                  <span
                    className="flex h-8 w-8 items-center justify-center rounded-full text-[0.63rem] font-extrabold text-white"
                    style={{ background: roleColor(user.role_code) }}
                  >
                    {getInitials(user.full_name)}
                  </span>
                  <span className="hidden text-left sm:block">
                    <span className="block text-[0.7rem] font-bold leading-tight text-ink-900">
                      {user.full_name}
                    </span>
                    <span className="block text-[0.57rem] leading-tight text-slate-500">
                      {role.short}
                    </span>
                  </span>
                  <ChevronDown
                    size={13}
                    className="hidden text-slate-400 sm:block"
                  />
                </button>

                {profileOpen ? (
                  <div className="animate-fade-up absolute right-0 top-11 w-[330px] overflow-hidden rounded-xl border border-line bg-white shadow-xl">
                    <div className="border-b border-line bg-slate-50/80 px-3.5 py-2.5">
                      <p className="flex items-center gap-1.5 text-[0.7rem] font-bold text-ink-900">
                        <UserRoundCog size={14} /> Ganti Persona Demo
                      </p>
                      <p className="mt-0.5 text-[0.62rem] leading-relaxed text-slate-500">
                        Setiap persona memiliki kewenangan berbeda sesuai prinsip
                        four-eyes.
                      </p>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto p-1.5">
                      {users.map((persona) => {
                        const meta = ROLE_META[persona.role_code];
                        const selected = persona.id === user.id;
                        return (
                          <button
                            key={persona.id}
                            type="button"
                            onClick={() => switchUser(persona.id)}
                            className={clsx(
                              "flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors",
                              selected
                                ? "bg-brand-50/80"
                                : "hover:bg-slate-50",
                            )}
                          >
                            <span
                              className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[0.58rem] font-extrabold text-white"
                              style={{ background: persona.avatar_color }}
                            >
                              {getInitials(persona.full_name)}
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-1.5">
                                <span className="truncate text-[0.72rem] font-bold text-ink-900">
                                  {persona.full_name}
                                </span>
                                {selected ? (
                                  <span className="badge badge-clean !px-1.5 !py-0 !text-[0.52rem]">
                                    Aktif
                                  </span>
                                ) : null}
                              </span>
                              <span className="mt-0.5 block text-[0.61rem] font-semibold" style={{ color: meta.color }}>
                                {meta.label}
                              </span>
                              <span className="mt-0.5 block text-[0.58rem] leading-relaxed text-slate-500">
                                {meta.description}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    <div className="border-t border-line bg-slate-50 px-3.5 py-2">
                      <p className="flex items-center gap-1.5 text-[0.59rem] text-slate-500">
                        <CircleHelp size={11} />
                        Mode demo — autentikasi produksi menggunakan SSO.
                      </p>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1510px] px-4 py-5 sm:px-6 lg:px-7 lg:py-6">
          {children}
        </main>

        <footer className="mx-auto flex w-full max-w-[1510px] flex-col items-center justify-between gap-2 border-t border-line/70 px-5 py-4 text-[0.62rem] text-slate-400 sm:flex-row lg:px-7">
          <p>
            © 2026 PT Didi Max Berjangka · Smart Screening APU-PPT & DTTOT
          </p>
          <p className="flex items-center gap-1.5">
            <ShieldCheck size={12} className="text-brand-600" />
            Klasifikasi Internal · Data demo tersimulasi
          </p>
        </footer>
      </div>
    </div>
  );
}
