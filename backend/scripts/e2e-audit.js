const app = require("../src/app");
const { pool } = require("../src/config/db");

const PORT = 3111;
const BASE_URL = `http://127.0.0.1:${PORT}/api`;
const PASSWORD = "Password123!";

const creds = {
  platformAdmin: { email: "admin@crm.local", password: PASSWORD },
  companyAdmin: { email: "companyadmin@crm.local", password: PASSWORD },
  manager: { email: "manager@crm.local", password: PASSWORD },
  salesRep: { email: "sales@crm.local", password: PASSWORD },
};

const auditResults = [];

const record = (name, passed, detail) => {
  auditResults.push({ name, passed, detail });
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const request = async (path, { method = "GET", token, body } = {}) => {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  let json = null;
  try {
    json = await response.json();
  } catch {
    json = null;
  }

  return { status: response.status, ok: response.ok, json };
};

const assertStatus = async (name, promise, expectedStatus, detailBuilder) => {
  const result = await promise;
  const passed = result.status === expectedStatus;
  record(
    name,
    passed,
    detailBuilder
      ? detailBuilder(result)
      : `${result.status}${result.json?.message ? ` · ${result.json.message}` : ""}`
  );

  if (!passed) {
    throw new Error(`${name} expected ${expectedStatus} but received ${result.status}`);
  }

  return result;
};

const login = async ({ email, password }) => {
  const result = await request("/auth/login", {
    method: "POST",
    body: { email, password },
  });

  if (result.status !== 200 || !result.json?.token) {
    throw new Error(`Login failed for ${email}: ${result.status} ${result.json?.message || ""}`);
  }

  return result.json;
};

const run = async () => {
  const server = app.listen(PORT);

  try {
    await sleep(150);

    const platformAdmin = await login(creds.platformAdmin);
    const companyAdmin = await login(creds.companyAdmin);
    const manager = await login(creds.manager);
    const salesRep = await login(creds.salesRep);

    record("Platform admin login", platformAdmin.user.role === "platform_admin", platformAdmin.user.email);
    record("Company admin login", companyAdmin.user.role === "company_admin", companyAdmin.user.email);
    record("Manager login", manager.user.role === "manager", manager.user.email);
    record("Sales rep login", salesRep.user.role === "sales_rep", salesRep.user.email);

    await assertStatus(
      "Platform admin can inspect companies",
      request("/companies", { token: platformAdmin.token }),
      200,
      (result) => `${result.json?.data?.length || 0} companies`
    );

    await assertStatus(
      "Platform admin blocked from tenant leads",
      request("/leads", { token: platformAdmin.token }),
      403
    );

    await assertStatus(
      "Company admin blocked from platform companies",
      request("/companies", { token: companyAdmin.token }),
      403
    );

    const companyAdminUsers = await assertStatus(
      "Company admin can inspect company users",
      request("/users", { token: companyAdmin.token }),
      200,
      (result) => `${result.json?.data?.length || 0} workspace users`
    );

    const managerUsers = await assertStatus(
      "Manager can inspect managed users",
      request("/users", { token: manager.token }),
      200,
      (result) => `${result.json?.data?.length || 0} visible users`
    );

    await assertStatus(
      "Manager blocked from creating users",
      request("/users", {
        token: manager.token,
        method: "POST",
        body: {
          fullName: "Should Fail",
          email: `manager-blocked-${Date.now()}@crm.local`,
          password: PASSWORD,
          companyId: manager.user.company_id,
          companyRole: "sales_rep",
          managerId: manager.user.id,
        },
      }),
      403
    );

    await assertStatus(
      "Sales rep blocked from analytics",
      request("/analytics/dashboard", { token: salesRep.token }),
      403
    );

    await assertStatus(
      "Sales rep can access scoped leads",
      request("/leads", { token: salesRep.token }),
      200,
      (result) => `${result.json?.data?.length || 0} leads visible`
    );

    const tempSuffix = Date.now();

    const companyCreate = await assertStatus(
      "Platform admin can create company",
      request("/companies", {
        token: platformAdmin.token,
        method: "POST",
        body: {
          name: `Audit Co ${tempSuffix}`,
          email: `audit-company-${tempSuffix}@crm.local`,
          phone: "+1-555-0101",
          industry: "Technology",
          companySize: "11-25",
          address: "123 Audit Street",
          subscriptionPlan: "starter",
          status: "trial",
        },
      }),
      201,
      (result) => result.json?.data?.name || "created"
    );

    const tempCompanyId = companyCreate.json.data.id;

    await assertStatus(
      "Platform admin can activate company",
      request(`/companies/${tempCompanyId}/status`, {
        token: platformAdmin.token,
        method: "PATCH",
        body: { status: "active" },
      }),
      200
    );

    await assertStatus(
      "Platform admin can delete empty company",
      request(`/companies/${tempCompanyId}`, {
        token: platformAdmin.token,
        method: "DELETE",
      }),
      200
    );

    const existingUsers = companyAdminUsers.json?.data || [];
    const existingManagers = existingUsers.filter((user) => user.role === "manager");
    const destinationManager =
      existingManagers.find((user) => String(user.id) !== String(manager.user.id)) || manager.user;

    const createdManager = await assertStatus(
      "Platform admin can create manager",
      request("/users", {
        token: platformAdmin.token,
        method: "POST",
        body: {
          fullName: `Audit Manager ${tempSuffix}`,
          email: `audit-manager-${tempSuffix}@crm.local`,
          password: PASSWORD,
          companyId: companyAdmin.user.company_id,
          companyRole: "manager",
        },
      }),
      201,
      (result) => result.json?.data?.email || "manager created"
    );

    const createdRep = await assertStatus(
      "Platform admin can create sales rep",
      request("/users", {
        token: platformAdmin.token,
        method: "POST",
        body: {
          fullName: `Audit Rep ${tempSuffix}`,
          email: `audit-rep-${tempSuffix}@crm.local`,
          password: PASSWORD,
          companyId: companyAdmin.user.company_id,
          companyRole: "sales_rep",
          managerId: createdManager.json.data.id,
        },
      }),
      201,
      (result) => result.json?.data?.email || "rep created"
    );

    await assertStatus(
      "Platform admin can reset user password",
      request(`/users/${createdRep.json.data.id}/password`, {
        token: platformAdmin.token,
        method: "PATCH",
        body: { password: "AuditPass123" },
      }),
      200
    );

    await assertStatus(
      "Platform admin can reassign sales rep",
      request(`/users/${createdRep.json.data.id}/manager`, {
        token: platformAdmin.token,
        method: "PATCH",
        body: { managerId: destinationManager.id },
      }),
      200
    );

    await assertStatus(
      "Platform admin can deactivate user",
      request(`/users/${createdRep.json.data.id}/status`, {
        token: platformAdmin.token,
        method: "PATCH",
        body: { isActive: false },
      }),
      200
    );

    await assertStatus(
      "Company admin cannot deactivate another company admin",
      request(`/users/${companyAdmin.user.id}/status`, {
        token: companyAdmin.token,
        method: "PATCH",
        body: { isActive: false },
      }),
      403
    );

    const createdLead = await assertStatus(
      "Sales rep can create lead",
      request("/leads", {
        token: salesRep.token,
        method: "POST",
        body: {
          name: `Audit Lead ${tempSuffix}`,
          email: `audit-lead-${tempSuffix}@crm.local`,
          phone: "+1-555-0202",
          company: "Audit Accounts",
          source: "manual",
          status: "new",
          assignedTo: salesRep.user.id,
          estimatedValue: 42000,
          notes: "Created during end-to-end audit",
        },
      }),
      201,
      (result) => result.json?.data?.name || "lead created"
    );

    const leadId = createdLead.json.data.id;

    await assertStatus(
      "Sales rep can update own lead",
      request(`/leads/${leadId}`, {
        token: salesRep.token,
        method: "PUT",
        body: {
          name: `Audit Lead ${tempSuffix}`,
          email: `audit-lead-${tempSuffix}@crm.local`,
          phone: "+1-555-0202",
          company: "Audit Accounts",
          source: "manual",
          status: "qualified",
          assignedTo: salesRep.user.id,
          estimatedValue: 52000,
          notes: "Qualified during audit",
        },
      }),
      200
    );

    const convertedCustomer = await assertStatus(
      "Sales rep can convert assigned lead",
      request(`/leads/${leadId}/convert`, {
        token: salesRep.token,
        method: "POST",
      }),
      200,
      (result) => result.json?.data?.name || "lead converted"
    );

    const customerId = convertedCustomer.json.data.id;

    const createdDeal = await assertStatus(
      "Sales rep can create deal",
      request("/deals", {
        token: salesRep.token,
        method: "POST",
        body: {
          title: `Audit Deal ${tempSuffix}`,
          customerId,
          ownerId: salesRep.user.id,
          stage: "discovery",
          value: 52000,
          probability: 55,
          expectedCloseDate: "2026-05-01",
        },
      }),
      201,
      (result) => result.json?.data?.title || "deal created"
    );

    const dealId = createdDeal.json.data.id;

    await assertStatus(
      "Sales rep can move own deal",
      request(`/deals/${dealId}/stage`, {
        token: salesRep.token,
        method: "PATCH",
        body: { stage: "proposal" },
      }),
      200
    );

    const createdActivity = await assertStatus(
      "Sales rep can create activity",
      request("/activities", {
        token: salesRep.token,
        method: "POST",
        body: {
          type: "call",
          subject: `Audit call ${tempSuffix}`,
          notes: "Scheduled during end-to-end audit",
          dueAt: "2026-04-15T10:00",
          relatedCustomerId: customerId,
          relatedDealId: dealId,
          userId: salesRep.user.id,
        },
      }),
      201,
      (result) => result.json?.data?.subject || "activity created"
    );

    await assertStatus(
      "Sales rep can complete own activity",
      request(`/activities/${createdActivity.json.data.id}/complete`, {
        token: salesRep.token,
        method: "PATCH",
      }),
      200
    );

    const failed = auditResults.filter((item) => !item.passed);
    console.log(JSON.stringify({ passed: failed.length === 0, results: auditResults }, null, 2));

    if (failed.length) {
      process.exitCode = 1;
    }
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await pool.end();
  }
};

run().catch(async (error) => {
  console.error(error);
  try {
    await pool.end();
  } catch {}
  process.exit(1);
});
