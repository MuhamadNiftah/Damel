import type {
  AnalystRecommendation,
  CaseNote,
  InvestigationCase,
} from "@/lib/types";
import {
  appendAudit,
  getDatabase,
  getRequestUser,
  mutateDatabase,
  newId,
  nowIso,
} from "@/lib/db";
import { fail, ok, requireRole } from "@/lib/api";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RECOMMENDATIONS: AnalystRecommendation[] = [
  "DISMISS_FALSE_POSITIVE",
  "CONFIRM_HIT",
  "ESCALATE_EDD",
];

function nextCaseNumber(): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const prefix = `CASE/APUPPT/${year}/${month}/`;
  const database = getDatabase();
  const sequence =
    database.investigation_cases.filter((item) =>
      item.case_number.startsWith(prefix),
    ).length + 1;
  return `${prefix}${String(sequence).padStart(3, "0")}`;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const database = getDatabase();
  const user = getRequestUser(request, database);
  const roleError = requireRole(user.role_code, ["MAKER_ANALYST"]);
  if (roleError) return roleError;

  try {
    const body = (await request.json()) as {
      recommendation?: AnalystRecommendation;
      note?: string;
      priority?: "NORMAL" | "HIGH";
    };
    const recommendation = body.recommendation;
    if (!recommendation || !RECOMMENDATIONS.includes(recommendation)) {
      return fail("Rekomendasi analis tidak valid.");
    }
    const note = body.note?.trim() ?? "";
    if (note.length < 10) {
      return fail("Catatan investigasi minimal 10 karakter.");
    }

    const result = mutateDatabase((db) => {
      const match = db.screening_matches.find((item) => item.id === id);
      if (!match) throw new Error("Hasil screening tidak ditemukan.");
      if (match.is_whitelisted) {
        throw new Error("Match telah di-whitelist dan tidak dapat dibuka sebagai kasus.");
      }
      const existing = db.investigation_cases.find(
        (item) => item.screening_match_id === id,
      );
      if (existing) throw new Error(`Kasus ${existing.case_number} sudah dibuka.`);

      const caseId = newId("case");
      const caseNumber = nextCaseNumber();
      const investigation: InvestigationCase = {
        id: caseId,
        case_number: caseNumber,
        screening_match_id: id,
        case_status: "OPEN",
        analyst_recommendation: recommendation,
        assigned_analyst_id: user.id,
        opened_at: nowIso(),
        closed_at: null,
        priority: body.priority === "HIGH" ? "HIGH" : "NORMAL",
      };
      db.investigation_cases.push(investigation);
      const caseNote: CaseNote = {
        id: newId("note"),
        case_id: caseId,
        author_user_id: user.id,
        note_content: note,
        note_type: "INTERNAL_ANALYSIS",
        created_at: nowIso(),
      };
      db.case_notes.push(caseNote);
      appendAudit(db, user, {
        action_name: "OPEN_CASE",
        module_name: "CASE_MGMT",
        description: `Membuka kasus ${caseNumber} dari hasil screening ${id}.`,
        state_before: null,
        state_after: {
          case_number: caseNumber,
          recommendation,
          priority: investigation.priority,
          match_id: id,
        },
      });
      return { case: investigation, note: caseNote };
    });

    return ok(result, 201);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal membuka kasus.";
    return fail(message, 422);
  }
}
