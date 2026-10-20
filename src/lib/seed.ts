import type {
  AccountFreezeOrder,
  ApprovalRequest,
  AuditLog,
  BatchUpload,
  CaseEvidenceFile,
  CaseNote,
  DatabaseSchema,
  InvestigationCase,
  MatchScoreBreakdown,
  RegulatoryReport,
  ScreeningJob,
  ScreeningMatch,
  StagedCustomer,
  UploadError,
  User,
  WatchlistAlias,
  WatchlistDocument,
  WatchlistEntity,
  WatchlistSource,
  WhitelistRecord,
} from "./types";
import { encryptPII } from "./crypto";
import { generateCustomerProfile } from "./customer-profile";
import { screenCustomers, type MatchCustomerInput } from "./matching";
import { sanitizeName } from "./normalize";

const DAY = 86_400_000;

function at(daysAgo: number, hourUtc = 2, minute = 0): string {
  return new Date(
    Date.UTC(2026, 9, 20 - daysAgo, hourUtc, minute, 0),
  ).toISOString();
}

function hoursAgo(hours: number): string {
  return new Date(Date.parse("2026-10-20T03:00:00.000Z") - hours * 3_600_000).toISOString();
}

const users: User[] = [
  {
    id: "user-analyst",
    username: "rani.pratama",
    email: "rani.pratama@didimax.co.id",
    full_name: "Rani Pratama",
    role_code: "MAKER_ANALYST",
    branch_code: "JKT-01",
    is_active: true,
    avatar_color: "#0f766e",
  },
  {
    id: "user-supervisor",
    username: "dimas.wijaya",
    email: "dimas.wijaya@didimax.co.id",
    full_name: "Dimas Wijaya",
    role_code: "CHECKER_SUPERVISOR",
    branch_code: "JKT-01",
    is_active: true,
    avatar_color: "#1d4ed8",
  },
  {
    id: "user-approver",
    username: "lestari.handayani",
    email: "lestari.handayani@didimax.co.id",
    full_name: "Lestari Handayani",
    role_code: "APPROVER_HEAD",
    branch_code: "HQ",
    is_active: true,
    avatar_color: "#b45309",
  },
  {
    id: "user-auditor",
    username: "bagus.santoso",
    email: "bagus.santoso@didimax.co.id",
    full_name: "Bagus Santoso",
    role_code: "AUDITOR",
    branch_code: "IA",
    is_active: true,
    avatar_color: "#6d28d9",
  },
  {
    id: "user-admin",
    username: "admin.it",
    email: "it@didimax.co.id",
    full_name: "Admin IT",
    role_code: "ADMIN",
    branch_code: "IT",
    is_active: true,
    avatar_color: "#475569",
    created_at: at(540, 2, 0),
    last_login_at: hoursAgo(6),
  },
];

const watchlistSources: WatchlistSource[] = [
  {
    id: "src-dttot-2026-1",
    source_code: "DTTOT",
    version_label: "DTTOT Tahap I Tahun 2026",
    published_by: "PPATK",
    effective_date: "2026-03-14",
    expiry_date: "2026-09-20",
    excel_file_name: "DTTOT_Tahap_I_2026.xlsx",
    uploaded_at: at(220, 2, 15),
    uploaded_by_user_id: "user-supervisor",
    is_current: false,
    notes: "Versi historis, digantikan oleh Tahap II Tahun 2026.",
  },
  {
    id: "src-dttot-2026-2",
    source_code: "DTTOT",
    version_label: "DTTOT Tahap II Tahun 2026",
    published_by: "PPATK",
    effective_date: "2026-09-21",
    expiry_date: null,
    excel_file_name: "DTTOT_Tahap_II_2026.xlsx",
    uploaded_at: at(29, 1, 40),
    uploaded_by_user_id: "user-analyst",
    is_current: true,
    notes: "Pembaruan resmi terakhir. Diterima melalui surat PPATK No. 77/APUPPT/2026.",
  },
  {
    id: "src-dppspm-2026",
    source_code: "DPPSPM",
    version_label: "DPPSPM Semester II Tahun 2026",
    published_by: "OJK",
    effective_date: "2026-07-01",
    expiry_date: null,
    excel_file_name: "DPPSPM_Semester_II_2026.xlsx",
    uploaded_at: at(111, 4, 5),
    uploaded_by_user_id: "user-supervisor",
    is_current: true,
    notes: "Daftar Pihak yang Dilarang untuk Penyediaan Jasa Sektor Pasar Modal.",
  },
  {
    id: "src-pep-2026",
    source_code: "PEP",
    version_label: "PEP OJK - Pembaruan Agustus 2026",
    published_by: "OJK",
    effective_date: "2026-08-10",
    expiry_date: null,
    excel_file_name: "PEP_OJK_Agustus_2026.xlsx",
    uploaded_at: at(71, 6, 20),
    uploaded_by_user_id: "user-analyst",
    is_current: true,
    notes: "Politically Exposed Persons dan pihak yang memiliki hubungan dekat.",
  },
  {
    id: "src-un-2026",
    source_code: "UN_SANCTION",
    version_label: "UN Consolidated List - September 2026",
    published_by: "UN Security Council",
    effective_date: "2026-09-01",
    expiry_date: null,
    excel_file_name: "UN_Consolidated_2026-09.xlsx",
    uploaded_at: at(49, 0, 30),
    uploaded_by_user_id: "user-supervisor",
    is_current: true,
    notes: "Konsolidasi sanksi Dewan Keamanan PBB dan entitas proliferasi.",
  },
];

interface EntitySeed {
  id: string;
  sourceId: string;
  name: string;
  type: "INDIVIDUAL" | "CORPORATE";
  dob: string | null;
  pob: string | null;
  nationality: string | null;
  address: string | null;
  legal: string;
  aliases?: string[];
  aliasesType?: "AKA" | "FKA" | "SPELLING_VARIANT";
  documents?: Array<{
    type: "PASSPORT" | "NIK" | "TAX_ID" | "NATIONAL_ID";
    number: string;
    country: string;
  }>;
}

