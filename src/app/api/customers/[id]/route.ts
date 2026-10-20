import type {
  CustomerProfileStatus,
  CustomerRiskRating,
  EmploymentStatus,
  StagedCustomer,
} from "@/lib/types";
import { appendAudit, getDatabase, getRequestUser, mutateDatabase } from "@/lib/db";
import { fail, ok, requireRole } from "@/lib/api";
import { findCustomer, toCustomerDetail } from "@/lib/customers";
import { sanitizeName } from "@/lib/normalize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const database = getDatabase();
  const customer = findCustomer(database, id);
  if (!customer) return fail("Nasabah tidak ditemukan.", 404);
  return ok({ customer: toCustomerDetail(database, customer) });
}

const RISK_VALUES: CustomerRiskRating[] = ["LOW", "MEDIUM", "HIGH"];
const STATUS_VALUES: CustomerProfileStatus[] = ["ACTIVE", "DORMANT", "CLOSED"];
const EMPLOYMENT_VALUES: EmploymentStatus[] = [
  "PERMANENT",
  "CONTRACT",
  "SELF_EMPLOYED",
  "RETIRED",
];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const database = getDatabase();
  const user = getRequestUser(request, database);
  const roleError = requireRole(user.role_code, ["MAKER_ANALYST", "ADMIN"]);
  if (roleError) return roleError;

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const updated = mutateDatabase((db) => {
      const found = findCustomer(db, id);
      if (!found) throw new Error("Nasabah tidak ditemukan.");
      const customer = found;

      const before: Record<string, unknown> = {};
      const after: Record<string, unknown> = {};

      function setField<K extends keyof StagedCustomer>(
        key: K,
        value: StagedCustomer[K],
      ) {
        if (value === undefined) return;
        before[key as string] = customer[key];
        customer[key] = value;
        after[key as string] = value;
      }

      if (typeof body.full_name === "string" && body.full_name.trim()) {
        const clean = sanitizeName(body.full_name);
        if (!clean) throw new Error("Nama nasabah tidak valid.");
        setField("raw_full_name", body.full_name.trim());
        setField("sanitized_full_name", clean);
      }
      if (typeof body.occupation === "string") {
        setField("occupation", body.occupation.trim());
      }
      if (typeof body.employer_name === "string") {
        setField("employer_name", body.employer_name.trim());
      }
      if (typeof body.address === "string") {
        setField("address", body.address.trim());
      }
      if (typeof body.place_of_birth === "string") {
        setField("place_of_birth", body.place_of_birth.trim());
      }
      if (typeof body.nationality === "string") {
        setField("nationality", body.nationality.trim());
      }
      if (typeof body.date_of_birth === "string") {
        setField("date_of_birth", body.date_of_birth);
      }
      if (typeof body.passport_number === "string") {
        setField("passport_number", body.passport_number.trim().toUpperCase());
      }
      if (typeof body.branch_code === "string") {
        setField("branch_code", body.branch_code.trim());
      }
      if (typeof body.source_of_fund === "string") {
        setField("source_of_fund", body.source_of_fund.trim());
      }
      if (typeof body.monthly_income === "number" && body.monthly_income >= 0) {
        setField("monthly_income", Math.round(body.monthly_income));
      }
      if (
        typeof body.employment_status === "string" &&
        EMPLOYMENT_VALUES.includes(body.employment_status as EmploymentStatus)
      ) {
        setField(
          "employment_status",
          body.employment_status as EmploymentStatus,
        );
      }
      if (
        typeof body.risk_rating === "string" &&
        RISK_VALUES.includes(body.risk_rating as CustomerRiskRating)
      ) {
        setField("risk_rating", body.risk_rating as CustomerRiskRating);
      }
      if (
        typeof body.profile_status === "string" &&
        STATUS_VALUES.includes(body.profile_status as CustomerProfileStatus)
      ) {
        setField("profile_status", body.profile_status as CustomerProfileStatus);
      }

      if (Object.keys(after).length === 0) {
        throw new Error("Tidak ada perubahan yang dikirim.");
      }

      const history = customer.employment_history ?? [];
      const current = history.find((item) => item.is_current);
      if (current) {
        if (typeof body.occupation === "string") current.position = customer.occupation ?? "";
        if (typeof body.employer_name === "string") {
          current.company_name = customer.employer_name ?? "";
        }
      }

      appendAudit(db, user, {
        action_name: "UPDATE_CUSTOMER",
        module_name: "CUSTOMER_MGMT",
        description: `Memperbarui profil nasabah ${customer.raw_full_name} (${customer.cif_number}).`,
        state_before: before,
        state_after: after,
      });
      return customer;
    });

    return ok({ customer: toCustomerDetail(getDatabase(), updated) });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Gagal memperbarui data nasabah.";
    return fail(message, 422);
  }
}
