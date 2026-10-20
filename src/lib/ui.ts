import clsx from "clsx";
import type {
  AnalystRecommendation,
  ApprovalStep,
  CaseStatus,
  ReportType,
  RoleCode,
  SourceCode,
} from "./types";

export { clsx };

export const ROLE_META: Record<
  RoleCode,
  { label: string; short: string; description: string; color: string }
> = {
  MAKER_ANALYST: {
    label: "Maker / Analis AML",
    short: "Maker",
    description: "Membuka kasus, analisis, dan mengajukan rekomendasi.",
    color: "#0f766e",
  },
  CHECKER_SUPERVISOR: {
    label: "Checker / Supervisor",
    short: "Checker",
    description: "Memverifikasi kelengkapan bukti dan meneruskan ke Approver.",
    color: "#1d4ed8",
  },
  APPROVER_HEAD: {
    label: "Approver / Compliance Head",
    short: "Approver",
    description: "Memberi keputusan final dan menerbitkan pemblokiran.",
    color: "#b45309",
  },
  AUDITOR: {
    label: "Auditor",
    short: "Auditor",
    description: "Akses baca audit trail, hasil screening, dan laporan.",
    color: "#6d28d9",
  },
  ADMIN: {
    label: "Admin Sistem",
    short: "Admin",
    description: "Mengelola pengguna, peran, akses modul, dan konfigurasi sistem.",
    color: "#0f172a",
  },
};

export const SEVERITY_META = {
  CRITICAL: {
    label: "Critical",
    longLabel: "Critical Match",
    color: "#d92d20",
    bg: "#fff1f0",
    className: "badge-critical",
    description: "Identitas dokumen exact match",
  },
  HIGH: {
    label: "High",
    longLabel: "High Risk",
    color: "#e66716",
    bg: "#fff5eb",
    className: "badge-high",
    description: "Skor ≥ 85% — suspect match",
  },
  MEDIUM: {
    label: "Medium",
    longLabel: "Potential",
    color: "#d69e0f",
    bg: "#fff9e6",
    className: "badge-medium",
    description: "Skor 70–84% — perlu review",
  },
  LOW: {
    label: "Low",
    longLabel: "Low Risk",
    color: "#64748b",
    bg: "#f3f6f9",
    className: "badge-neutral",
    description: "Skor < 70%",
  },
} as const;

export const CASE_STATUS_META: Record<
  CaseStatus,
  { label: string; className: string; color: string }
> = {
  OPEN: { label: "Terbuka", className: "badge-info", color: "#1d5f9f" },
  IN_ANALYSIS: {
    label: "Dalam Analisis",
    className: "badge-violet",
    color: "#6d3cb5",
  },
  PENDING_APPROVAL: {
    label: "Menunggu Approval",
    className: "badge-gold",
    color: "#946b06",
  },
  CLOSED: {
    label: "Selesai",
    className: "badge-clean",
    color: "#087a55",
  },
};

export const APPROVAL_STEP_META: Record<
  ApprovalStep,
  { label: string; short: string; className: string }
> = {
  CHECKER_REVIEW: {
    label: "Review Checker",
    short: "Checker",
    className: "badge-info",
  },
  APPROVER_SIGN_OFF: {
    label: "Tanda Tangan Approver",
    short: "Approver",
    className: "badge-gold",
  },
  COMPLETED: {
    label: "Selesai",
    short: "Selesai",
    className: "badge-clean",
  },
  REJECTED: {
    label: "Ditolak",
    short: "Ditolak",
    className: "badge-critical",
  },
};

export const RECOMMENDATION_META: Record<
  AnalystRecommendation,
  { label: string; className: string }
> = {
  DISMISS_FALSE_POSITIVE: {
    label: "Dismiss — False Positive",
    className: "badge-neutral",
  },
  CONFIRM_HIT: {
    label: "Konfirmasi Hit",
    className: "badge-critical",
  },
  ESCALATE_EDD: {
    label: "Eskalasi EDD",
    className: "badge-gold",
  },
};

export const SOURCE_META: Record<
  SourceCode,
  { label: string; short: string; color: string; bg: string; description: string }
> = {
  DTTOT: {
    label: "DTTOT",
    short: "DTTOT",
    color: "#b42318",
    bg: "#fff1f0",
    description: "Daftar Terduga Teroris dan Organisasi Teroris",
  },
  DPPSPM: {
    label: "DPPSPM",
    short: "DPPSPM",
    color: "#b54a0a",
    bg: "#fff5eb",
    description: "Daftar Pihak yang Dilarang di Sektor Pasar Modal",
  },
  PEP: {
    label: "PEP",
    short: "PEP",
    color: "#6d3cb5",
    bg: "#f7f2ff",
    description: "Politically Exposed Persons",
  },
  UN_SANCTION: {
    label: "UN Sanctions",
    short: "UN",
    color: "#1d5f9f",
    bg: "#eff7ff",
    description: "Konsolidasi sanksi Dewan Keamanan PBB",
  },
};

export const REPORT_STATUS_META = {
  DRAFT: { label: "Draft", className: "badge-neutral" },
  READY_TO_SEND: { label: "Siap Kirim", className: "badge-gold" },
  SUBMITTED: { label: "Terkirim", className: "badge-clean" },
} as const;

export const REPORT_TYPE_META: Record<
  ReportType,
  { label: string; short: string; description: string; icon: string }
> = {
  LTKM_PPATK: {
    label: "LTKM PPATK",
    short: "LTKM",
    description:
      "Laporan Transaksi Keuangan Mencurigakan terkait pendanaan terorisme.",
    icon: "flag",
  },
  SIPESAT_PEMBLOKIRAN: {
    label: "SIPESAT Pemblokiran",
    short: "SIPESAT",
    description:
      "Laporan pemblokiran dana secara serta-merta berdasarkan perintah pengadilan.",
    icon: "freeze",
  },
  BERKALA_OJK: {
    label: "Laporan Berkala OJK",
    short: "OJK",
    description:
      "Rekapitulasi pelaksanaan program APU-PPT dan DTTOT periode berjalan.",
    icon: "chart",
  },
};

export const NAV_ITEMS = [
  { href: "/", label: "Ringkasan", group: "Monitoring" },
  { href: "/smart-search", label: "Smart Search", group: "Monitoring" },
  { href: "/results", label: "Hasil Screening", group: "Monitoring" },
  { href: "/cases", label: "Kasus & Persetujuan", group: "Monitoring" },
  { href: "/customers", label: "Data Nasabah", group: "Manajemen Data" },
  { href: "/dttot", label: "Data DTTOT", group: "Manajemen Data" },
  { href: "/apuppt", label: "Data APUPPT", group: "Manajemen Data" },
  { href: "/matching", label: "Matching Engine", group: "Manajemen Data" },
  { href: "/reports", label: "Laporan Kepatuhan", group: "Tata Kelola" },
  { href: "/admin", label: "Admin Management", group: "Tata Kelola" },
  { href: "/audit", label: "Log System", group: "Tata Kelola" },
] as const;

export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

export function severityClass(severity: string): string {
  return (
    SEVERITY_META[severity as keyof typeof SEVERITY_META]?.className ??
    "badge-neutral"
  );
}

export function roleColor(role: RoleCode): string {
  return ROLE_META[role]?.color ?? "#0f766e";
}
