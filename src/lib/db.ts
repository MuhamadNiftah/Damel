import fs from "node:fs";
import path from "node:path";
import type { AuditLog, DatabaseSchema, User } from "./types";
import { createInitialDatabase } from "./seed";

const DATA_DIR = process.env.DMB_DATA_DIR || path.join(process.cwd(), "data");
const DB_FILE = path.join(DATA_DIR, "screening-db.json");
const DB_VERSION = 3;

function ensureDataDir(): void {
  if (!fs.existsSync(/*turbopackIgnore: true*/ DATA_DIR)) {
    fs.mkdirSync(/*turbopackIgnore: true*/ DATA_DIR, { recursive: true });
  }
}

function writeDatabase(database: DatabaseSchema): void {
  ensureDataDir();
  const temporary = `${DB_FILE}.${process.pid}.tmp`;
  fs.writeFileSync(temporary, JSON.stringify(database, null, 2), "utf8");
  fs.renameSync(temporary, DB_FILE);
}

export function getDatabase(): DatabaseSchema {
  ensureDataDir();
  if (fs.existsSync(DB_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(DB_FILE, "utf8")) as DatabaseSchema;
      if (parsed.version === DB_VERSION) {
        return parsed;
      }
    } catch {
      // Rebuild a corrupted demo database from the deterministic seed.
    }
  }
  const seeded = createInitialDatabase();
  writeDatabase(seeded);
  return seeded;
}

export function saveDatabase(database: DatabaseSchema): void {
  writeDatabase(database);
}

export function mutateDatabase<T>(mutator: (database: DatabaseSchema) => T): T {
  const database = getDatabase();
  const result = mutator(database);
  saveDatabase(database);
  return result;
}

export function resetDatabase(): DatabaseSchema {
  const seeded = createInitialDatabase();
  writeDatabase(seeded);
  return seeded;
}

export function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function findUser(database: DatabaseSchema, userId: string | null): User {
  return (
    database.users.find((user) => user.id === userId && user.is_active) ??
    database.users.find((user) => user.role_code === "MAKER_ANALYST")!
  );
}

export function getRequestUser(
  request: Request,
  database = getDatabase(),
): User {
  const userId = request.headers.get("x-user-id");
  return findUser(database, userId);
}

export function appendAudit(
  database: DatabaseSchema,
  user: User,
  input: {
    action_name: string;
    module_name: string;
    description: string;
    state_before?: Record<string, unknown> | null;
    state_after?: Record<string, unknown> | null;
    ip_address?: string;
    user_agent?: string;
  },
): AuditLog {
  const log: AuditLog = {
    id: newId("audit"),
    user_id: user.id,
    action_name: input.action_name,
    module_name: input.module_name,
    ip_address: input.ip_address ?? "10.10.24.18",
    user_agent: input.user_agent ?? "DMB Screening Web / Demo",
    state_before: input.state_before ?? null,
    state_after: input.state_after ?? null,
    timestamp: nowIso(),
    description: input.description,
  };
  database.audit_logs.push(log);
  return log;
}
