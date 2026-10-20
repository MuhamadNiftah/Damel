import type { SourceCode } from "@/lib/types";
import { appendAudit, getDatabase, getRequestUser, saveDatabase } from "@/lib/db";
import { createWorkbook } from "@/lib/excel";
import { formatDateTimeId } from "@/lib/normalize";
import {
  WATCHLIST_CATEGORY_META,
  isCategorySource,
  type WatchlistCategory,
} from "@/lib/watchlist-categories";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const database = getDatabase();
  const user = getRequestUser(request, database);
  const url = new URL(request.url);
  const category = (url.searchParams.get("category") as WatchlistCategory | null) ?? null;
  const sourceFilter = url.searchParams.get("source") as SourceCode | null;

  const sources = database.watchlist_sources.filter((source) => {
    if (category && !isCategorySource(category, source.source_code)) return false;
    if (sourceFilter && source.source_code !== sourceFilter) return false;
    return true;
  });
  const sourceIds = new Set(sources.map((source) => source.id));
  const entities = database.watchlist_entities.filter((entity) =>
    sourceIds.has(entity.source_id),
  );

  const rows = entities.map((entity) => {
    const source = sources.find((item) => item.id === entity.source_id);
    const aliases = database.watchlist_aliases
      .filter((alias) => alias.entity_id === entity.id)
      .map((alias) => alias.alias_name);
    const documents = database.watchlist_documents.filter(
      (document) => document.entity_id === entity.id,
    );
    return {
      "Entity ID": entity.id,
      "Nama Utama": entity.primary_name,
      "Tipe Entitas": entity.entity_type,
      Kewarganegaraan: entity.nationality,
      "Tanggal Lahir": entity.date_of_birth,
      "Tempat Lahir": entity.place_of_birth,
      Alamat: entity.address_info,
      "Dasar Hukum": entity.legal_reference,
      "Kode Sumber": source?.source_code ?? "",
      "Versi Sumber": source?.version_label ?? "",
      "Status Aktif": entity.is_active ? "AKTIF" : "TIDAK AKTIF",
      Alias: aliases.join("; "),
      "Jumlah Alias": aliases.length,
      "Dokumen Identitas": documents
        .map((document) => `${document.document_type}: ${document.document_number}`)
        .join("; "),
      "Negara Penerbit": documents
        .map((document) => document.issuing_country)
        .join("; "),
      "Dibuat Pada": formatDateTimeId(entity.created_at),
    };
  });

  const sourceRows = sources.map((source) => ({
    "Source ID": source.id,
    "Kode Sumber": source.source_code,
    "Label Versi": source.version_label,
    Penerbit: source.published_by,
    "Tanggal Efektif": source.effective_date,
    "Tanggal Kedaluwarsa": source.expiry_date ?? "—",
    "Nama File": source.excel_file_name,
    "Diunggah Pada": formatDateTimeId(source.uploaded_at),
    "Sumber Aktif": source.is_current ? "YA" : "TIDAK",
    Catatan: source.notes,
  }));

  const buffer = createWorkbook([
    { name: "Entitas", rows },
    { name: "Sumber", rows: sourceRows },
    {
      name: "Metadata",
      rows: [
        {
          Dokumen: category
            ? WATCHLIST_CATEGORY_META[category].label
            : "Watchlist Sanksi",
          Institusi: "PT DIDI MAX BERJANGKA",
          "Kode Dokumen": "DMB-ERD-DaMeL-IT-2410",
          Kategori: category ?? "SEMUA",
          "Dasar Regulasi": category
            ? WATCHLIST_CATEGORY_META[category].regulation
            : "POJK No. 8 Tahun 2023",
          "Dibuat Oleh": user.full_name,
          "Dibuat Pada": formatDateTimeId(new Date().toISOString()),
          "Jumlah Entitas": rows.length,
          "Jumlah Sumber": sourceRows.length,
          "Filter Sumber": sourceFilter ?? "SEMUA",
        },
      ],
    },
  ]);

  appendAudit(database, user, {
    action_name: "EXPORT_WATCHLIST",
    module_name: category ?? "WATCHLIST",
    description: `Mengekspor ${rows.length} entitas ${
      category ? WATCHLIST_CATEGORY_META[category].short : "watchlist"
    } ke Excel.`,
    state_before: null,
    state_after: {
      export_type: "XLSX",
      category,
      source: sourceFilter,
      entities: rows.length,
      sources: sourceRows.length,
    },
  });
  saveDatabase(database);

  const fileName = `${category ?? "Watchlist"}_DMB_${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
