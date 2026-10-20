import { appendAudit, getDatabase, getRequestUser, saveDatabase } from "@/lib/db";
import { createWorkbook } from "@/lib/excel";
import { formatDateTimeId } from "@/lib/normalize";
import { toCustomerListItem } from "@/lib/customers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const database = getDatabase();
  const user = getRequestUser(request, database);
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").toLowerCase().trim();
  const risk = url.searchParams.get("risk") ?? "";
  const status = url.searchParams.get("status") ?? "";
  const grade = url.searchParams.get("grade") ?? "";

  let items = database.staged_customers.map((customer) =>
    toCustomerListItem(database, customer),
  );
  if (query) {
    items = items.filter((item) =>
      [item.full_name, item.cif_number, item.occupation, item.employer_name]
        .join(" ")
        .toLowerCase()
        .includes(query),
    );
  }
  if (risk) items = items.filter((item) => item.risk_rating === risk);
  if (status) items = items.filter((item) => item.profile_status === status);
  if (grade) items = items.filter((item) => item.quality.grade === grade);

  const rows = items.map((item) => ({
    "CIF": item.cif_number,
    "Nama Nasabah": item.full_name,
    "Tipe": item.customer_type,
    "NIK (Masked)": item.national_id_masked,
    "No. Rekening (Masked)": item.account_number_masked,
    "Tanggal Lahir": item.date_of_birth,
    "Tempat Lahir": item.place_of_birth,
    Kewarganegaraan: item.nationality,
    Alamat: item.address,
    Pekerjaan: item.occupation,
    "Nama Perusahaan": item.employer_name,
    "Status Kepegawaian": item.employment_status ?? "—",
    "Profil Risiko": item.risk_rating,
    "Status Profil": item.profile_status,
    "Cabang": item.branch_code,
    "Penghasilan Bulanan": item.monthly_income,
    "Skor Kualitas": item.quality.score,
    "Grade Kualitas": item.quality.grade,
    "Jumlah Transaksi": item.transaction_count,
    "Transaksi Terakhir": item.last_transaction_at ?? "—",
    "Jumlah Match": item.match_count,
    "Severity Tertinggi": item.highest_severity ?? "NONE",
    "Kasus Aktif": item.open_case_count,
    "Terdaftar Sejak": item.onboarded_at,
  }));

  const buffer = createWorkbook([
    { name: "Data Nasabah", rows },
    {
      name: "Metadata",
      rows: [
        {
          Dokumen: "Manajemen Data Nasabah",
          Institusi: "PT DIDI MAX BERJANGKA",
          "Kode Dokumen": "DMB-ERD-DaMeL-IT-2410",
          "Dibuat Oleh": user.full_name,
          "Dibuat Pada": formatDateTimeId(new Date().toISOString()),
          "Jumlah Nasabah": rows.length,
          "Filter Risiko": risk || "SEMUA",
          "Filter Status": status || "SEMUA",
          "Filter Grade": grade || "SEMUA",
          "Kata Kunci": query || "—",
          Catatan: "NIK dan nomor rekening dimasking sesuai kebijakan perlindungan data.",
        },
      ],
    },
  ]);

  appendAudit(database, user, {
    action_name: "EXPORT_CUSTOMERS",
    module_name: "CUSTOMER_MGMT",
    description: `Mengekspor ${rows.length} data nasabah ke Excel.`,
    state_before: null,
    state_after: {
      export_type: "XLSX",
      rows: rows.length,
      filters: { query: query || null, risk, status, grade },
    },
  });
  saveDatabase(database);

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="Data_Nasabah_DMB_${new Date().toISOString().slice(0, 10)}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
