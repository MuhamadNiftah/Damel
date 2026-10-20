import { getDatabase } from "@/lib/db";
import { ok } from "@/lib/api";
import { runGlobalSearch } from "@/lib/search";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const database = getDatabase();
  const url = new URL(request.url);
  const query = url.searchParams.get("q") ?? "";
  return ok(runGlobalSearch(database, query));
}
