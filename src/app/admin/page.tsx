"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  Check,
  KeyRound,
  Lock,
  Pencil,
  Power,
  ShieldCheck,
  UserCog,
  UserPlus,
  UsersRound,
  X,
} from "lucide-react";
import type { RoleCode, User } from "@/lib/types";
import { ACCESS_MODULES } from "@/lib/rbac";
import { useDemoUser } from "@/components/user-provider";
import { useToast } from "@/components/toast-provider";
import {
  EmptyState,
  MetricCard,
  Modal,
  SearchInput,
  Skeleton,
  Tabs,
} from "@/components/ui";
import { formatDateTimeId } from "@/lib/normalize";
import { ROLE_META, clsx, getInitials } from "@/lib/ui";

interface AdminUser extends User {
  role_label: string;
  last_activity_at: string | null;
  open_cases: number;
  approvals: number;
}

interface RoleDistribution {
  role_code: RoleCode;
  label: string;
  color: string;
  total: number;
  active: number;
}

interface AdminResponse {
  users: AdminUser[];
  roles: Array<{ code: RoleCode; label: string; short: string; description: string; color: string }>;
  roleDistribution: RoleDistribution[];
  accessModules: typeof ACCESS_MODULES;
  stats: {
    total: number;
    active: number;
    inactive: number;
    admins: number;
    auditEvents: number;
  };
}

type TabKey = "pengguna" | "akses";

interface UserForm {
  id?: string;
  full_name: string;
  username: string;
  email: string;
  role_code: RoleCode;
  branch_code: string;
  is_active: boolean;
}

const EMPTY_FORM: UserForm = {
  full_name: "",
  username: "",
  email: "",
  role_code: "MAKER_ANALYST",
  branch_code: "JKT-01",
  is_active: true,
};