const entitySeeds: EntitySeed[] = [
  {
    id: "wl-001",
    sourceId: "src-dttot-2026-2",
    name: "Muhammad Syarifuddin",
    type: "INDIVIDUAL",
    dob: "1985-04-12",
    pob: "Poso",
    nationality: "Indonesia",
    address: "Jl. Palu No. 17, Kel. Kawua, Poso, Sulawesi Tengah",
    legal: "Penetapan Pengadilan Negeri Jakarta Pusat No. 12/Pid.Sus/2026",
    aliases: ["Mohamad Sharifuddin", "M. Syarifudin", "Muhammad Sharifudin"],
    documents: [
      { type: "NIK", number: "3201012504850001", country: "ID" },
      { type: "PASSPORT", number: "X1234567", country: "ID" },
    ],
  },
  {
    id: "wl-002",
    sourceId: "src-dttot-2026-2",
    name: "Abdul Rahman Al-Fatih",
    type: "INDIVIDUAL",
    dob: "1979-11-02",
    pob: "Surakarta",
    nationality: "Indonesia",
    address: "Jl. Veteran No. 42, Surakarta, Jawa Tengah",
    legal: "Penetapan Pengadilan Negeri Jakarta Barat No. 18/Pid.Sus/2026",
    aliases: ["Abdurrahman Al Fathi", "Abdul Rachman Al Fathi", "A. R. Al Fatih"],
    aliasesType: "SPELLING_VARIANT",
    documents: [{ type: "PASSPORT", number: "A1234567", country: "ID" }],
  },
  {
    id: "wl-003",
    sourceId: "src-dttot-2026-2",
    name: "Siti Aminah binti Abdullah",
    type: "INDIVIDUAL",
    dob: "1972-06-18",
    pob: "Sragen",
    nationality: "Indonesia",
    address: "Dusun Nglorog, Sragen, Jawa Tengah",
    legal: "Penetapan Pengadilan Negeri Jakarta Pusat No. 21/Pid.Sus/2026",
    aliases: ["Siti Aminah Abdullah", "Aminah binti Abdullah"],
    documents: [{ type: "NIK", number: "3314011806720002", country: "ID" }],
  },
  {
    id: "wl-004",
    sourceId: "src-un-2026",
    name: "Hasan bin Salim Al-Harbi",
    type: "INDIVIDUAL",
    dob: "1968-03-21",
    pob: "Makkah",
    nationality: "Saudi Arabia",
    address: "Al-Aziziyah District, Makkah, Saudi Arabia",
    legal: "UNSC Consolidated List QDi.412 / 2026",
    aliases: ["Hasan Salim Al Harbi", "Hassan Bin Salem", "Abu Salim"],
    documents: [{ type: "PASSPORT", number: "SA998877", country: "SA" }],
  },
  {
    id: "wl-005",
    sourceId: "src-dppspm-2026",
    name: "Global Waqf Foundation",
    type: "CORPORATE",
    dob: null,
    pob: "Jakarta",
    nationality: "Indonesia",
    address: "Menara Kuningan Lt. 9, Jl. HR Rasuna Said, Jakarta Selatan",
    legal: "DPPSPM OJK No. 7/DPPSPM/2026",
    aliases: ["Yayasan Waqf Global", "Global Waqf", "GWF"],
    documents: [{ type: "TAX_ID", number: "012345678901000", country: "ID" }],
  },
  {
    id: "wl-006",
    sourceId: "src-dttot-2026-2",
    name: "Ahmad Fauzan",
    type: "INDIVIDUAL",
    dob: "1988-07-14",
    pob: "Depok",
    nationality: "Indonesia",
    address: "Jl. Margonda Raya No. 88, Depok, Jawa Barat",
    legal: "Penetapan Pengadilan Negeri Depok No. 04/Pid.Sus/2026",
    aliases: ["Ahmad Fauzan bin Suryadi", "A. Fauzan"],
    documents: [{ type: "NIK", number: "3276011407880003", country: "ID" }],
  },
  {
    id: "wl-007",
    sourceId: "src-dttot-2026-2",
    name: "Muhammad Rizki",
    type: "INDIVIDUAL",
    dob: "1990-01-10",
    pob: "Bekasi",
    nationality: "Indonesia",
    address: "Jl. Ahmad Yani No. 55, Bekasi, Jawa Barat",
    legal: "Penetapan Pengadilan Negeri Bekasi No. 09/Pid.Sus/2026",
    aliases: ["M. Rizki", "Muhammad Rizky", "Rizki bin Hasan"],
    aliasesType: "SPELLING_VARIANT",
    documents: [{ type: "NIK", number: "3275011001900004", country: "ID" }],
  },
  {
    id: "wl-008",
    sourceId: "src-dttot-2026-2",
    name: "Fatimah Az-Zahra",
    type: "INDIVIDUAL",
    dob: "1988-12-05",
    pob: "Bandung",
    nationality: "Indonesia",
    address: "Jl. Soekarno Hatta No. 301, Bandung, Jawa Barat",
    legal: "Penetapan Pengadilan Negeri Bandung No. 15/Pid.Sus/2026",
    aliases: ["Fatimah Zahra", "Fatimah Az Zahra", "F. Az-Zahra"],
    documents: [{ type: "NIK", number: "3273010512880005", country: "ID" }],
  },
  {
    id: "wl-009",
    sourceId: "src-pep-2026",
    name: "Budi Santoso",
    type: "INDIVIDUAL",
    dob: "1975-08-17",
    pob: "Semarang",
    nationality: "Indonesia",
    address: "Jl. Diponegoro No. 12, Menteng, Jakarta Pusat",
    legal: "PEP OJK — Anggota DPR RI Periode 2024–2029",
    aliases: ["Ir. Budi Santoso, M.M.", "Budi Santoso M.M."],
    documents: [{ type: "NIK", number: "3374011708750006", country: "ID" }],
  },
  {
    id: "wl-010",
    sourceId: "src-dttot-2026-2",
    name: "Abdullah Umar Al-Bakri",
    type: "INDIVIDUAL",
    dob: "1982-02-27",
    pob: "Surabaya",
    nationality: "Indonesia",
    address: "Jl. Wonokromo No. 91, Surabaya, Jawa Timur",
    legal: "Penetapan Pengadilan Negeri Surabaya No. 22/Pid.Sus/2026",
    aliases: ["Abdullah Umar", "Umar Al Bakri", "Abu Umar"],
    documents: [{ type: "NIK", number: "3578012702820007", country: "ID" }],
  },
  {
    id: "wl-011",
    sourceId: "src-dppspm-2026",
    name: "PT Bumi Logistik Nusantara",
    type: "CORPORATE",
    dob: null,
    pob: "Jakarta",
    nationality: "Indonesia",
    address: "Gedung Menara Hijau Lt. 12, Jl. MT Haryono, Jakarta Selatan",
    legal: "DPPSPM OJK No. 11/DPPSPM/2026",
    aliases: ["Bumi Logistik", "BLN", "Bumi Logistik Nusantara"],
    documents: [{ type: "TAX_ID", number: "098765432101000", country: "ID" }],
  },
  {
    id: "wl-012",
    sourceId: "src-un-2026",
    name: "Ibrahim Al-Masri",
    type: "INDIVIDUAL",
    dob: "1970-09-09",
    pob: "Aleppo",
    nationality: "Syria",
    address: "Aleppo, Syrian Arab Republic",
    legal: "UNSC Consolidated List QDi.388 / 2026",
    aliases: ["Abu Ibrahim", "Ibrahim Al Masri"],
    documents: [{ type: "PASSPORT", number: "SY771234", country: "SY" }],
  },
];

