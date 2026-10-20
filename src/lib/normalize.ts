const HONORIFICS = new Set([
  "bapak",
  "ibu",
  "sdr",
  "sdri",
  "saudara",
  "saudari",
  "tn",
  "ny",
  "haji",
  "hajjah",
  "hj",
  "h",
  "dr",
  "drs",
  "dra",
  "ir",
  "prof",
]);

const ACADEMIC_TITLES = [
  "s.h.",
  "s.h",
  "s.e.",
  "s.e",
  "s.kom.",
  "s.kom",
  "s.t.",
  "s.t",
  "s.pd.",
  "s.pd",
  "m.m.",
  "m.m",
  "m.si.",
  "m.si",
  "m.kom.",
  "m.kom",
  "m.t.",
  "m.t",
  "m.h.",
  "m.h",
  "m.b.a.",
  "m.b.a",
  "ph.d.",
  "ph.d",
  "a.md.",
  "a.md",
  "se",
  "sh",
  "mm",
  "msi",
  "mkom",
  "mba",
  "phd",
];

const NATIONALITY_ALIASES: Record<string, string> = {
  wni: "indonesia",
  indonesian: "indonesia",
  "indonesia timur": "indonesia",
  wna: "",
  saudi: "saudi arabia",
  "arab saudi": "saudi arabia",
  malaysian: "malaysia",
  malaysia: "malaysia",
  singapore: "singapore",
  singapura: "singapore",
  yemeni: "yemen",
  syrian: "syria",
  pakistani: "pakistan",
  afghan: "afghanistan",
};

export function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizeWhitespace(value: string): string {
  return stripDiacritics(value)
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export function sanitizeName(value: string | null | undefined): string {
  if (!value) return "";
  let text = stripDiacritics(String(value)).toLowerCase().trim();
  text = text.replace(/[^a-z0-9\s]/g, " ");
  for (const title of ACADEMIC_TITLES) {
    const escaped = title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    text = text.replace(new RegExp(`(^|\\s)${escaped}(?=\\s|$)`, "g"), " ");
  }
  const tokens = text
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => !HONORIFICS.has(token));
  return tokens.join(" ").replace(/\s+/g, " ").trim();
}

export function normalizeNationality(value: string | null | undefined): string {
  const cleaned = sanitizeName(value);
  if (!cleaned) return "";
  return NATIONALITY_ALIASES[cleaned] ?? cleaned;
}

export function normalizeDocumentNumber(value: string | null | undefined): string {
  return (value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function parseDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number" && value > 1000) {
    const excelEpoch = Date.UTC(1899, 11, 30);
    const date = new Date(excelEpoch + value * 86400000);
    return date.toISOString().slice(0, 10);
  }
  const text = String(value).trim();
  if (!text) return null;

  if (/^\d{4}-\d{2}-\d{2}/.test(text)) {
    return text.slice(0, 10);
  }

  const monthMap: Record<string, string> = {
    jan: "01",
    januari: "01",
    january: "01",
    feb: "02",
    februari: "02",
    february: "02",
    mar: "03",
    maret: "03",
    march: "03",
    apr: "04",
    april: "04",
    mei: "05",
    may: "05",
    jun: "06",
    juni: "06",
    june: "06",
    jul: "07",
    juli: "07",
    july: "07",
    agu: "08",
    agt: "08",
    agustus: "08",
    august: "08",
    sep: "09",
    sept: "09",
    september: "09",
    okt: "10",
    oktober: "10",
    october: "10",
    nov: "11",
    november: "11",
    des: "12",
    desember: "12",
    december: "12",
  };

  const named = text
    .toLowerCase()
    .replace(/[,.]/g, " ")
    .match(/^(\d{1,2})\s+([a-z]+)\s+(\d{4})$/);
  if (named && monthMap[named[2]]) {
    return `${named[3]}-${monthMap[named[2]]}-${named[1].padStart(2, "0")}`;
  }

  const numeric = text.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/);
  if (numeric) {
    let [, first, second, year] = numeric;
    if (year.length === 2) {
      year = Number(year) > 35 ? `19${year}` : `20${year}`;
    }
    let day = first;
    let month = second;
    if (Number(first) <= 12 && Number(second) > 12) {
      day = second;
      month = first;
    }
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return null;
}

export function isValidNIK(value: string | null | undefined): boolean {
  return /^\d{16}$/.test((value || "").replace(/\D/g, ""));
}

export function extractAliases(value: string | null | undefined): string[] {
  if (!value) return [];
  const text = normalizeWhitespace(String(value));
  if (!text) return [];
  const split = text
    .replace(/\b(?:alias|a\.k\.a\.?|aka|also known as|f\.k\.a\.?|fka|nama samaran)\b/gi, ",")
    .split(/[,;|/]+|\s+-\s+/)
    .map((part) => part.trim().replace(/^[-–—:]+|[-–—:]+$/g, "").trim())
    .filter((part) => part.length > 1 && part.length < 180);
  return [...new Set(split.filter((part) => sanitizeName(part)))];
}

export function splitNameTokens(value: string): string[] {
  return sanitizeName(value).split(" ").filter(Boolean);
}

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split(" ")
    .map((word) => (word ? word.charAt(0).toUpperCase() + word.slice(1) : ""))
    .join(" ");
}

export function formatDateId(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

export function formatDateTimeId(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatCompact(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(value);
}
