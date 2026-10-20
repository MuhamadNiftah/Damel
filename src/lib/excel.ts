import * as XLSX from "xlsx";

export interface SheetRows {
  headers: string[];
  rows: unknown[][];
  sheetName: string;
}

function cleanHeader(value: unknown): string {
  return String(value ?? "")
    .replace(/^\uFEFF/, "")
    .trim();
}

export function normalizeHeader(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export function parseSpreadsheet(
  buffer: Buffer | Uint8Array,
  filename: string,
): SheetRows {
  const workbook = XLSX.read(buffer, {
    type: "buffer",
    cellDates: true,
    dense: true,
    raw: false,
  });
  if (!workbook.SheetNames.length) {
    throw new Error("File tidak memiliki worksheet.");
  }
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
    raw: false,
  });
  if (!matrix.length) {
    throw new Error("Worksheet kosong.");
  }
  const headers = (matrix[0] as unknown[]).map(cleanHeader);
  if (!headers.some(Boolean)) {
    throw new Error("Baris header tidak terdeteksi.");
  }
  const rows = matrix
    .slice(1)
    .map((row) => (row as unknown[]).map((cell) => cell ?? ""))
    .filter((row) => row.some((cell) => String(cell).trim() !== ""));
  return {
    headers,
    rows,
    sheetName: filename,
  };
}

function findHeader(
  headers: string[],
  aliases: string[],
  used: Set<number>,
): number {
  const normalized = headers.map(normalizeHeader);
  const normalizedAliases = aliases.map(normalizeHeader);
  for (const alias of normalizedAliases) {
    const exact = normalized.findIndex(
      (header, index) => header === alias && !used.has(index),
    );
    if (exact >= 0) return exact;
  }
  for (const alias of normalizedAliases) {
    if (alias.length < 3) continue;
    const partial = normalized.findIndex(
      (header, index) =>
        !used.has(index) && (header.includes(alias) || alias.includes(header)),
    );
    if (partial >= 0) return partial;
  }
  return -1;
}

export type CustomerField =
  | "cif"
  | "account"
  | "fullName"
  | "nationalId"
  | "passport"
  | "dob"
  | "pob"
  | "nationality"
  | "address"
  | "customerType"
  | "taxId";

const CUSTOMER_ALIASES: Record<CustomerField, string[]> = {
  cif: ["cif", "cif number", "no cif", "nomor cif", "customer id"],
  account: [
    "no rekening",
    "no. rek",
    "nomor rekening",
    "account number",
    "rekening",
    "no rek",
    "nomor rek",
    "account no",
  ],
  fullName: [
    "nama lengkap",
    "nama nasabah",
    "nama",
    "full name",
    "customer name",
    "name",
  ],
  nationalId: ["nik", "no ktp", "nomor ktp", "national id", "ktp", "nik ktp"],
  passport: ["passport", "no paspor", "nomor paspor", "passport number"],
  dob: ["tanggal lahir", "tgl lahir", "dob", "date of birth", "birth date"],
  pob: ["tempat lahir", "pob", "place of birth", "birth place"],
  nationality: ["kewarganegaraan", "nationality", "negara", "country"],
  address: ["alamat", "address", "alamat lengkap", "domisili"],
  customerType: ["tipe nasabah", "customer type", "jenis nasabah", "type"],
  taxId: ["npwp", "tax id", "npwp perusahaan"],
};

export function detectCustomerColumns(headers: string[]): {
  mapping: Record<CustomerField, number>;
  missing: string[];
} {
  const used = new Set<number>();
  const mapping = {} as Record<CustomerField, number>;
  for (const field of Object.keys(CUSTOMER_ALIASES) as CustomerField[]) {
    const index = findHeader(headers, CUSTOMER_ALIASES[field], used);
    mapping[field] = index;
    if (index >= 0) used.add(index);
  }
  const missing: string[] = [];
  if (mapping.fullName < 0) missing.push("Nama Lengkap");
  if (mapping.account < 0) missing.push("Nomor Rekening");
  return { mapping, missing };
}

export type WatchlistField =
  | "source"
  | "entityName"
  | "aliases"
  | "idNumber"
  | "passport"
  | "dob"
  | "pob"
  | "nationality"
  | "address"
  | "legalBasis"
  | "entityType";

