import { NextResponse } from "next/server";

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data, { status });
}

export function fail(
  message: string,
  status = 400,
  details?: Record<string, unknown>,
): NextResponse {
  return NextResponse.json({ error: message, ...details }, { status });
}

export function requireRole(
  role: string,
  allowed: string[],
): NextResponse | null {
  if (allowed.includes(role)) return null;
  return fail("Anda tidak memiliki hak akses untuk tindakan ini.", 403);
}

export function asNumber(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}
