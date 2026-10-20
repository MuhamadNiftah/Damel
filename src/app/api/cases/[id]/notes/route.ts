import type { CaseNote, NoteType } from "@/lib/types";
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

const NOTE_TYPES: NoteType[] = [
  "INTERNAL_ANALYSIS",
  "VERIFICATION_CALL",
  "BRANCH_REPLY",
];

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const database = getDatabase();
  const user = getRequestUser(request, database);
  const roleError = requireRole(user.role_code, [
    "MAKER_ANALYST",
    "CHECKER_SUPERVISOR",
    "APPROVER_HEAD",
  ]);
  if (roleError) return roleError;

  try {
    const body = (await request.json()) as {
      content?: string;
      note_type?: NoteType;
    };
    const content = body.content?.trim() ?? "";
    if (content.length < 5) {
      return fail("Catatan minimal 5 karakter.");
    }
    const noteType =
      body.note_type && NOTE_TYPES.includes(body.note_type)
        ? body.note_type
        : "INTERNAL_ANALYSIS";

    const note = mutateDatabase((db) => {
      const investigation = db.investigation_cases.find((item) => item.id === id);
      if (!investigation) throw new Error("Kasus tidak ditemukan.");
      if (investigation.case_status === "CLOSED") {
        throw new Error("Kasus yang sudah ditutup tidak dapat ditambah catatan.");
      }
      if (investigation.case_status === "OPEN") {
        investigation.case_status = "IN_ANALYSIS";
      }
      const caseNote: CaseNote = {
        id: newId("note"),
        case_id: id,
        author_user_id: user.id,
        note_content: content,
        note_type: noteType,
        created_at: nowIso(),
      };
      db.case_notes.push(caseNote);
      appendAudit(db, user, {
        action_name: "ADD_CASE_NOTE",
        module_name: "CASE_MGMT",
        description: `Menambahkan catatan ${noteType} pada ${investigation.case_number}.`,
        state_before: { notes_count: db.case_notes.filter((item) => item.case_id === id).length - 1 },
        state_after: {
          notes_count: db.case_notes.filter((item) => item.case_id === id).length,
          note_type: noteType,
        },
      });
      return { ...caseNote, author_name: user.full_name };
    });

    return ok({ note }, 201);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal menambahkan catatan.";
    return fail(message, 422);
  }
}
