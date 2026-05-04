const ApiError = require("../utils/ApiError");
const { DEAL_STAGES } = require("../config/constants");
const { ensureEnum, requireFields } = require("../utils/validators");
const { ensureOwnershipOrElevated, isSalesRep, buildScopeForUser } = require("../utils/access");
const dealRepository = require("../repositories/dealRepository");
const customerRepository = require("../repositories/customerRepository");
const userRepository = require("../repositories/userRepository");

const createDeal = async (payload, user) => {
  requireFields(payload, ["title", "stage"]);
  ensureEnum(payload.stage, DEAL_STAGES, "stage");
  if (!payload.customerId && !payload.leadId) {
    throw new ApiError(400, "A deal must be linked to either a customer or a lead");
  }

  if (isSalesRep(user) && payload.ownerId && String(payload.ownerId) !== String(user.id)) {
    throw new ApiError(403, "Sales reps can only create deals assigned to themselves");
  }

  const deal = await dealRepository.create({
    ...payload,
    ownerId: payload.ownerId || user.id,
    companyId: user.company_id || null,
  });

  if (payload.stage === DEAL_STAGES.WON && payload.customerId) {
    const customer = await customerRepository.findById(payload.customerId);
    if (customer) {
      await customerRepository.updateRevenue(
        payload.customerId,
        Number(customer.total_revenue || 0) + Number(payload.value || 0)
      );
    }
  }

  return deal;
};

const updateDeal = async (id, payload, user) => {
  requireFields(payload, ["title", "stage"]);
  ensureEnum(payload.stage, DEAL_STAGES, "stage");
  if (!payload.customerId && !payload.leadId) {
    throw new ApiError(400, "A deal must be linked to either a customer or a lead");
  }
  const existingDeal = await dealRepository.findById(id);
  if (!existingDeal) {
    throw new ApiError(404, "Deal not found");
  }

  ensureOwnershipOrElevated({
    user,
    ownerId: existingDeal.owner_id,
    resourceCompanyId: existingDeal.company_id,
    resourceLabel: "deal",
  });

  if (isSalesRep(user) && payload.ownerId && String(payload.ownerId) !== String(user.id)) {
    throw new ApiError(403, "Sales reps can only reassign deals to themselves");
  }
  const deal = await dealRepository.update(id, payload);
  return deal;
};

const moveDeal = async (id, stage, user) => {
  ensureEnum(stage, DEAL_STAGES, "stage");
  const existingDeal = await dealRepository.findById(id);
  if (!existingDeal) {
    throw new ApiError(404, "Deal not found");
  }

  ensureOwnershipOrElevated({
    user,
    ownerId: existingDeal.owner_id,
    resourceLabel: "deal",
  });

  const deal = await dealRepository.updateStage(id, stage);
  return deal;
};

const listDeals = async (filters, user) => {
  const scopedFilters = {
    ...filters,
    ...(await buildScopeForUser(user, userRepository)),
  };
  return dealRepository.list(scopedFilters);
};

const getDealById = async (id, user) => {
  const deal = await dealRepository.findById(id);
  if (!deal) {
    throw new ApiError(404, "Deal not found");
  }
  ensureOwnershipOrElevated({
    user,
    ownerId: deal.owner_id,
    resourceCompanyId: deal.company_id,
    resourceLabel: "deal",
  });
  return deal;
};

const deleteDeal = async (id, user) => {
  const deal = await dealRepository.findById(id);
  if (!deal) {
    throw new ApiError(404, "Deal not found");
  }
  ensureOwnershipOrElevated({
    user,
    ownerId: deal.owner_id,
    resourceCompanyId: deal.company_id,
    resourceLabel: "deal",
  });
  const removed = await dealRepository.remove(id);
  if (!removed) {
    throw new ApiError(404, "Deal not found");
  }
};

module.exports = {
  createDeal,
  updateDeal,
  moveDeal,
  listDeals,
  getDealById,
  deleteDeal,
};
