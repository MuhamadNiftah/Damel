import type {
  CustomerEmployment,
  CustomerProfileStatus,
  CustomerQuality,
  CustomerQualityComponent,
  CustomerRiskRating,
  CustomerTransaction,
  EmploymentStatus,
  MatchSeverity,
  StagedCustomer,
} from "./types";

/* ------------------------- Deterministic demo data ------------------------ */

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
}

function pick<T>(list: readonly T[], seed: number, offset = 0): T {
  return list[(seed + offset) % list.length];
}

const POSITIONS = [
  "Direktur Keuangan",
  "Analis Investasi",
  "Manajer Operasional",
  "Staf Administrasi",
  "Konsultan Pajak",
  "Wirausaha",
  "Dokter",
  "Guru",
  "Perawat",
  "Programmer",
  "Pensiunan",
  "Pedagang",
] as const;

const COMPANIES = [
  "PT Nusantara Investama",
  "PT Sinar Mandiri",
  "CV Berkah Abadi",
  "PT Global Logistik",
  "PT Teknologi Nusantara",
  "Universitas Cendekia",
  "Rumah Sakit Sehat",
  "PT Energi Prima",
  "Koperasi Sejahtera",
  "PT Bumi Sentosa",
] as const;

const SOURCES_OF_FUND = [
  "Gaji / payroll",
  "Hasil usaha",
  "Dividen & investasi",
  "Warisan",
  "Penjualan aset",
  "Imbal hasil portofolio",
] as const;

const COUNTERPARTIES = [
  "PT Bursa Efek Indonesia",
  "RDN Internal",
  "PT Kustodian Sentral Efek Indonesia",
  "Bank Mandiri",
  "Bank BCA",
  "PT Nusantara Investama",
  "Reksa Dana Premier",
] as const;

const BRANCHES = ["JKT-01", "BDG-01", "SBY-01", "MDN-01", "YOG-01"] as const;

const EMPLOYMENT_STATUSES: EmploymentStatus[] = [
  "PERMANENT",
  "PERMANENT",
  "PERMANENT",
  "CONTRACT",
  "SELF_EMPLOYED",
  "RETIRED",
];

export interface GeneratedCustomerProfile {
  occupation: string;
  employer_name: string;
  employment_status: EmploymentStatus;
  employment_history: CustomerEmployment[];
  transactions: CustomerTransaction[];
  risk_rating: CustomerRiskRating;
  profile_status: CustomerProfileStatus;
  onboarded_at: string;
  monthly_income: number;
  source_of_fund: string;
  branch_code: string;
}

const DEMO_NOW = Date.parse("2026-10-20T03:00:00.000Z");

function isoDaysAgo(days: number): string {
  return new Date(DEMO_NOW - days * 86_400_000).toISOString().slice(0, 10);
}