const watchlistEntities: WatchlistEntity[] = entitySeeds.map((seed) => ({
  id: seed.id,
  source_id: seed.sourceId,
  entity_type: seed.type,
  primary_name: seed.name,
  clean_primary_name: sanitizeName(seed.name),
  date_of_birth: seed.dob,
  place_of_birth: seed.pob,
  nationality: seed.nationality,
  address_info: seed.address,
  legal_reference: seed.legal,
  is_active: true,
  created_at: at(29, 1, 45),
}));

const watchlistAliases: WatchlistAlias[] = entitySeeds.flatMap((seed) =>
  (seed.aliases ?? []).map((alias, index) => ({
    id: `alias-${seed.id}-${index + 1}`,
    entity_id: seed.id,
    alias_name: alias,
    clean_alias_name: sanitizeName(alias),
    alias_type: seed.aliasesType ?? "AKA",
  })),
);

const watchlistDocuments: WatchlistDocument[] = entitySeeds.flatMap((seed) =>
  (seed.documents ?? []).map((document, index) => ({
    id: `doc-${seed.id}-${index + 1}`,
    entity_id: seed.id,
    document_type: document.type,
    document_number: document.number,
    issuing_country: document.country,
  })),
);

interface CustomerSeed {
  id: string;
  name: string;
  nik: string;
  passport: string;
  dob: string;
  pob: string;
  nationality: string;
  address: string;
  type: "INDIVIDUAL" | "CORPORATE";
}

const specialCustomers: CustomerSeed[] = [
  {
    id: "cust-001",
    name: "Muhammad Syarifuddin",
    nik: "3201012504850001",
    passport: "X1234567",
    dob: "1985-04-12",
    pob: "Poso",
    nationality: "Indonesia",
    address: "Jl. Palu No. 19, Poso, Sulawesi Tengah",
    type: "INDIVIDUAL",
  },
  {
    id: "cust-002",
    name: "Mohamad Syarifudin",
    nik: "3201011204850002",
    passport: "",
    dob: "1985-04-12",
    pob: "Poso",
    nationality: "Indonesia",
    address: "Jl. Trans Sulawesi KM 4, Poso",
    type: "INDIVIDUAL",
  },
  {
    id: "cust-003",
    name: "Abdul Rachman Al Fathi",
    nik: "3372010211790003",
    passport: "",
    dob: "1979-11-02",
    pob: "Surakarta",
    nationality: "Indonesia",
    address: "Jl. Slamet Riyadi No. 201, Surakarta",
    type: "INDIVIDUAL",
  },
  {
    id: "cust-004",
    name: "Siti Aminah Abdullah",
    nik: "3314015806720004",
    passport: "",
    dob: "1972-06-18",
    pob: "Sragen",
    nationality: "Indonesia",
    address: "Dusun Nglorog RT 03, Sragen",
    type: "INDIVIDUAL",
  },
  {
    id: "cust-005",
    name: "Hasan Salim",
    nik: "",
    passport: "SA110022",
    dob: "1968-03-21",
    pob: "Makkah",
    nationality: "Saudi Arabia",
    address: "Jl. Kebon Jeruk No. 8, Jakarta Barat",
    type: "INDIVIDUAL",
  },
  {
    id: "cust-006",
    name: "Ahmad Fauzan",
    nik: "3276011407880003",
    passport: "",
    dob: "1988-07-14",
    pob: "Depok",
    nationality: "Indonesia",
    address: "Jl. Margonda Raya No. 90, Depok",
    type: "INDIVIDUAL",
  },
  {
    id: "cust-007",
    name: "Muhammad Rizky",
    nik: "3275011001900099",
    passport: "",
    dob: "1990-01-10",
    pob: "Bekasi",
    nationality: "Indonesia",
    address: "Jl. Ahmad Yani No. 57, Bekasi",
    type: "INDIVIDUAL",
  },
  {
    id: "cust-008",
    name: "Fatimah Zahra",
    nik: "3273014512880008",
    passport: "",
    dob: "1988-12-05",
    pob: "Bandung",
    nationality: "Indonesia",
    address: "Jl. Soekarno Hatta No. 305, Bandung",
    type: "INDIVIDUAL",
  },
  {
    id: "cust-009",
    name: "Budi Santoso",
    nik: "3374011708750099",
    passport: "",
    dob: "1975-08-17",
    pob: "Semarang",
    nationality: "Indonesia",
    address: "Jl. Diponegoro No. 14, Menteng, Jakarta Pusat",
    type: "INDIVIDUAL",
  },
  {
    id: "cust-010",
    name: "Ahmad Fauzi",
    nik: "3276011407880010",
    passport: "",
    dob: "1988-07-14",
    pob: "Bogor",
    nationality: "Indonesia",
    address: "Jl. Pajajaran No. 22, Bogor",
    type: "INDIVIDUAL",
  },
  {
    id: "cust-011",
    name: "M. Syarifudin",
    nik: "3201010101900011",
    passport: "",
    dob: "1985-04-12",
    pob: "Poso",
    nationality: "Indonesia",
    address: "Jl. Ahmad Yani No. 3, Poso",
    type: "INDIVIDUAL",
  },
  {
    id: "cust-012",
    name: "Abdullah Umar",
    nik: "3578012702820099",
    passport: "",
    dob: "1982-02-27",
    pob: "Surabaya",
    nationality: "Indonesia",
    address: "Jl. Wonokromo No. 93, Surabaya",
    type: "INDIVIDUAL",
  },
];

