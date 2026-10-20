const BASE = process.env.SMOKE_BASE ?? "http://localhost:3000";

const USERS = {
  maker: "user-analyst",
  checker: "user-supervisor",
  approver: "user-approver",
  auditor: "user-auditor",
  admin: "user-admin",
};

let passed = 0;

function check(condition, label, detail) {
  if (!condition) {
    console.error(`FAIL  ${label}${detail ? ` — ${detail}` : ""}`);
    process.exitCode = 1;
    throw new Error(label);
  }
  passed += 1;
  console.log(`ok    ${label}`);
}

async function request(path, { user = USERS.maker, method = "GET", body, raw } = {}) {
  const headers = { "x-user-id": user };
  let payload = body;
  if (body && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: payload,
    cache: "no-store",
  });
  if (raw) {
    const buffer = Buffer.from(await response.arrayBuffer());
    return { response, buffer };
  }
  const contentType = response.headers.get("content-type") ?? "";
  const data = contentType.includes("application/json")
    ? await response.json()
    : await response.text();
  return { response, data };
}

async function json(path, options) {
  const { response, data } = await request(path, options);
  if (!response.ok) {
    throw new Error(`${path} -> ${response.status}: ${JSON.stringify(data)}`);
  }
  return data;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const response = await fetch(`${BASE}/api/users`, { cache: "no-store" });
      if (response.ok) return;
    } catch {
      // server not ready yet
    }
    await sleep(1000);
  }
  throw new Error("Server tidak siap setelah 60 detik.");
}