export function generateCustomerProfile(
  customer: Pick<
    StagedCustomer,
    "id" | "raw_full_name" | "customer_type" | "cif_number"
  >,
): GeneratedCustomerProfile {
  const seed = hashString(`${customer.id}:${customer.raw_full_name}:${customer.cif_number}`);
  const corporate = customer.customer_type === "CORPORATE";
  const profileGap = !corporate && seed % 9 === 0;
  const fundingGap = !corporate && seed % 7 === 0;
  const currentYear = 2026;
  const yearsAtCompany = (seed % 9) + 1;
  const startYear = currentYear - yearsAtCompany;
  const employer = corporate
    ? customer.raw_full_name
    : profileGap
      ? ""
      : pick(COMPANIES, seed, 3);
  const occupation = corporate
    ? "Direktur Utama"
    : profileGap
      ? ""
      : pick(POSITIONS, seed, 7);
  const employmentStatus: EmploymentStatus = corporate
    ? "PERMANENT"
    : pick(EMPLOYMENT_STATUSES, seed, 5);

  const employmentHistory: CustomerEmployment[] = profileGap
    ? []
    : [
        {
          id: `${customer.id}-emp-1`,
          company_name: employer,
          position: occupation,
          start_year: startYear,
          end_year: null,
          is_current: true,
        },
      ];

  if (!corporate && !profileGap) {
    const previousStart = startYear - ((seed % 5) + 2);
    employmentHistory.push({
      id: `${customer.id}-emp-2`,
      company_name: pick(COMPANIES, seed, 9),
      position: pick(POSITIONS, seed, 1),
      start_year: previousStart,
      end_year: startYear,
      is_current: false,
    });
    if (seed % 3 === 0) {
      employmentHistory.push({
        id: `${customer.id}-emp-3`,
        company_name: pick(COMPANIES, seed, 14),
        position: pick(POSITIONS, seed, 4),
        start_year: previousStart - 3,
        end_year: previousStart,
        is_current: false,
      });
    }
  }

  const transactionCount = profileGap ? 1 + (seed % 2) : 4 + (seed % 5);
  const transactions: CustomerTransaction[] = Array.from(
    { length: transactionCount },
    (_, index) => {
      const transactionSeed = seed + index * 37;
      const type = pick(
        ["BUY", "SELL", "DEPOSIT", "WITHDRAWAL", "TRANSFER"] as const,
        transactionSeed,
        2,
      );
      const amountBase = corporate
        ? 50_000_000 + (transactionSeed % 400) * 5_000_000
        : 5_000_000 + (transactionSeed % 180) * 1_250_000;
      return {
        id: `${customer.id}-trx-${index + 1}`,
        transaction_date: isoDaysAgo(3 + index * 9 + (seed % 6)),
        transaction_type: type,
        amount: amountBase,
        channel: pick(["RDN", "TELLER", "MOBILE", "ONLINE"] as const, transactionSeed, 1),
        counterparty: pick(COUNTERPARTIES, transactionSeed, 4),
        status: (index === transactionCount - 1 && seed % 4 === 0
          ? "PENDING"
          : "COMPLETED") as CustomerTransaction["status"],
      };
    },
  ).sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));

  const ratingRoll = seed % 100;
  const riskRating: CustomerRiskRating =
    ratingRoll < 10 ? "HIGH" : ratingRoll < 32 ? "MEDIUM" : "LOW";
  const statusRoll = (seed + 11) % 100;
  const profileStatus: CustomerProfileStatus =
    statusRoll < 84 ? "ACTIVE" : statusRoll < 95 ? "DORMANT" : "CLOSED";

  return {
    occupation,
    employer_name: employer,
    employment_status: employmentStatus,
    employment_history: employmentHistory,
    transactions,
    risk_rating: riskRating,
    profile_status: profileStatus,
    onboarded_at: isoDaysAgo(420 + (seed % 2200)),
    monthly_income: profileGap
      ? 0
      : corporate
        ? 250_000_000 + (seed % 40) * 10_000_000
        : 8_000_000 + (seed % 45) * 1_500_000,
    source_of_fund:
      fundingGap || profileGap ? "" : pick(SOURCES_OF_FUND, seed, 6),
    branch_code: pick(BRANCHES, seed, 2),
  };
}

/* ----------------------------- Quality scoring ---------------------------- */

const SEVERITY_WEIGHT: Record<MatchSeverity, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