const cleanNames = [
  "Andi Pratama",
  "Dewi Lestari",
  "Fajar Nugroho",
  "Rina Wulandari",
  "Agus Setiawan",
  "Nur Aisyah",
  "Hendra Gunawan",
  "Maya Sari",
  "Rizky Ramadhan",
  "Putri Maharani",
  "Bayu Saputra",
  "Intan Permata",
  "Dimas Anggara",
  "Ayu Lestari",
  "Reza Maulana",
  "Sinta Dewi",
  "Arif Hidayat",
  "Nadia Safitri",
  "Yoga Pratama",
  "Citra Kirana",
  "Eko Prasetyo",
  "Fitri Handayani",
  "Galih Purnama",
  "Hana Aprilia",
  "Indra Kusuma",
  "Jihan Salsabila",
  "Kevin Tanuwijaya",
  "Lina Marlina",
  "Miko Saputra",
  "Nabila Zahra",
  "Oscar Simbolon",
  "Prisca Wibowo",
  "Qori Anwar",
  "Rangga Aditya",
  "Salsabila Putri",
];

const cleanCities = [
  "Jakarta",
  "Bandung",
  "Surabaya",
  "Medan",
  "Yogyakarta",
  "Semarang",
  "Makassar",
  "Denpasar",
];

const cleanCustomers: CustomerSeed[] = cleanNames.map((name, index) => {
  const sequence = index + 13;
  const year = 1978 + (index % 22);
  const month = (index % 12) + 1;
  const day = (index % 26) + 1;
  return {
    id: `cust-${String(sequence).padStart(3, "0")}`,
    name,
    nik: `31710${String(sequence).padStart(3, "0")}${String(month).padStart(2, "0")}${String(year).slice(2)}${String(day).padStart(2, "0")}01`,
    passport: "",
    dob: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
    pob: cleanCities[index % cleanCities.length],
    nationality: "Indonesia",
    address: `Jl. Melati No. ${index + 5}, ${cleanCities[index % cleanCities.length]}`,
    type: "INDIVIDUAL",
  };
});

const corporateCustomer: CustomerSeed = {
  id: "cust-048",
  name: "Global Waqf Foundation",
  nik: "",
  passport: "",
  dob: "",
  pob: "Jakarta",
  nationality: "Indonesia",
  address: "Jl. HR Rasuna Said Blok X-5, Jakarta Selatan",
  type: "CORPORATE",
};

const customerSeeds = [...specialCustomers, ...cleanCustomers, corporateCustomer];

const batchId = "batch-2026-10-001";
const stagedCustomers: StagedCustomer[] = customerSeeds.map((seed, index) => {
  const base = {
    id: seed.id,
    batch_id: batchId,
    cif_number: `CIF-2026-${String(1001 + index)}`,
    account_number: encryptPII(`14000${String(100000 + index)}`),
    raw_full_name: seed.name,
    sanitized_full_name: sanitizeName(seed.name),
    national_id_number: encryptPII(seed.nik),
    passport_number: seed.passport,
    date_of_birth: seed.dob,
    place_of_birth: seed.pob,
    nationality: seed.nationality,
    address: seed.address,
    customer_type: seed.type,
    staged_at: hoursAgo(3),
  } satisfies StagedCustomer;
  return { ...base, ...generateCustomerProfile(base) };
});

const batchUploads: BatchUpload[] = [
  {
    id: batchId,
    batch_number: "BATCH-2026-1020-001",
    original_filename: "Nasabah_Aktif_Okt2026.xlsx",
    total_records: 52,
    valid_records: 48,
    error_records: 4,
    upload_status: "PROCESSED",
    uploaded_by_user_id: "user-analyst",
    created_at: hoursAgo(4),
    completed_at: hoursAgo(2.5),
  },
  {
    id: "batch-2026-09-002",
    batch_number: "BATCH-2026-0915-002",
    original_filename: "Rekening_Aktif_September.xlsx",
    total_records: 1200,
    valid_records: 1197,
    error_records: 3,
    upload_status: "PROCESSED",
    uploaded_by_user_id: "user-supervisor",
    created_at: at(35, 3, 20),
    completed_at: at(35, 4, 5),
  },
];

const uploadErrors: UploadError[] = [
  {
    id: "err-001",
    batch_id: batchId,
    row_number: 49,
    column_name: "NIK",
    error_reason: "NIK tidak valid — harus tepat 16 digit numerik.",
    raw_payload: '{"nama":"Ahmad Yani","nik":"317101010190001"}',
  },
  {
    id: "err-002",
    batch_id: batchId,
    row_number: 50,
    column_name: "Tanggal Lahir",
    error_reason: "Format tanggal tidak dapat diparse.",
    raw_payload: '{"nama":"Sri Wahyuni","tanggal_lahir":"31/02/1990"}',
  },
  {
    id: "err-003",
    batch_id: batchId,
    row_number: 51,
    column_name: "Nama Lengkap",
    error_reason: "Nama lengkap wajib diisi.",
    raw_payload: '{"nama":"","nik":"3171010101900055"}',
  },
  {
    id: "err-004",
    batch_id: batchId,
    row_number: 52,
    column_name: "CIF",
    error_reason: "CIF duplikat dengan baris 8.",
    raw_payload: '{"nama":"Duplikat CIF","cif":"CIF-2026-1008"}',
  },
];

