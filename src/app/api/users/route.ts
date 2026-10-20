import { getDatabase } from "@/lib/db";
import { ok } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const database = getDatabase();
  return ok({
    users: database.users
      .filter((user) => user.is_active)
      .map((user) => ({
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role_code: user.role_code,
        branch_code: user.branch_code,
        avatar_color: user.avatar_color,
      })),
  });
}
