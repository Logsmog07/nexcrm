const ApiError = require("../utils/ApiError");
const { pool } = require("../config/db");
const { LEAD_STATUSES } = require("../config/constants");
const { ensureEmail, ensureEnum, requireFields } = require("../utils/validators");
const { ensureOwnershipOrElevated, buildScopeForUser } = require("../utils/access");
const leadRepository = require("../repositories/leadRepository");
const activityRepository = require("../repositories/activityRepository");
const userRepository = require("../repositories/userRepository");

const getLeadInsight = (lead) => {
  let probability = 50;
  const reasons = [];

  if (!lead.email) {
    probability -= 15;
    reasons.push("Missing email reduces follow-up reliability");
  }

  if (!lead.company) {
    probability -= 10;
    reasons.push("No company context makes qualification harder");
  }

  if (lead.status === LEAD_STATUSES.NEW) {
    probability -= 5;
    reasons.push("New leads are still unproven");
  }

  if (lead.status === LEAD_STATUSES.QUALIFIED) {
    probability += 20;
    reasons.push("Qualified stage signals strong intent");
  }

  if ((lead.score || 0) >= 80) {
    probability += 15;
    reasons.push("High lead score suggests strong fit");
  }

  if (lead.last_contacted_at) {
    probability += 10;
    reasons.push("Recent outreach improves conversion odds");
  } else {
    probability -= 10;
    reasons.push("No recent contact detected");
  }

  const normalizedProbability = Math.max(5, Math.min(95, probability));

  return {
    probability: normalizedProbability,
    label:
      normalizedProbability >= 70
        ? "High conversion probability"
        : normalizedProbability >= 45
        ? "Moderate conversion probability"
        : "Low conversion probability",
    reasons,
  };
};

const createLead = async (payload, user) => {
  requireFields(payload, ["name", "email"]);
  ensureEmail(payload.email);
  ensureEnum(payload.status || LEAD_STATUSES.NEW, LEAD_STATUSES, "status");

  const lead = await leadRepository.create({
    ...payload,
    status: payload.status || LEAD_STATUSES.NEW,
    createdBy: user.id,
    companyId: user.company_id || null,
  });

  return {
    ...lead,
    insight: getLeadInsight(lead),
  };
};

const updateLead = async (id, payload, user) => {
  requireFields(payload, ["name", "email"]);
  ensureEmail(payload.email);
  ensureEnum(payload.status, LEAD_STATUSES, "status");

  const existingLead = await leadRepository.findById(id);
  if (!existingLead) {
    throw new ApiError(404, "Lead not found");
  }

  ensureOwnershipOrElevated({
    user,
    ownerId: existingLead.assigned_to,
    fallbackOwnerId: existingLead.created_by,
    resourceCompanyId: existingLead.company_id,
    resourceLabel: "lead",
  });

  const lead = await leadRepository.update(id, payload);

  return {
    ...lead,
    insight: getLeadInsight(lead),
  };
};

const listLeads = async (filters, user) => {
  const scopedFilters = {
    ...filters,
    ...(await buildScopeForUser(user, userRepository)),
  };

  const leads = await leadRepository.list(scopedFilters);
  return leads.map((lead) => ({
    ...lead,
    insight: getLeadInsight(lead),
  }));
};

const getLeadById = async (id, user) => {
  const lead = await leadRepository.findById(id);
  if (!lead) {
    throw new ApiError(404, "Lead not found");
  }

  ensureOwnershipOrElevated({
    user,
    ownerId: lead.assigned_to,
    fallbackOwnerId: lead.created_by,
    resourceCompanyId: lead.company_id,
    resourceLabel: "lead",
  });

  const activities = await activityRepository.list({
    relatedLeadId: id,
    ...(await buildScopeForUser(user, userRepository)),
  });
  return {
    ...lead,
    insight: getLeadInsight(lead),
    activities,
  };
};

const deleteLead = async (id, user) => {
  const lead = await leadRepository.findById(id);
  if (!lead) {
    throw new ApiError(404, "Lead not found");
  }

  ensureOwnershipOrElevated({
    user,
    ownerId: lead.assigned_to,
    fallbackOwnerId: lead.created_by,
    resourceCompanyId: lead.company_id,
    resourceLabel: "lead",
  });

  const removed = await leadRepository.remove(id);
  if (!removed) {
    throw new ApiError(404, "Lead not found");
  }
};

const convertLead = async (leadId, user) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const leadResult = await client.query("SELECT * FROM leads WHERE id = $1", [leadId]);
    const lead = leadResult.rows[0];

    if (!lead) {
      throw new ApiError(404, "Lead not found");
    }

    if (lead.status === LEAD_STATUSES.CONVERTED) {
      throw new ApiError(400, "Lead has already been converted");
    }

    const existingCustomerResult = await client.query(
      `SELECT * FROM customers WHERE lead_id = $1 LIMIT 1`,
      [leadId]
    );

    if (existingCustomerResult.rows[0]) {
      throw new ApiError(400, "A customer already exists for this lead");
    }

    ensureOwnershipOrElevated({
      user,
      ownerId: lead.assigned_to,
      fallbackOwnerId: lead.created_by,
      resourceCompanyId: lead.company_id,
      resourceLabel: "lead",
    });

    const customerResult = await client.query(
      `
        INSERT INTO customers (
          lead_id, name, email, phone, company, owner_id, company_id, lifecycle_stage, notes
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
        RETURNING *
      `,
      [
        lead.id,
        lead.name,
        lead.email,
        lead.phone,
        lead.company,
        lead.assigned_to || user.id,
        lead.company_id || user.company_id || null,
        "active",
        lead.notes,
      ]
    );

    await client.query(
      `UPDATE leads SET status = $2, updated_at = NOW() WHERE id = $1`,
      [leadId, LEAD_STATUSES.CONVERTED]
    );

    await client.query(
      `
        INSERT INTO activities (
          type, subject, notes, related_lead_id, related_customer_id, user_id
          , company_id
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7)
      `,
      [
        "note",
        "Lead converted to customer",
        "Lead successfully converted through the CRM workflow",
        lead.id,
        customerResult.rows[0].id,
        user.id,
        lead.company_id || user.company_id || null,
      ]
    );

    await client.query("COMMIT");

    return customerResult.rows[0];
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  createLead,
  updateLead,
  listLeads,
  getLeadById,
  deleteLead,
  convertLead,
};