const WATCHLIST_ALIASES: Record<WatchlistField, string[]> = {
  source: ["source", "sumber", "kategori sanksi", "source code"],
  entityName: [
    "entity name",
    "nama entitas",
    "nama",
    "nama lengkap",
    "primary name",
  ],
  aliases: ["aliases", "alias", "nama samaran", "aka", "a.k.a"],
  idNumber: [
    "id / passport",
    "id",
    "passport",
    "nomor identitas",
    "nik",
    "no identitas",
  ],
  passport: ["passport only", "no paspor", "passport number"],
  dob: ["dob", "tanggal lahir", "tgl lahir", "date of birth"],
  pob: ["pob", "tempat lahir", "place of birth"],
  nationality: ["nationality", "kewarganegaraan", "negara"],
  address: ["address", "alamat", "address info"],
  legalBasis: [
    "legal basis",
    "dasar hukum",
    "nomor penetapan",
    "legal reference",
    "nomor keputusan",
  ],
  entityType: ["entity type", "tipe entitas", "jenis entitas", "type"],
};

export function detectWatchlistColumns(headers: string[]): {
  mapping: Record<WatchlistField, number>;
  missing: string[];
} {
  const used = new Set<number>();
  const mapping = {} as Record<WatchlistField, number>;
  for (const field of Object.keys(WATCHLIST_ALIASES) as WatchlistField[]) {
    const index = findHeader(headers, WATCHLIST_ALIASES[field], used);
    mapping[field] = index;
    if (index >= 0) used.add(index);
  }
  const missing: string[] = [];
  if (mapping.entityName < 0) missing.push("Entity Name");
  return { mapping, missing };
}

export function createWorkbook(
  sheets: Array<{ name: string; rows: Array<Record<string, unknown>> }>,
): Buffer {
  const workbook = XLSX.utils.book_new();
  for (const sheet of sheets) {
    const worksheet = XLSX.utils.json_to_sheet(sheet.rows);
    const widths = Object.keys(sheet.rows[0] ?? {}).map((key) => ({
      wch: Math.max(
        12,
        key.length + 2,
        ...sheet.rows.map((row) => String(row[key] ?? "").length + 2),
      ),
    }));
    worksheet["!cols"] = widths.slice(0, 18);
    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      sheet.name.slice(0, 31),
    );
  }
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export function customerTemplate(): Buffer {
  return createWorkbook([
    {
      name: "Data Nasabah",
      rows: [
        {
          CIF: "CIF-2026-9001",
          "Nomor Rekening": "14000900001",
          "Nama Lengkap": "Contoh Nama Nasabah",
          NIK: "3171010101900001",
          Paspor: "",
          "Tanggal Lahir": "1990-01-01",
          "Tempat Lahir": "Jakarta",
          Kewarganegaraan: "Indonesia",
          Alamat: "Jl. Contoh No. 1, Jakarta",
          "Tipe Nasabah": "INDIVIDUAL",
        },
      ],
    },
    {
      name: "Petunjuk",
      rows: [
        { Kolom: "CIF", Wajib: "Disarankan", Keterangan: "Nomor CIF nasabah." },
        {
          Kolom: "Nomor Rekening",
          Wajib: "Ya",
          Keterangan: "Nomor rekening efek/RDN.",
        },
        { Kolom: "Nama Lengkap", Wajib: "Ya", Keterangan: "Sesuai KTP." },
        { Kolom: "NIK", Wajib: "Disarankan", Keterangan: "16 digit numerik." },
        {
          Kolom: "Tanggal Lahir",
          Wajib: "Disarankan",
          Keterangan: "Format YYYY-MM-DD.",
        },
      ],
    },
  ]);
}

export function watchlistTemplate(): Buffer {
  return createWorkbook([
    {
      name: "Master Watchlist",
      rows: [
        {
          Source: "DTTOT",
          "Entity Name": "Nama Terduga",
          Aliases: "Alias Satu, Alias Dua; a.k.a Alias Tiga",
          "ID / Passport": "3171010101900001",
          DOB: "1990-01-01",
          POB: "Jakarta",
          Nationality: "Indonesia",
          "Legal Basis": "Penetapan Pengadilan No. 01/Pid.Sus/2026",
          "Entity Type": "INDIVIDUAL",
        },
      ],
    },
    {
      name: "Petunjuk",
      rows: [
        {
          Kolom: "Source",
          Nilai: "DTTOT | DPPSPM | PEP | UN_SANCTION",
          Keterangan: "Kosongkan untuk memakai sumber yang dipilih pada form.",
        },
        {
          Kolom: "Aliases",
          Nilai: "Dipisahkan koma / titik koma",
          Keterangan: "Kata alias, a.k.a, atau f.k.a juga dikenali.",
        },
      ],
    },
  ]);
}
