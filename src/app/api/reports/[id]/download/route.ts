import { getDatabase } from "@/lib/db";
import { fail } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const database = getDatabase();
  const report = database.regulatory_reports.find((item) => item.id === id);
  if (!report) return fail("Laporan tidak ditemukan.", 404);
  return new Response(report.xml_payload_content, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${report.reference_number.replace(/[^A-Za-z0-9_-]/g, "_")}.xml"`,
      "Cache-Control": "no-store",
    },
  });
}