async function main() {
  await waitForServer();
  console.log(`\nSmoke test terhadap ${BASE}\n`);

  // Reset agar pengujian deterministik.
  await json("/api/demo/reset", { method: "POST", user: "user-admin" });

  const users = await json("/api/users");
  check(users.users.length >= 5, "GET /api/users mengembalikan 5 persona aktif");
  check(
    users.users.some((user) => user.role_code === "ADMIN"),
    "Persona Admin tersedia untuk tata kelola",
  );

  const dashboard = await json("/api/dashboard");
  check(dashboard.metrics.totalScreened > 0, "Dashboard memiliki metrik screening");
  check(
    Array.isArray(dashboard.recentMatches) && dashboard.recentMatches.length > 0,
    "Dashboard memuat recent matches",
  );
  check(
    dashboard.dataUniverse?.customers >= 40 &&
      dashboard.dataUniverse?.dttotEntities > 0 &&
      dashboard.dataUniverse?.apupptEntities > 0,
    "Dashboard memisahkan jumlah nasabah, DTTOT, dan APU-PPT",
  );

  const watchlist = await json("/api/watchlist");
  check(watchlist.sources.length >= 5, "Watchlist memiliki 5 sumber sanksi");
  check(watchlist.entities.length >= 10, "Watchlist memiliki entitas sanksi");

  const dttot = await json("/api/watchlist?category=DTTOT");
  check(
    dttot.entities.length > 0 &&
      dttot.entities.every((entity) => entity.source_code === "DTTOT"),
    "Dataset DTTOT hanya memuat entitas DTTOT",
  );
  const apuppt = await json("/api/watchlist?category=APUPPT");
  check(
    apuppt.entities.length > 0 &&
      apuppt.entities.every((entity) => entity.source_code !== "DTTOT"),
    "Dataset APU-PPT memuat DPPSPM, PEP, dan UN Sanctions",
  );

  const customers = await json("/api/customers?limit=100");
  check(
    customers.metrics?.total >= 40 && customers.items.length > 0,
    "Manajemen data nasabah mengembalikan daftar & metrik",
  );
  check(
    customers.items.every(
      (item) =>
        item.quality?.score >= 0 &&
        item.quality?.score <= 100 &&
        ["A", "B", "C", "D"].includes(item.quality?.grade),
    ),
    "Skor kualitas nasabah dihitung untuk setiap baris",
  );

  const firstCustomer = customers.items[0];
  const customerDetail = await json(`/api/customers/${firstCustomer.id}`);
  check(
    customerDetail.customer?.national_id_number &&
      Array.isArray(customerDetail.customer?.transactions) &&
      Array.isArray(customerDetail.customer?.employment_history),
    "Profil nasabah memuat identitas, transaksi, dan riwayat kepegawaian",
  );

  const patchedCustomer = await json("/api/customers/cust-001", {
    method: "PATCH",
    body: {
      occupation: "Analis Kepatuhan",
      source_of_fund: "Gaji / payroll",
      risk_rating: "MEDIUM",
    },
  });
  check(
    patchedCustomer.customer?.occupation === "Analis Kepatuhan" &&
      patchedCustomer.customer?.risk_rating === "MEDIUM",
    "Profil nasabah dapat diperbarui melalui manajemen data",
  );

  const search = await json("/api/search?q=syarif");
  check(
    search.total > 0 &&
      search.customers.length > 0 &&
      search.entities.length > 0,
    "Smart Search menemukan nasabah & entitas watchlist",
  );

  const matching = await json("/api/matching");
  check(
    matching.snapshot?.customers >= 40 &&
      matching.snapshot?.sourceCoverage?.length >= 4,
    "Snapshot matching engine memuat cakupan sumber",
  );
  const sync = await json("/api/matching", { method: "POST" });
  check(
    sync.summary?.customersEvaluated === matching.snapshot.customers &&
      sync.summary?.entitiesEvaluated > 0 &&
      sync.summary?.jobIds?.length > 0,
    "Sinkronisasi matching engine berjalan atas seluruh nasabah",
  );

  const adminDenied = await request("/api/admin/users", { user: USERS.maker });
  check(
    !adminDenied.response.ok,
    "Admin management menolak peran non-admin",
    JSON.stringify(adminDenied.data),
  );
  const adminUsers = await json("/api/admin/users", { user: USERS.admin });
  check(
    adminUsers.stats?.total >= 5 &&
      adminUsers.accessModules?.length >= 8 &&
      adminUsers.roleDistribution?.length === 5,
    "Admin management memuat pengguna, peran, dan matriks akses",
  );
  const createdUser = await json("/api/admin/users", {
    method: "POST",
    user: USERS.admin,
    body: {
      full_name: "Smoke Auditor",
      username: "smoke.auditor",
      email: "smoke.auditor@didimax.co.id",
      role_code: "AUDITOR",
      branch_code: "IA",
    },
  });
  check(
    createdUser.user?.username === "smoke.auditor" &&
      createdUser.user?.is_active === true,
    "Admin dapat menambahkan pengguna baru",
  );
  const mutatedUser = await json("/api/admin/users", {
    method: "PATCH",
    user: USERS.admin,
    body: {
      id: createdUser.user.id,
      role_code: "ADMIN",
      is_active: false,
    },
  });
  check(
    mutatedUser.user?.role_code === "ADMIN" &&
      mutatedUser.user?.is_active === false,
    "Admin dapat mengubah peran & menonaktifkan akun",
  );

  const screeningList = await json("/api/screening");
  check(Array.isArray(screeningList.batches), "Riwayat batch screening tersedia");

  // Upload template nasabah melalui jalur nyata (xlsx -> multipart -> engine).
  const { buffer: template } = await request("/api/screening/template", { raw: true });
  check(template.subarray(0, 2).toString() === "PK", "Template nasabah valid (xlsx)");

  const form = new FormData();
  form.append(
    "file",
    new Blob([template], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
    "Smoke_Test_Nasabah.xlsx",
  );
  const upload = await json("/api/screening/upload", {
    method: "POST",
    body: form,
  });
  check(upload.batch?.id && upload.job?.id, "Upload Excel membuat batch & job");
  check(upload.staged_count >= 1, "Excel berhasil diparse menjadi data nasabah");

  const jobDetail = await json(`/api/screening/${upload.batch.id}`);
  check(
    jobDetail.job?.job_status === "COMPLETED",
    "Job screening selesai diproses",
  );

  // Buat kasus dari match yang belum ditangani.
  const matches = await json("/api/matches?status=unhandled&pageSize=100");
  check(matches.items.length > 0, "Terdapat match yang belum ditangani");
  const target = matches.items[0];

  const created = await json(`/api/matches/${target.id}/case`, {
    method: "POST",
    body: {
      recommendation: "CONFIRM_HIT",
      note: "Smoke test: identitas dan tanggal lahir sesuai dengan profil DTTOT pada watchlist.",
      priority: "HIGH",
    },
  });
  const caseId = created.case.id;
  check(created.case.case_status === "OPEN", "Kasus baru berhasil dibuka");

  const submitted = await json(`/api/cases/${caseId}/submit`, {
    method: "POST",
    body: { decision_reason: "Smoke test pengajuan maker-checker." },
  });
  const approvalId = submitted.approval.id;

  const casesAfterSubmit = await json("/api/cases");
  const pending = casesAfterSubmit.approvals.find((item) => item.id === approvalId);
  check(
    pending?.current_step === "CHECKER_REVIEW",
    "Approval masuk tahap Checker",
  );

  // Maker tidak boleh menyetujui pengajuannya sendiri.
  const selfApprove = await request(`/api/approvals/${approvalId}/decision`, {
    method: "POST",
    user: USERS.maker,
    body: { action: "APPROVE", decision_reason: "Mencoba self approval." },
  });
  check(
    !selfApprove.response.ok,
    "Four-eyes: maker ditolak saat menyetujui sendiri",
    JSON.stringify(selfApprove.data),
  );

  await json(`/api/approvals/${approvalId}/decision`, {
    method: "POST",
    user: USERS.checker,
    body: {
      action: "APPROVE",
      decision_reason: "Smoke test: kelengkapan bukti dan analisis terverifikasi.",
    },
  });
  const final = await json(`/api/approvals/${approvalId}/decision`, {
    method: "POST",
    user: USERS.approver,
    body: {
      action: "APPROVE",
      decision_reason:
        "Smoke test: confirmed hit DTTOT, pemblokiran serta-merta diterbitkan.",
      legal_warrant_number: "SPRIN/SMOKE/TEST/2026",
      total_balance_frozen: 750000000,
    },
  });
  check(
    final.approval?.final_verdict === "CONFIRMED_TERRORIST_HIT",
    "Approver menetapkan Confirmed Hit",
  );
  check(
    final.freeze?.freeze_status === "ACTIVE_FROZEN",
    "Pemblokiran rekening otomatis terbit",
  );

  const casesFinal = await json("/api/cases");
  const closed = casesFinal.cases.find((item) => item.id === caseId);
  check(closed?.status === "CLOSED", "Kasus tertutup setelah keputusan final");
  check(closed?.freeze_status === "ACTIVE_FROZEN", "Status freeze terlihat di kasus");

  // Laporan LTKM: draft -> ready -> submit.
  const report = await json("/api/reports", {
    method: "POST",
    body: { case_id: caseId, report_type: "LTKM_PPATK" },
  });
  check(report.report?.submission_status === "DRAFT", "Draft LTKM berhasil dibuat");

  await json(`/api/reports/${report.report.id}`, {
    method: "PATCH",
    body: { action: "MARK_READY" },
  });
  const submittedReport = await json(`/api/reports/${report.report.id}`, {
    method: "PATCH",
    user: USERS.approver,
    body: { action: "SUBMIT" },
  });
  check(
    submittedReport.report?.submission_status === "SUBMITTED",
    "Laporan LTKM terkirim setelah tanda tangan Approver",
  );

  const { response: xmlResponse, buffer: xmlBuffer } = await request(
    `/api/reports/${report.report.id}/download`,
    { raw: true },
  );
  const xml = xmlBuffer.toString("utf8");
  check(xmlResponse.ok && xml.includes("<LTKM>"), "XML LTKM dapat diunduh");
  check(
    xml.includes("PT DIDI MAX BERJANGKA"),
    "XML memuat identitas institusi pelapor",
  );

  const reports = await json("/api/reports");
  check(
    reports.items.some(
      (item) =>
        item.id === report.report.id && item.submission_status === "SUBMITTED",
    ),
    "Register laporan memuat laporan terkirim",
  );
  check(
    reports.confirmedCases.some((item) => item.id === caseId),
    "Confirmed hit muncul pada daftar pelaporan",
  );

  const audit = await json("/api/audit?pageSize=100");
  check(audit.items.length > 0, "Audit trail terisi");
  check(
    audit.items.some((log) => log.action_name === "FINAL_APPROVAL"),
    "Audit mencatat keputusan final",
  );
  check(
    Array.isArray(audit.metrics.byModule) && audit.metrics.byModule.length >= 3,
    "Distribusi modul audit tersedia",
  );
  check(
    audit.items.some((log) => log.action_name === "UPDATE_CUSTOMER"),
    "Log system mencatat perubahan profil nasabah",
  );
  check(
    audit.items.some((log) => log.action_name === "RUN_MATCHING_SYNC"),
    "Log system mencatat sinkronisasi matching",
  );
  check(
    audit.items.some((log) => log.action_name === "CREATE_USER"),
    "Log system mencatat pembuatan pengguna",
  );

  const { response: customerXlsx, buffer: customerBuffer } = await request(
    "/api/customers/export",
    { raw: true },
  );
  check(
    customerXlsx.ok && customerBuffer.subarray(0, 2).toString() === "PK",
    "Export data nasabah menghasilkan workbook xlsx",
  );

  const { response: watchlistXlsx, buffer: watchlistBuffer } = await request(
    "/api/watchlist/export?category=APUPPT",
    { raw: true },
  );
  check(
    watchlistXlsx.ok && watchlistBuffer.subarray(0, 2).toString() === "PK",
    "Export dataset APU-PPT menghasilkan workbook xlsx",
  );

  const { response: auditXlsx, buffer: auditBuffer } = await request(
    "/api/audit/export",
    { user: USERS.auditor, raw: true },
  );
  check(
    auditXlsx.ok && auditBuffer.subarray(0, 2).toString() === "PK",
    "Export audit trail menghasilkan workbook xlsx",
  );

  const { response: rekapXlsx, buffer: rekapBuffer } = await request(
    "/api/export/screening",
    { user: USERS.auditor, raw: true },
  );
  check(
    rekapXlsx.ok && rekapBuffer.subarray(0, 2).toString() === "PK",
    "Export rekap OJK menghasilkan workbook xlsx",
  );

  // Kembalikan data demo ke kondisi awal.
  await json("/api/demo/reset", { method: "POST", user: "user-admin" });
  const afterReset = await json("/api/reports");
  check(
    afterReset.items.length === 3 &&
      !afterReset.items.some(
        (item) => item.reference_number === submittedReport.report.reference_number,
      ),
    "Database demo berhasil di-reset",
  );
  const afterResetUsers = await json("/api/users");
  check(
    !afterResetUsers.users.some((user) => user.username === "smoke.auditor"),
    "Reset menghapus pengguna hasil smoke test",
  );
  const afterResetCustomer = await json("/api/customers/cust-001");
  check(
    afterResetCustomer.customer?.occupation !== "Analis Kepatuhan",
    "Reset mengembalikan perubahan profil nasabah",
  );

  console.log(`\nSELESAI: ${passed} pemeriksaan lulus.\n`);
}

main().catch((error) => {
  console.error(`\nSmoke test gagal: ${error.message}\n`);
  process.exitCode = 1;
});