function AccessMatrix({
  modules,
}: {
  modules: typeof ACCESS_MODULES;
}) {
  const roles = Object.keys(ROLE_META) as RoleCode[];
  return (
    <div className="table-shell">
      <table className="data-table min-w-[820px]">
        <thead>
          <tr>
            <th className="w-[300px]">Modul / akses</th>
            {roles.map((role) => (
              <th key={role} className="text-center">
                <span className="text-[0.66rem]">{ROLE_META[role].short}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {modules.map((module) => (
            <tr key={module.key}>
              <td>
                <p className="primary-cell text-[0.75rem]">{module.label}</p>
                <p className="mt-0.5 text-[0.61rem] text-slate-400">
                  {module.description}
                </p>
              </td>
              {roles.map((role) => {
                const canView = module.roles.includes(role);
                const canManage = module.manageRoles?.includes(role);
                return (
                  <td key={role} className="text-center">
                    {canManage ? (
                      <span className="badge badge-gold">Kelola</span>
                    ) : canView ? (
                      <Check size={15} className="mx-auto text-emerald-600" />
                    ) : (
                      <X size={14} className="mx-auto text-slate-300" />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AdminPage() {
  const { user, ready, apiFetch, refreshUsers } = useDemoUser();
  const toast = useToast();
  const [data, setData] = useState<AdminResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("pengguna");
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [form, setForm] = useState<UserForm>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const isAdmin = user.role_code === "ADMIN";

  const load = useCallback(async () => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const payload = await apiFetch<AdminResponse>("/api/admin/users");
      setData(payload);
    } catch (loadError) {
      setError((loadError as Error).message);
    } finally {
      setLoading(false);
    }
  }, [apiFetch, isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (data?.users ?? []).filter((item) => {
      if (roleFilter && item.role_code !== roleFilter) return false;
      if (statusFilter === "active" && !item.is_active) return false;
      if (statusFilter === "inactive" && item.is_active) return false;
      if (!needle) return true;
      return [item.full_name, item.username, item.email, item.branch_code]
        .join(" ")
        .toLowerCase()
        .includes(needle);
    });
  }, [data, query, roleFilter, statusFilter]);

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  }

  function openEdit(item: AdminUser) {
    setEditing(item);
    setForm({
      id: item.id,
      full_name: item.full_name,
      username: item.username,
      email: item.email,
      role_code: item.role_code,
      branch_code: item.branch_code,
      is_active: item.is_active,
    });
    setModalOpen(true);
  }

  async function saveUser() {
    setSaving(true);
    try {
      if (editing) {
        await apiFetch("/api/admin/users", {
          method: "PATCH",
          body: JSON.stringify({
            id: editing.id,
            full_name: form.full_name,
            email: form.email,
            role_code: form.role_code,
            branch_code: form.branch_code,
            is_active: form.is_active,
          }),
        });
        toast.success("Pengguna diperbarui", "Perubahan peran/akses tercatat pada log system.");
      } else {
        await apiFetch("/api/admin/users", {
          method: "POST",
          body: JSON.stringify(form),
        });
        toast.success("Pengguna ditambahkan", `${form.full_name} dapat langsung menggunakan sistem.`);
      }
      setModalOpen(false);
      await load();
      await refreshUsers();
    } catch (saveError) {
      toast.error("Gagal menyimpan pengguna", (saveError as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(item: AdminUser) {
    if (item.is_active) {
      const confirmed = window.confirm(
        `Nonaktifkan akun ${item.full_name}? Pengguna tidak dapat login setelah dinonaktifkan.`,
      );
      if (!confirmed) return;
    }
    setTogglingId(item.id);
    try {
      await apiFetch("/api/admin/users", {
        method: "PATCH",
        body: JSON.stringify({ id: item.id, is_active: !item.is_active }),
      });
      toast.success(
        item.is_active ? "Akun dinonaktifkan" : "Akun diaktifkan",
        `${item.full_name} · ${item.username}`,
      );
      await load();
      await refreshUsers();
    } catch (toggleError) {
      toast.error("Gagal mengubah status", (toggleError as Error).message);
    } finally {
      setTogglingId(null);
    }
  }

  if (!ready) {
    return (
      <div className="space-y-4">
        <div>
          <Skeleton className="h-3 w-24" />
          <Skeleton className="mt-2 h-7 w-56" />
          <Skeleton className="mt-2 h-3 w-96 max-w-full" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="card p-4">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="mt-3 h-8 w-20" />
              <Skeleton className="mt-2 h-3 w-32" />
            </div>
          ))}
        </div>
        <div className="card p-4">
          <Skeleton className="h-9 w-full" />
          <div className="mt-3 space-y-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-12 w-full" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="space-y-4">
        <div>
          <p className="text-[0.66rem] font-bold uppercase tracking-[0.14em] text-brand-700">
            Tata Kelola
          </p>
          <h1 className="mt-0.5 text-[1.35rem] font-extrabold tracking-tight text-ink-900 sm:text-[1.55rem]">
            Admin Management
          </h1>
          <p className="mt-1 max-w-3xl text-[0.78rem] leading-relaxed text-slate-500">
            Role management dan access control untuk seluruh modul compliance.
          </p>
        </div>
        <div className="card p-6">
          <div className="mx-auto max-w-xl text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
              <Lock size={22} />
            </span>
            <p className="mt-3 text-[0.95rem] font-extrabold text-ink-900">
              Akses ditolak
            </p>
            <p className="mt-1 text-[0.75rem] leading-relaxed text-slate-500">
              Anda masuk sebagai <strong>{user.full_name}</strong> (
              {ROLE_META[user.role_code].label}). Modul Admin Management hanya
              dapat diakses oleh peran Admin Sistem.
            </p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              <span className="badge badge-neutral">
                <KeyRound size={12} /> Role-based access control
              </span>
              <span className="badge badge-neutral">
                <ShieldCheck size={12} /> Audit trail aktif
              </span>
            </div>
            <Link href="/" className="btn btn-secondary btn-sm mt-4">
              Kembali ke ringkasan
            </Link>
          </div>
        </div>
        <div className="card overflow-hidden">
          <div className="border-b border-line px-4 py-3">
            <p className="text-[0.72rem] font-bold text-ink-900">
              Matriks akses referensi
            </p>
            <p className="mt-0.5 text-[0.66rem] text-slate-500">
              Hak akses efektif per peran. “Kelola” mencakup aksi create/update.
            </p>
          </div>
          <AccessMatrix modules={ACCESS_MODULES} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[0.66rem] font-bold uppercase tracking-[0.14em] text-brand-700">
            Tata Kelola
          </p>
          <h1 className="mt-0.5 text-[1.35rem] font-extrabold tracking-tight text-ink-900 sm:text-[1.55rem]">
            Admin Management
          </h1>
          <p className="mt-1 max-w-3xl text-[0.78rem] leading-relaxed text-slate-500">
            Kelola pengguna, peran, status aktif, dan kontrol akses modul. Setiap
            perubahan dicatat pada log system yang tidak dapat diubah.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/audit" className="btn btn-secondary btn-sm">
            <ArrowUpRight size={14} /> Lihat log system
          </Link>
          <button type="button" className="btn btn-primary btn-sm" onClick={openCreate}>
            <UserPlus size={14} /> Tambah pengguna
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          label="Total pengguna"
          value={data?.stats.total ?? "—"}
          sub={`${data?.stats.admins ?? 0} admin aktif`}
          icon={<UsersRound size={17} />}
          tone="brand"
        />
        <MetricCard
          label="Akun aktif"
          value={data?.stats.active ?? "—"}
          sub={`${data?.stats.inactive ?? 0} akun nonaktif`}
          icon={<ShieldCheck size={17} />}
          tone="clean"
          delay="stagger-1"
        />
        <MetricCard
          label="Peran terdefinisi"
          value={data?.roles.length ?? "—"}
          sub="Maker, checker, approver, auditor, admin"
          icon={<UserCog size={17} />}
          tone="violet"
          delay="stagger-2"
        />
        <MetricCard
          label="Event audit"
          value={data?.stats.auditEvents ?? "—"}
          sub="Log WORM seluruh aktivitas"
          icon={<KeyRound size={17} />}
          tone="ink"
          delay="stagger-3"
        />
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-5">
        {data?.roleDistribution.map((role) => (
          <div key={role.role_code} className="card p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[0.68rem] font-bold text-ink-900">{role.label}</p>
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: role.color }}
              />
            </div>
            <p className="mt-1 text-[1.25rem] font-extrabold text-ink-900">
              {role.total}
              <span className="ml-1 text-[0.62rem] font-semibold text-slate-400">
                pengguna
              </span>
            </p>
            <p className="mt-0.5 text-[0.62rem] text-slate-400">
              {role.active} aktif
            </p>
          </div>
        ))}
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-col gap-2.5 border-b border-line px-3.5 py-3 lg:flex-row lg:items-center">
          <Tabs
            tabs={[
              { value: "pengguna", label: "Pengguna", count: data?.users.length },
              { value: "akses", label: "Matriks akses", count: ACCESS_MODULES.length },
            ]}
            value={tab}
            onChange={setTab}
          />
          {tab === "pengguna" ? (
            <div className="flex flex-1 flex-wrap items-center gap-2 lg:justify-end">
              <SearchInput
                value={query}
                onChange={setQuery}
                placeholder="Cari nama, username, email..."
                className="lg:max-w-xs"
              />
              <select
                className="select w-auto"
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value)}
              >
                <option value="">Semua peran</option>
                {data?.roles.map((role) => (
                  <option key={role.code} value={role.code}>
                    {role.label}
                  </option>
                ))}
              </select>
              <select
                className="select w-auto"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="">Semua status</option>
                <option value="active">Aktif</option>
                <option value="inactive">Nonaktif</option>
              </select>
            </div>
          ) : null}
        </div>

        {loading && !data ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, index) => (
              <Skeleton key={index} className="h-14 w-full" />
            ))}
          </div>
        ) : error ? (
          <EmptyState
            icon={<Lock size={22} />}
            title="Data pengguna tidak dapat dimuat"
            description={error}
            action={
              <button type="button" className="btn btn-secondary btn-sm" onClick={() => void load()}>
                Coba lagi
              </button>
            }
          />
        ) : tab === "akses" ? (
          <AccessMatrix modules={data?.accessModules ?? ACCESS_MODULES} />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<UsersRound size={22} />}
            title="Pengguna tidak ditemukan"
            description="Ubah filter atau kata kunci pencarian."
          />
        ) : (
          <div className="table-shell">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Pengguna</th>
                  <th>Peran</th>
                  <th>Cabang</th>
                  <th>Aktivitas</th>
                  <th className="text-right">Kasus aktif</th>
                  <th>Status</th>
                  <th className="text-right">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => {
                  const roleMeta = ROLE_META[item.role_code];
                  const self = item.id === user.id;
                  return (
                    <tr key={item.id}>
                      <td>
                        <div className="flex items-center gap-2.5">
                          <span
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[0.62rem] font-extrabold text-white"
                            style={{ background: item.avatar_color || roleMeta.color }}
                          >
                            {getInitials(item.full_name)}
                          </span>
                          <div className="min-w-0">
                            <p className="primary-cell">
                              {item.full_name}
                              {self ? (
                                <span className="ml-1.5 rounded bg-brand-50 px-1 py-0.5 text-[0.55rem] font-bold text-brand-700">
                                  Anda
                                </span>
                              ) : null}
                            </p>
                            <p className="mt-0.5 text-[0.62rem] text-slate-400">
                              {item.username} · {item.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span
                          className="badge border"
                          style={{
                            color: roleMeta.color,
                            borderColor: `${roleMeta.color}33`,
                            background: `${roleMeta.color}10`,
                          }}
                        >
                          {roleMeta.short}
                        </span>
                        <p className="mt-0.5 text-[0.58rem] text-slate-400">
                          {item.role_label}
                        </p>
                      </td>
                      <td className="mono text-[0.7rem]">{item.branch_code}</td>
                      <td className="text-[0.66rem] text-slate-500">
                        {item.last_activity_at
                          ? formatDateTimeId(item.last_activity_at)
                          : "Belum ada aktivitas"}
                      </td>
                      <td className="text-right text-[0.72rem]">{item.open_cases}</td>
                      <td>
                        <span
                          className={clsx(
                            "badge",
                            item.is_active ? "badge-clean" : "badge-neutral",
                          )}
                        >
                          {item.is_active ? "Aktif" : "Nonaktif"}
                        </span>
                      </td>
                      <td className="text-right">
                        <div className="flex justify-end gap-1.5">
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => openEdit(item)}
                          >
                            <Pencil size={12} /> Edit
                          </button>
                          <button
                            type="button"
                            className={clsx(
                              "btn btn-sm",
                              item.is_active
                                ? "btn-ghost text-rose-600 hover:bg-rose-50"
                                : "btn-secondary",
                            )}
                            onClick={() => toggleActive(item)}
                            disabled={togglingId === item.id || self}
                            title={self ? "Tidak dapat menonaktifkan akun sendiri" : undefined}
                          >
                            <Power size={12} />
                            {togglingId === item.id
                              ? "..."
                              : item.is_active
                                ? "Nonaktifkan"
                                : "Aktifkan"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="alert alert-info">
        <ShieldCheck size={16} className="mt-0.5 shrink-0" />
        <div>
          <p className="font-bold">Kontrol akses & pemisahan tugas</p>
          <p className="mt-0.5">
            Maker tidak dapat menyetujui pengajuannya sendiri. Keputusan final
            hanya dapat dilakukan Approver yang ditugaskan, dan submission
            laporan regulator memerlukan peran Approver. Admin tidak dapat
            menonaktifkan akunnya sendiri atau menghapus admin aktif terakhir.
          </p>
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? "Edit pengguna" : "Tambah pengguna"}
        description={
          editing
            ? "Perubahan peran dan status aktif akan langsung berlaku."
            : "Akun baru langsung aktif dan dapat menggunakan persona demo."
        }
        footer={
          <>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setModalOpen(false)}
              disabled={saving}
            >
              Batal
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={saveUser}
              disabled={
                saving ||
                !form.full_name.trim() ||
                !form.email.trim() ||
                (!editing && !form.username.trim())
              }
            >
              {saving ? "Menyimpan..." : editing ? "Simpan perubahan" : "Tambah pengguna"}
            </button>
          </>
        }
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="field-label">Nama lengkap</span>
            <input
              className="input"
              value={form.full_name}
              onChange={(event) => setForm({ ...form, full_name: event.target.value })}
              placeholder="Contoh: Siti Rahmawati"
            />
          </label>
          <label>
            <span className="field-label">Username</span>
            <input
              className="input"
              value={form.username}
              disabled={Boolean(editing)}
              onChange={(event) => setForm({ ...form, username: event.target.value })}
              placeholder="siti.rahmawati"
            />
          </label>
          <label>
            <span className="field-label">Email</span>
            <input
              className="input"
              type="email"
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              placeholder="siti@didimax.co.id"
            />
          </label>
          <label>
            <span className="field-label">Peran</span>
            <select
              className="select"
              value={form.role_code}
              onChange={(event) =>
                setForm({ ...form, role_code: event.target.value as RoleCode })
              }
            >
              {(Object.keys(ROLE_META) as RoleCode[]).map((role) => (
                <option key={role} value={role}>
                  {ROLE_META[role].label}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="field-label">Cabang / unit</span>
            <input
              className="input"
              value={form.branch_code}
              onChange={(event) => setForm({ ...form, branch_code: event.target.value })}
              placeholder="JKT-01"
            />
          </label>
          {editing ? (
            <label className="flex items-center gap-2.5 rounded-xl border border-line px-3 py-2.5 sm:col-span-2">
              <input
                type="checkbox"
                className="h-4 w-4 accent-brand-600"
                checked={form.is_active}
                onChange={(event) => setForm({ ...form, is_active: event.target.checked })}
              />
              <span>
                <span className="block text-[0.74rem] font-semibold text-ink-900">
                  Akun aktif
                </span>
                <span className="block text-[0.64rem] text-slate-400">
                  Nonaktifkan untuk mencabut akses tanpa menghapus jejak audit.
                </span>
              </span>
            </label>
          ) : null}
          <div className="rounded-xl bg-slate-50 px-3 py-2.5 text-[0.64rem] leading-relaxed text-slate-500 sm:col-span-2">
            <p className="font-semibold text-ink-800">{ROLE_META[form.role_code].label}</p>
            <p className="mt-0.5">{ROLE_META[form.role_code].description}</p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
