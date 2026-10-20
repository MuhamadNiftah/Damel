import type { SourceCode } from "./types";

export type WatchlistCategory = "DTTOT" | "APUPPT";

export const APUPPT_SOURCE_CODES: SourceCode[] = [
  "DPPSPM",
  "PEP",
  "UN_SANCTION",
];

export const WATCHLIST_CATEGORY_META: Record<
  WatchlistCategory,
  {
    label: string;
    short: string;
    description: string;
    regulation: string;
    sources: SourceCode[];
  }
> = {
  DTTOT: {
    label: "Data DTTOT",
    short: "DTTOT",
    description:
      "Daftar Terduga Teroris dan Organisasi Teroris yang ditetapkan oleh PPATK / BNPT.",
    regulation: "UU No. 9 Tahun 2013 · PP No. 50 Tahun 2018",
    sources: ["DTTOT"],
  },
  APUPPT: {
    label: "Data APU-PPT",
    short: "APUPPT",
    description:
      "Daftar DPPSPM, Politically Exposed Persons, dan sanksi internasional (UN Sanctions).",
    regulation: "POJK No. 8 Tahun 2023 · GRIPS 2.0 PPATK",
    sources: APUPPT_SOURCE_CODES,
  },
};

export function sourcesForCategory(category: WatchlistCategory): SourceCode[] {
  return WATCHLIST_CATEGORY_META[category].sources;
}

export function categoryOfSource(source: SourceCode): WatchlistCategory {
  return source === "DTTOT" ? "DTTOT" : "APUPPT";
}

export function isCategorySource(
  category: WatchlistCategory,
  source: SourceCode,
): boolean {
  return sourcesForCategory(category).includes(source);
}

export const CATEGORY_LABELS: Record<SourceCode, string> = {
  DTTOT: "DTTOT",
  DPPSPM: "DPPSPM",
  PEP: "PEP",
  UN_SANCTION: "UN Sanctions",
};