const whitelistRecords: WhitelistRecord[] = [
  {
    id: "whitelist-001",
    entity_id: "wl-001",
    customer_cif: "CIF-2026-1011",
    reason:
      "Hasil verifikasi biometrik e-KTP dan wawancara cabang: nama mirip, namun DOB/nomor identitas berbeda dan bukan pihak yang sama. Nasabah adalah wiraswasta di Poso dengan rekam jejak transaksi normal.",
    approved_by_user_id: "user-approver",
    whitelisted_at: at(2, 6, 30),
  },
];

const matchInputs: MatchCustomerInput[] = stagedCustomers.map((customer, index) => ({
  id: customer.id,
  cif_number: customer.cif_number,
  national_id_number: customer.national_id_number
    ? customerSeeds[index].nik
    : "",
  passport_number: customer.passport_number,
  raw_full_name: customer.raw_full_name,
  date_of_birth: customer.date_of_birth,
  place_of_birth: customer.place_of_birth,
  nationality: customer.nationality,
  customer_type: customer.customer_type,
}));

const matchDrafts = screenCustomers(
  matchInputs,
  watchlistEntities,
  watchlistAliases,
  watchlistDocuments,
  whitelistRecords,
  70,
);

const jobId = "job-2026-10-001";
const screeningJobs: ScreeningJob[] = [
  {
    id: jobId,
    batch_id: batchId,
    job_status: "COMPLETED",
    total_evaluated: 48,
    total_hits: matchDrafts.length,
    min_threshold_used: 70,
    started_at: hoursAgo(2.9),
    finished_at: hoursAgo(2.8),
    triggered_by_user_id: "user-analyst",
  },
  {
    id: "job-2026-09-002",
    batch_id: "batch-2026-09-002",
    job_status: "COMPLETED",
    total_evaluated: 1197,
    total_hits: 0,
    min_threshold_used: 70,
    started_at: at(35, 4, 0),
    finished_at: at(35, 4, 5),
    triggered_by_user_id: "user-supervisor",
  },
];

const screeningMatches: ScreeningMatch[] = matchDrafts.map((draft, index) => ({
  id: `match-${String(index + 1).padStart(3, "0")}`,
  job_id: jobId,
  staged_customer_id: draft.staged_customer_id,
  watchlist_entity_id: draft.watchlist_entity_id,
  total_confidence_score: draft.total_confidence_score,
  match_severity: draft.match_severity,
  is_exact_identity_match: draft.is_exact_identity_match,
  is_whitelisted: draft.is_whitelisted,
  matched_at: hoursAgo(2.7),
}));

const matchScoreBreakdowns: MatchScoreBreakdown[] = matchDrafts.map(
  (draft, index) => ({
    id: `breakdown-${String(index + 1).padStart(3, "0")}`,
    screening_match_id: screeningMatches[index].id,
    name_similarity_score: draft.breakdown.name_similarity_score,
    dob_match_score: draft.breakdown.dob_match_score,
    pob_match_score: draft.breakdown.pob_match_score,
    nationality_match_score: draft.breakdown.nationality_match_score,
    matched_on_alias: draft.breakdown.matched_on_alias,
    algorithm_telemetry: draft.breakdown.algorithm_telemetry,
  }),
);

function matchForCustomer(customerId: string): string {
  const match = screeningMatches.find(
    (item) => item.staged_customer_id === customerId,
  );
  if (!match) throw new Error(`No screening match for ${customerId}`);
  return match.id;
}

const caseDefinitions: Array<{
  id: string;
  caseNumber: string;
  customerId: string;
  status: InvestigationCase["case_status"];
  recommendation: InvestigationCase["analyst_recommendation"];
  openedDaysAgo: number;
  closedDaysAgo: number | null;
  priority: "NORMAL" | "HIGH";
  analyst: string;
}> = [
  {
    id: "case-001",
    caseNumber: "CASE/APUPPT/2026/10/001",
    customerId: "cust-001",
    status: "CLOSED",
    recommendation: "CONFIRM_HIT",
    openedDaysAgo: 8,
    closedDaysAgo: 3,
    priority: "HIGH",
    analyst: "user-analyst",
  },
  {
    id: "case-002",
    caseNumber: "CASE/APUPPT/2026/10/002",
    customerId: "cust-006",
    status: "PENDING_APPROVAL",
    recommendation: "CONFIRM_HIT",
    openedDaysAgo: 2,
    closedDaysAgo: null,
    priority: "HIGH",
    analyst: "user-analyst",
  },
  {
    id: "case-003",
    caseNumber: "CASE/APUPPT/2026/10/003",
    customerId: "cust-003",
    status: "PENDING_APPROVAL",
    recommendation: "CONFIRM_HIT",
    openedDaysAgo: 3,
    closedDaysAgo: null,
    priority: "HIGH",
    analyst: "user-analyst",
  },
  {
    id: "case-004",
    caseNumber: "CASE/APUPPT/2026/10/004",
    customerId: "cust-008",
    status: "IN_ANALYSIS",
    recommendation: "DISMISS_FALSE_POSITIVE",
    openedDaysAgo: 2,
    closedDaysAgo: null,
    priority: "NORMAL",
    analyst: "user-analyst",
  },
  {
    id: "case-005",
    caseNumber: "CASE/APUPPT/2026/10/005",
    customerId: "cust-009",
    status: "OPEN",
    recommendation: "ESCALATE_EDD",
    openedDaysAgo: 1,
    closedDaysAgo: null,
    priority: "HIGH",
    analyst: "user-analyst",
  },
];

