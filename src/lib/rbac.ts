import type { RoleCode } from "./types";

export interface AccessModule {
  key: string;
  label: string;
  description: string;
  roles: RoleCode[];
  manageRoles?: RoleCode[];
}

export const ALL_ROLES: RoleCode[] = [
  "MAKER_ANALYST",
  "CHECKER_SUPERVISOR",
  "APPROVER_HEAD",
  "AUDITOR",
  "ADMIN",
];

export const ACCESS_MODULES: AccessModule[] = [
  {
    key: "dashboard",
    label: "Dashboard utama",
    description: "Ringkasan data nasabah, DTTOT, APU-PPT, dan temuan.",
    roles: ALL_ROLES,
  },
  {
    key: "customers",
    label: "Manajemen data nasabah",
    description: "Profil, jabatan, riwayat kepegawaian, dan transaksi.",
    roles: ALL_ROLES,
    manageRoles: ["MAKER_ANALYST", "ADMIN"],
  },
  {
    key: "dttot",
    label: "Manajemen data DTTOT",
    description: "Lihat, impor, dan ekspor daftar DTTOT.",
    roles: ALL_ROLES,
    manageRoles: ["MAKER_ANALYST", "ADMIN"],
  },
  {
    key: "apuppt",
    label: "Manajemen data APU-PPT",
    description: "Lihat, impor, dan ekspor daftar DPPSPM, PEP, UN Sanctions.",
    roles: ALL_ROLES,
    manageRoles: ["MAKER_ANALYST", "ADMIN"],
  },
  {
    key: "search",
    label: "Smart Search",
    description: "Pencarian lintas nasabah, entitas, dan kasus.",
    roles: ALL_ROLES,
  },
  {
    key: "matching",
    label: "Matching engine",
    description: "Sinkronisasi dan penilaian kemiripan nasabah vs watchlist.",
    roles: ALL_ROLES,
    manageRoles: ["MAKER_ANALYST", "ADMIN"],
  },
  {
    key: "cases",
    label: "Kasus & maker-checker",
    description: "Investigasi, verifikasi checker, dan keputusan approver.",
    roles: ALL_ROLES,
    manageRoles: ["MAKER_ANALYST", "CHECKER_SUPERVISOR", "APPROVER_HEAD"],
  },
  {
    key: "reports",
    label: "Pelaporan kepatuhan",
    description: "LTKM, SIPESAT, laporan berkala, dan ekspor regulator.",
    roles: ALL_ROLES,
    manageRoles: ["MAKER_ANALYST", "CHECKER_SUPERVISOR", "APPROVER_HEAD"],
  },
  {
    key: "admin",
    label: "Admin management",
    description: "Role management, status pengguna, dan kontrol akses.",
    roles: ["ADMIN"],
    manageRoles: ["ADMIN"],
  },
  {
    key: "audit",
    label: "Log system",
    description: "Audit trail WORM untuk seluruh aktivitas pengguna.",
    roles: ALL_ROLES,
    manageRoles: ["ADMIN", "AUDITOR"],
  },
];

export function canRoleAccess(moduleKey: string, role: RoleCode): boolean {
  const module = ACCESS_MODULES.find((item) => item.key === moduleKey);
  return module ? module.roles.includes(role) : false;
}