export function assessCustomerQuality(
  customer: StagedCustomer,
  options: {
    highestSeverity?: MatchSeverity | null;
    openCaseCount?: number;
  } = {},
): CustomerQuality {
  const hasNik = Boolean(customer.national_id_number);
  const hasPassport = Boolean(customer.passport_number);
  const hasDob = Boolean(customer.date_of_birth);
  const hasPob = Boolean(customer.place_of_birth);
  const hasNationality = Boolean(customer.nationality);
  const hasAddress = Boolean(customer.address);
  const hasOccupation = Boolean(customer.occupation);
  const hasEmployer = Boolean(customer.employer_name);
  const historyCount = customer.employment_history?.length ?? 0;
  const transactions = customer.transactions ?? [];
  const transactionCount = transactions.length;
  const recentTransaction = transactions[0]?.transaction_date;
  const recentDays = recentTransaction
    ? Math.max(
        0,
        Math.round((DEMO_NOW - Date.parse(recentTransaction)) / 86_400_000),
      )
    : null;
  const risk = customer.risk_rating ?? "MEDIUM";
  const highest = options.highestSeverity ?? null;
  const openCases = options.openCaseCount ?? 0;

  const identity =
    (hasNik ? 10 : 0) +
    (hasPassport ? 4 : 0) +
    (hasDob ? 6 : 0) +
    (hasPob ? 5 : 0) +
    (hasNationality ? 5 : 0);

  const profile =
    (hasOccupation ? 6 : 0) +
    (hasEmployer ? 6 : 0) +
    (hasAddress ? 4 : 0) +
    (historyCount >= 2 ? 4 : 0);

  const finance =
    ((customer.monthly_income ?? 0) > 0 ? 8 : 0) +
    (customer.source_of_fund ? 6 : 0) +
    (transactionCount >= 3 ? 6 : 0);

  const activity =
    Math.min(8, transactionCount) +
    (recentDays !== null && recentDays <= 30 ? 4 : recentDays !== null && recentDays <= 90 ? 2 : 0) +
    (transactionCount > 0 ? 3 : 0);

  const compliance = (risk === "LOW" ? 8 : risk === "MEDIUM" ? 5 : 2) +
    (openCases === 0 ? 4 : 1) +
    (highest && SEVERITY_WEIGHT[highest] <= 1 ? 0 : 3);

  const components: CustomerQualityComponent[] = [
    {
      key: "identity",
      label: "Kelengkapan identitas",
      score: identity,
      max: 30,
      detail: hasNik
        ? "NIK, tanggal lahir, dan kewarganegaraan terverifikasi."
        : "NIK belum tersedia — verifikasi dokumen diperlukan.",
    },
    {
      key: "profile",
      label: "Profil & pekerjaan",
      score: profile,
      max: 20,
      detail: `${historyCount} riwayat kepegawaian tercatat.`,
    },
    {
      key: "finance",
      label: "Data keuangan",
      score: finance,
      max: 20,
      detail: `Sumber dana: ${customer.source_of_fund ?? "belum diisi"}.`,
    },
    {
      key: "activity",
      label: "Aktivitas transaksi",
      score: activity,
      max: 15,
      detail: `${transactionCount} transaksi, terakhir ${
        recentDays === null ? "tidak tersedia" : `${recentDays} hari lalu`
      }.`,
    },
    {
      key: "compliance",
      label: "Profil risiko & kepatuhan",
      score: compliance,
      max: 15,
      detail:
        openCases > 0
          ? `${openCases} kasus investigasi masih berjalan.`
          : highest
            ? `Profil risiko ${risk === "LOW" ? "rendah" : risk === "MEDIUM" ? "sedang" : "tinggi"} · ada temuan ${highest}.`
            : `Profil risiko ${risk === "LOW" ? "rendah" : risk === "MEDIUM" ? "sedang" : "tinggi"} · tidak ada temuan watchlist.`,
    },
  ];

  const score = components.reduce((sum, item) => sum + item.score, 0);
  const grade: CustomerQuality["grade"] =
    score >= 85 ? "A" : score >= 70 ? "B" : score >= 55 ? "C" : "D";
  const meta: Record<CustomerQuality["grade"], { label: string; color: string }> = {
    A: { label: "Sangat baik", color: "#0f9f6e" },
    B: { label: "Baik", color: "#1d5f9f" },
    C: { label: "Cukup", color: "#d69e0f" },
    D: { label: "Perlu perbaikan", color: "#d92d20" },
  };

  const strengths: string[] = [];
  const gaps: string[] = [];
  if (hasNik && hasDob) strengths.push("Identitas utama lengkap");
  if (historyCount >= 2) strengths.push("Riwayat kepegawaian terdokumentasi");
  if (transactionCount >= 5) strengths.push("Aktivitas transaksi aktif");
  if (customer.source_of_fund) strengths.push("Sumber dana jelas");
  if (risk === "LOW") strengths.push("Profil risiko rendah");

  if (!hasNik) gaps.push("NIK belum terverifikasi");
  if (!hasDob) gaps.push("Tanggal lahir kosong");
  if (!hasOccupation || !hasEmployer) gaps.push("Data pekerjaan belum lengkap");
  if (!customer.source_of_fund) gaps.push("Sumber dana belum diisi");
  if (transactionCount < 3) gaps.push("Riwayat transaksi minim");
  if (risk === "HIGH") gaps.push("Profil risiko tinggi — perlu EDD");
  if (openCases > 0) gaps.push("Terdapat kasus investigasi aktif");
  if (!gaps.length) gaps.push("Tidak ada gap material");

  return {
    score,
    grade,
    label: meta[grade].label,
    color: meta[grade].color,
    components,
    strengths: strengths.slice(0, 3),
    gaps: gaps.slice(0, 3),
  };
}