const investigationCases: InvestigationCase[] = caseDefinitions.map((definition) => ({
  id: definition.id,
  case_number: definition.caseNumber,
  screening_match_id: matchForCustomer(definition.customerId),
  case_status: definition.status,
  analyst_recommendation: definition.recommendation,
  assigned_analyst_id: definition.analyst,
  opened_at: at(definition.openedDaysAgo, 4, 10),
  closed_at:
    definition.closedDaysAgo === null
      ? null
      : at(definition.closedDaysAgo, 8, 20),
  priority: definition.priority,
}));

const caseNotes: CaseNote[] = [
  {
    id: "note-001",
    case_id: "case-001",
    author_user_id: "user-analyst",
    note_content:
      "NIK dan nama primer 100% identik dengan entitas DTTOT. Pemilik rekening mengonfirmasi identitas saat verifikasi cabang. Dokumen KTP asli telah dipindai.",
    note_type: "INTERNAL_ANALYSIS",
    created_at: at(7, 4, 25),
  },
  {
    id: "note-002",
    case_id: "case-001",
    author_user_id: "user-analyst",
    note_content:
      "Verifikasi telepon dengan cabang Poso: rekening aktif digunakan untuk transaksi saham. Tidak ada aktivitas mencurigakan lain dalam 6 bulan terakhir.",
    note_type: "VERIFICATION_CALL",
    created_at: at(6, 3, 45),
  },
  {
    id: "note-003",
    case_id: "case-001",
    author_user_id: "user-supervisor",
    note_content:
      "Kelengkapan bukti sesuai SOP. Identitas terbukti match. Diteruskan ke Compliance Head untuk penetapan Confirmed Hit dan pemblokiran.",
    note_type: "INTERNAL_ANALYSIS",
    created_at: at(4, 7, 10),
  },
  {
    id: "note-004",
    case_id: "case-002",
    author_user_id: "user-analyst",
    note_content:
      "NIK persis sama dengan entitas DTTOT. Rekening memiliki saldo Rp 412.500.000. Diajukan pemblokiran segera setelah persetujuan.",
    note_type: "INTERNAL_ANALYSIS",
    created_at: at(2, 5, 5),
  },
  {
    id: "note-005",
    case_id: "case-002",
    author_user_id: "user-supervisor",
    note_content:
      "Dokumen KTP dan passport sudah cocok. Checker menyetujui, menunggu tanda tangan Compliance Head.",
    note_type: "INTERNAL_ANALYSIS",
    created_at: at(1, 3, 30),
  },
  {
    id: "note-006",
    case_id: "case-003",
    author_user_id: "user-analyst",
    note_content:
      "Nama dan tanggal lahir identik dengan alias DTTOT. Perbedaan nomor paspor perlu dikonfirmasi melalui wawancara tambahan.",
    note_type: "INTERNAL_ANALYSIS",
    created_at: at(3, 6, 0),
  },
  {
    id: "note-007",
    case_id: "case-004",
    author_user_id: "user-analyst",
    note_content:
      "Nama mirip namun tanggal lahir dan tempat lahir berbeda. Nasabah telah menyerahkan KTP dan KK; direkomendasikan false positive.",
    note_type: "INTERNAL_ANALYSIS",
    created_at: at(2, 2, 15),
  },
  {
    id: "note-008",
    case_id: "case-005",
    author_user_id: "user-analyst",
    note_content:
      "Entitas berasal dari daftar PEP, bukan DTTOT. Diperlukan Enhanced Due Diligence sesuai POJK 8/2023 sebelum keputusan akhir.",
    note_type: "INTERNAL_ANALYSIS",
    created_at: at(1, 5, 40),
  },
];

const caseEvidenceFiles: CaseEvidenceFile[] = [
  {
    id: "evidence-001",
    case_id: "case-001",
    file_name: "KTP_Muhammad_Syarifuddin.jpg",
    file_type: "KTP_SCAN",
    storage_path: "/secure/evidence/case-001/ktp.jpg",
    file_size_bytes: 842_331,
    uploaded_at: at(7, 4, 30),
  },
  {
    id: "evidence-002",
    case_id: "case-001",
    file_name: "Kartu_Keluarga.pdf",
    file_type: "KK_SCAN",
    storage_path: "/secure/evidence/case-001/kk.pdf",
    file_size_bytes: 1_204_512,
    uploaded_at: at(7, 4, 35),
  },
  {
    id: "evidence-003",
    case_id: "case-002",
    file_name: "KTP_Ahmad_Fauzan.jpg",
    file_type: "KTP_SCAN",
    storage_path: "/secure/evidence/case-002/ktp.jpg",
    file_size_bytes: 760_812,
    uploaded_at: at(2, 5, 10),
  },
  {
    id: "evidence-004",
    case_id: "case-002",
    file_name: "Passport_Ahmad_Fauzan.pdf",
    file_type: "PASSPORT_SCAN",
    storage_path: "/secure/evidence/case-002/passport.pdf",
    file_size_bytes: 980_221,
    uploaded_at: at(2, 5, 12),
  },
  {
    id: "evidence-005",
    case_id: "case-003",
    file_name: "KTP_Abdul_Rachman.jpg",
    file_type: "KTP_SCAN",
    storage_path: "/secure/evidence/case-003/ktp.jpg",
    file_size_bytes: 812_334,
    uploaded_at: at(3, 6, 5),
  },
  {
    id: "evidence-006",
    case_id: "case-004",
    file_name: "Tagihan_Listrik_Fatimah.pdf",
    file_type: "UTILITY_BILL",
    storage_path: "/secure/evidence/case-004/utility.pdf",
    file_size_bytes: 334_221,
    uploaded_at: at(2, 2, 20),
  },
];

