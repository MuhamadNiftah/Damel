import { watchlistTemplate } from "@/lib/excel";

export const runtime = "nodejs";

export async function GET() {
  const buffer = watchlistTemplate();
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        'attachment; filename="Template_Master_Watchlist_DMB.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
