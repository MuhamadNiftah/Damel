import type { RoleCode, User } from "@/lib/types";
import { appendAudit, getDatabase, getRequestUser, mutateDatabase, newId, nowIso } from "@/lib/db";
import { fail, ok, requireRole } from "@/lib/api";
import { ACCESS_MODULES } from "@/lib/rbac";
import { ROLE_META } from "@/lib/ui";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ROLES: RoleCode[] = [
  "MAKER_ANALYST",
  "CHECKER_SUPERVISOR",
  "APPROVER_HEAD",
  "AUDITOR",
  "ADMIN",
];

const AVATAR_COLORS: Record<RoleCode, string> = {
  MAKER_ANALYST: "#0f766e",
  CHECKER_SUPERVISOR: "#1d4ed8",
  APPROVER_HEAD: "#b45309",
  AUDITOR: "#6d28d9",
  ADMIN: "#475569",
};

export async function GET(request: Request) {
  const database = getDatabase();
  const user = getRequestUser(request, database);
  const roleError = requireRole(user.role_code, ["ADMIN"]);
  if (roleError) return roleError;

  const lastActivity = new Map<string, string>();
  for (const log of database.audit_logs) {
    const current = lastActivity.get(log.user_id);
    if (!current || log.timestamp > current) lastActivity.set(log.user_id, log.timestamp);
  }

  const users = database.users
    .map((item) => ({
      ...item,
      role_label: ROLE_META[item.role_code]?.label ?? item.role_code,
      last_activity_at: lastActivity.get(item.id) ?? item.last_login_at ?? null,
      open_cases: database.investigation_cases.filter(
        (investigation) =>
          investigation.assigned_analyst_id === item.id &&
          investigation.case_status !== "CLOSED",
      ).length,
      approvals: database.approval_requests.filter(
        (approval) =>
          approval.approver_user_id === item.id ||
          approval.checker_user_id === item.id,
      ).length,
    }))
    .sort((a, b) => {
      const roleDelta =
        ROLES.indexOf(a.role_code) - ROLES.indexOf(b.role_code);
      if (roleDelta !== 0) return roleDelta;
      return a.full_name.localeCompare(b.full_name);
    });

  const roleDistribution = ROLES.map((role) => ({
    role_code: role,
    label: ROLE_META[role].label,
    color: ROLE_META[role].color,
    total: database.users.filter((item) => item.role_code === role).length,
    active: database.users.filter(
      (item) => item.role_code === role && item.is_active,
    ).length,
  }));

  return ok({
    users,
    roles: ROLES.map((role) => ({
      code: role,
      ...ROLE_META[role],
    })),
    roleDistribution,
    accessModules: ACCESS_MODULES,
    stats: {
      total: users.length,
      active: users.filter((item) => item.is_active).length,
      inactive: users.filter((item) => !item.is_active).length,
      admins: users.filter(
        (item) => item.role_code === "ADMIN" && item.is_active,
      ).length,
      auditEvents: database.audit_logs.length,
    },
  });
}

export async function POST(request: Request) {
  const database = getDatabase();
  const actor = getRequestUser(request, database);
  const roleError = requireRole(actor.role_code, ["ADMIN"]);
  if (roleError) return roleError;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const fullName = String(body.full_name ?? "").trim();
    const username = String(body.username ?? "").trim().toLowerCase();
    const email = String(body.email ?? "").trim().toLowerCase();
    const role = String(body.role_code ?? "") as RoleCode;
    const branch = String(body.branch_code ?? "").trim() || "HQ";

    if (fullName.length < 3) throw new Error("Nama lengkap minimal 3 karakter.");
    if (!/^[a-z0-9._-]{3,32}$/.test(username)) {
      throw new Error("Username 3–32 karakter, hanya huruf, angka, titik, garis bawah, atau strip.");
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new Error("Format email tidak valid.");
    }
    if (!ROLES.includes(role)) throw new Error("Peran pengguna tidak valid.");

    const created = mutateDatabase((db) => {
      if (db.users.some((item) => item.username === username)) {
        throw new Error("Username sudah digunakan.");
      }
      if (db.users.some((item) => item.email.toLowerCase() === email)) {
        throw new Error("Email sudah digunakan.");
      }
      const user: User = {
        id: newId("user"),
        username,
        email,
        full_name: fullName,
        role_code: role,
        branch_code: branch,
        is_active: true,
        avatar_color: AVATAR_COLORS[role],
        created_at: nowIso(),
      };
      db.users.push(user);
      appendAudit(db, actor, {
        action_name: "CREATE_USER",
        module_name: "ADMIN",
        description: `Menambahkan pengguna ${user.full_name} dengan peran ${role}.`,
        state_before: null,
        state_after: {
          user_id: user.id,
          username: user.username,
          email: user.email,
          role_code: user.role_code,
          branch_code: user.branch_code,
          is_active: user.is_active,
        },
      });
      return user;
    });

    return ok({ user: created }, 201);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal menambahkan pengguna.";
    return fail(message, 422);
  }
}