const approvalRequests: ApprovalRequest[] = [
  {
    id: "approval-001",
    case_id: "case-001",
    maker_user_id: "user-analyst",
    checker_user_id: "user-supervisor",
    approver_user_id: "user-approver",
    current_step: "COMPLETED",
    final_verdict: "CONFIRMED_TERRORIST_HIT",
    decision_reason:
      "Identitas 100% match dengan DTTOT. Pemblokiran rekening dijalankan sesuai UU TPPT dan SIPESAT.",
    submitted_at: at(5, 4, 0),
    decided_at: at(3, 8, 20),
  },
  {
    id: "approval-002",
    case_id: "case-002",
    maker_user_id: "user-analyst",
    checker_user_id: "user-supervisor",
    approver_user_id: "user-approver",
    current_step: "APPROVER_SIGN_OFF",
    final_verdict: null,
    decision_reason:
      "Checker menyetujui kelengkapan bukti. Menunggu keputusan akhir Compliance Head.",
    submitted_at: at(2, 4, 0),
    decided_at: null,
  },
  {
    id: "approval-003",
    case_id: "case-003",
    maker_user_id: "user-analyst",
    checker_user_id: "user-supervisor",
    approver_user_id: "user-approver",
    current_step: "CHECKER_REVIEW",
    final_verdict: null,
    decision_reason: "Menunggu review kelengkapan dokumen oleh Checker.",
    submitted_at: at(1, 6, 0),
    decided_at: null,
  },
];

const accountFreezeOrders: AccountFreezeOrder[] = [
  {
    id: "freeze-001",
    case_id: "case-001",
    cif_number: "CIF-2026-1001",
    account_number: encryptPII("14000100000"),
    legal_warrant_number: "SPRIN/122/X/2026/DITTIP",
    total_balance_frozen: 875_000_000,
    freeze_status: "ACTIVE_FROZEN",
    frozen_at: at(3, 8, 25),
    lifted_at: null,
    freeze_reason:
      "Confirmed hit DTTOT — perintah pemblokiran serta-merta berdasarkan penetapan pengadilan.",
  },
];

const auditLogs: AuditLog[] = [
  {
    id: "audit-001",
    user_id: "user-analyst",
    action_name: "UPLOAD_BATCH",
    module_name: "SCREENING",
    ip_address: "10.10.24.18",
    user_agent: "Chrome 142 / Windows 11",
    state_before: null,
    state_after: {
      batch_number: "BATCH-2026-1020-001",
      total_records: 52,
      valid_records: 48,
    },
    timestamp: hoursAgo(4),
    description: "Mengunggah file Nasabah_Aktif_Okt2026.xlsx (52 baris).",
  },
  {
    id: "audit-002",
    user_id: "user-analyst",
    action_name: "RUN_SCREENING",
    module_name: "SCREENING",
    ip_address: "10.10.24.18",
    user_agent: "Chrome 142 / Windows 11",
    state_before: { job_status: "QUEUED" },
    state_after: {
      job_status: "COMPLETED",
      total_evaluated: 48,
      total_hits: matchDrafts.length,
    },
    timestamp: hoursAgo(2.8),
    description: "Menjalankan smart matching engine untuk batch BATCH-2026-1020-001.",
  },
  {
    id: "audit-003",
    user_id: "user-analyst",
    action_name: "VIEW_CASE",
    module_name: "CASE_MGMT",
    ip_address: "10.10.24.18",
    user_agent: "Chrome 142 / Windows 11",
    state_before: null,
    state_after: { case_id: "case-001" },
    timestamp: at(8, 4, 12),
    description: "Membuka kasus CASE/APUPPT/2026/10/001.",
  },
  {
    id: "audit-004",
    user_id: "user-analyst",
    action_name: "ADD_CASE_NOTE",
    module_name: "CASE_MGMT",
    ip_address: "10.10.24.18",
    user_agent: "Chrome 142 / Windows 11",
    state_before: { notes_count: 0 },
    state_after: { notes_count: 1, note_type: "INTERNAL_ANALYSIS" },
    timestamp: at(7, 4, 25),
    description: "Menambahkan catatan analisis pada kasus case-001.",
  },
  {
    id: "audit-005",
    user_id: "user-supervisor",
    action_name: "CHECKER_APPROVE",
    module_name: "CASE_MGMT",
    ip_address: "10.10.24.20",
    user_agent: "Edge 142 / Windows 11",
    state_before: { current_step: "CHECKER_REVIEW" },
    state_after: { current_step: "APPROVER_SIGN_OFF" },
    timestamp: at(4, 7, 15),
    description: "Checker menyetujui kelengkapan bukti kasus case-001.",
  },
  {
    id: "audit-006",
    user_id: "user-approver",
    action_name: "APPROVE_HIT",
    module_name: "CASE_MGMT",
    ip_address: "10.10.2.5",
    user_agent: "Chrome 142 / macOS",
    state_before: { current_step: "APPROVER_SIGN_OFF", verdict: null },
    state_after: {
      current_step: "COMPLETED",
      verdict: "CONFIRMED_TERRORIST_HIT",
    },
    timestamp: at(3, 8, 20),
    description: "Compliance Head menetapkan Confirmed Hit untuk case-001.",
  },
  {
    id: "audit-007",
    user_id: "user-approver",
    action_name: "APPROVE_FREEZE",
    module_name: "CASE_MGMT",
    ip_address: "10.10.2.5",
    user_agent: "Chrome 142 / macOS",
    state_before: { freeze_status: null },
    state_after: {
      freeze_status: "ACTIVE_FROZEN",
      account_number: "•••• •••• 0000",
      legal_warrant_number: "SPRIN/122/X/2026/DITTIP",
    },
    timestamp: at(3, 8, 25),
    description: "Menerbitkan perintah pemblokiran rekening CIF-2026-1001.",
  },
  {
    id: "audit-008",
    user_id: "user-approver",
    action_name: "APPROVE_WHITELIST",
    module_name: "WATCHLIST",
    ip_address: "10.10.2.5",
    user_agent: "Chrome 142 / macOS",
    state_before: { whitelist_records: 0 },
    state_after: { whitelist_records: 1, customer_cif: "CIF-2026-1011" },
    timestamp: at(2, 6, 30),
    description: "Menyetujui whitelist false positive untuk CIF-2026-1011.",
  },
  {
    id: "audit-009",
    user_id: "user-auditor",
    action_name: "EXPORT_AUDIT",
    module_name: "REPORTING",
    ip_address: "10.10.8.11",
    user_agent: "Firefox 141 / Windows 11",
    state_before: null,
    state_after: { export_type: "XLSX", records: matchDrafts.length },
    timestamp: at(1, 2, 0),
    description: "Mengekspor rekapitulasi hasil screening untuk audit OJK.",
  },
  {
    id: "audit-010",
    user_id: "user-analyst",
    action_name: "SUBMIT_APPROVAL",
    module_name: "CASE_MGMT",
    ip_address: "10.10.24.18",
    user_agent: "Chrome 142 / Windows 11",
    state_before: { case_status: "OPEN" },
    state_after: { case_status: "PENDING_APPROVAL", step: "CHECKER_REVIEW" },
    timestamp: at(1, 6, 0),
    description: "Mengajukan approval maker-checker untuk kasus case-003.",
  },
  {
    id: "audit-011",
    user_id: "user-auditor",
    action_name: "VIEW_AUDIT",
    module_name: "REPORTING",
    ip_address: "10.10.8.11",
    user_agent: "Firefox 141 / Windows 11",
    state_before: null,
    state_after: { page: "AUDIT_TRAIL" },
    timestamp: hoursAgo(6),
    description: "Meninjau audit trail modul case management.",
  },
  {
    id: "audit-012",
    user_id: "user-supervisor",
    action_name: "VIEW_CASE",
    module_name: "CASE_MGMT",
    ip_address: "10.10.24.20",
    user_agent: "Edge 142 / Windows 11",
    state_before: null,
    state_after: { case_id: "case-002" },
    timestamp: at(1, 3, 25),
    description: "Meninjau kasus CASE/APUPPT/2026/10/002 sebelum approval.",
  },
];

const regulatoryReports: RegulatoryReport[] = [
  {
    id: "report-001",
    case_id: "case-001",
    report_type: "SIPESAT_PEMBLOKIRAN",
    reference_number: "SIPESAT/DMB/2026/10/001",
    xml_payload_content: `<?xml version="1.0" encoding="UTF-8"?>
<SIPESAT>
  <Header><Institution>PT DIDI MAX BERJANGKA</Institution><ReportDate>2026-10-17</ReportDate></Header>
  <PihakTerlapor><Nama>Muhammad Syarifuddin</Nama><CIF>CIF-2026-1001</CIF><NIK>3201 •••• •••• 0001</NIK></PihakTerlapor>
  <Pemblokiran><NoSurat>SPRIN/122/X/2026/DITTIP</NoSurat><Tanggal>2026-10-17</Tanggal><Saldo>875000000</Saldo></Pemblokiran>
  <DasarHukum>UU No. 9 Tahun 2013 tentang Pencegahan dan Pemberantasan Tindak Pidana Terorisme</DasarHukum>
</SIPESAT>`,
    submission_status: "SUBMITTED",
    generated_at: at(3, 8, 30),
    submitted_at: at(3, 9, 15),
    reported_by_user_id: "user-approver",
  },
  {
    id: "report-002",
    case_id: "case-001",
    report_type: "LTKM_PPATK",
    reference_number: "LTKM/DMB/2026/10/014",
    xml_payload_content: `<?xml version="1.0" encoding="UTF-8"?>
<LTKM>
  <Header><Institution>PT DIDI MAX BERJANGKA</Institution><ReportDate>2026-10-19</ReportDate></Header>
  <Transaksi><TotalNominal>875000000</TotalNominal><Kanal>RDN SAHAM</Kanal></Transaksi>
  <Indikasi><Jenis>PENDANAAN_TERORISME</Jenis><Uraian>Nasabah teridentifikasi dalam DTTOT Tahap II Tahun 2026</Uraian></Indikasi>
</LTKM>`,
    submission_status: "DRAFT",
    generated_at: at(1, 4, 0),
    submitted_at: null,
    reported_by_user_id: "user-analyst",
  },
  {
    id: "report-003",
    case_id: "case-002",
    report_type: "BERKALA_OJK",
    reference_number: "OJK/DMB/2026/10/BLK-003",
    xml_payload_content: `<?xml version="1.0" encoding="UTF-8"?>
<LaporanBerkala>
  <Periode>2026-10</Periode>
  <JumlahScreening>48</JumlahScreening>
  <JumlahHit>${matchDrafts.length}</JumlahHit>
  <KasusDalamProses>4</KasusDalamProses>
</LaporanBerkala>`,
    submission_status: "READY_TO_SEND",
    generated_at: at(1, 7, 0),
    submitted_at: null,
    reported_by_user_id: "user-supervisor",
  },
];

export function createInitialDatabase(): DatabaseSchema {
  // structuredClone menjaga agar array konstanta seed tidak ikut termutasi
  // oleh operasi runtime (mis. createReport), sehingga reset demo selalu bersih.
  return structuredClone({
    version: 3,
    users,
    watchlist_sources: watchlistSources,
    watchlist_entities: watchlistEntities,
    watchlist_aliases: watchlistAliases,
    watchlist_documents: watchlistDocuments,
    whitelist_records: whitelistRecords,
    batch_uploads: batchUploads,
    staged_customers: stagedCustomers,
    upload_errors: uploadErrors,
    screening_jobs: screeningJobs,
    screening_matches: screeningMatches,
    match_score_breakdowns: matchScoreBreakdowns,
    investigation_cases: investigationCases,
    case_notes: caseNotes,
    case_evidence_files: caseEvidenceFiles,
    approval_requests: approvalRequests,
    account_freeze_orders: accountFreezeOrders,
    audit_logs: auditLogs,
    regulatory_reports: regulatoryReports,
  }) satisfies DatabaseSchema;
}

export const DEMO_BASE_TIME = "2026-10-20T03:00:00.000Z";
export { DAY };