export async function PATCH(request: Request) {
  const database = getDatabase();
  const actor = getRequestUser(request, database);
  const roleError = requireRole(actor.role_code, ["ADMIN"]);
  if (roleError) return roleError;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const targetId = String(body.id ?? "");
    const updated = mutateDatabase((db) => {
      const target = db.users.find((item) => item.id === targetId);
      if (!target) throw new Error("Pengguna tidak ditemukan.");

      const before: Record<string, unknown> = {};
      const after: Record<string, unknown> = {};
      const activeAdmins = db.users.filter(
        (item) => item.role_code === "ADMIN" && item.is_active,
      );

      if (typeof body.full_name === "string" && body.full_name.trim()) {
        before.full_name = target.full_name;
        target.full_name = body.full_name.trim();
        after.full_name = target.full_name;
      }
      if (typeof body.branch_code === "string" && body.branch_code.trim()) {
        before.branch_code = target.branch_code;
        target.branch_code = body.branch_code.trim();
        after.branch_code = target.branch_code;
      }
      if (typeof body.email === "string" && body.email.trim()) {
        const email = body.email.trim().toLowerCase();
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          throw new Error("Format email tidak valid.");
        }
        if (
          db.users.some(
            (item) => item.id !== target.id && item.email.toLowerCase() === email,
          )
        ) {
          throw new Error("Email sudah digunakan pengguna lain.");
        }
        before.email = target.email;
        target.email = email;
        after.email = target.email;
      }
      if (typeof body.role_code === "string") {
        const role = body.role_code as RoleCode;
        if (!ROLES.includes(role)) throw new Error("Peran pengguna tidak valid.");
        if (target.id === actor.id && role !== "ADMIN") {
          throw new Error("Admin tidak dapat menurunkan perannya sendiri.");
        }
        if (
          target.role_code === "ADMIN" &&
          role !== "ADMIN" &&
          activeAdmins.length <= 1
        ) {
          throw new Error("Minimal harus ada satu admin aktif.");
        }
        before.role_code = target.role_code;
        target.role_code = role;
        target.avatar_color = AVATAR_COLORS[role];
        after.role_code = target.role_code;
      }
      if (typeof body.is_active === "boolean") {
        if (target.id === actor.id && !body.is_active) {
          throw new Error("Admin tidak dapat menonaktifkan akunnya sendiri.");
        }
        if (
          !body.is_active &&
          target.role_code === "ADMIN" &&
          db.users.filter(
            (item) => item.role_code === "ADMIN" && item.is_active,
          ).length <= 1
        ) {
          throw new Error("Minimal harus ada satu admin aktif.");
        }
        before.is_active = target.is_active;
        target.is_active = body.is_active;
        after.is_active = target.is_active;
      }

      if (Object.keys(after).length === 0) {
        throw new Error("Tidak ada perubahan yang dikirim.");
      }

      appendAudit(db, actor, {
        action_name: "UPDATE_USER",
        module_name: "ADMIN",
        description: `Memperbarui pengguna ${target.full_name} (${target.username}).`,
        state_before: before,
        state_after: after,
      });
      return target;
    });

    return ok({ user: updated });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal memperbarui pengguna.";
    return fail(message, 422);
  }
}
