const ApiError = require("../utils/ApiError");
const { ensureEmail, requireFields } = require("../utils/validators");
const { ensureOwnershipOrElevated, isSalesRep, buildScopeForUser } = require("../utils/access");
const customerRepository = require("../repositories/customerRepository");
const activityRepository = require("../repositories/activityRepository");
const userRepository = require("../repositories/userRepository");

const createCustomer = async (payload, user) => {
  if (isSalesRep(user)) {
    throw new ApiError(403, "Sales reps cannot create customers directly");
  }
  requireFields(payload, ["name", "email"]);
  ensureEmail(payload.email);
  return customerRepository.create({
    ...payload,
    companyId: user.company_id || null,
  });
};

const updateCustomer = async (id, payload, user) => {
  requireFields(payload, ["name", "email"]);
  ensureEmail(payload.email);
  const existingCustomer = await customerRepository.findById(id);
  if (!existingCustomer) {
    throw new ApiError(404, "Customer not found");
  }

  ensureOwnershipOrElevated({
    user,
    ownerId: existingCustomer.owner_id,
    resourceCompanyId: existingCustomer.company_id,
    resourceLabel: "customer",
  });

  const customer = await customerRepository.update(id, payload);
  return customer;
};

const listCustomers = async (filters, user) => {
  const scopedFilters = {
    ...filters,
    ...(await buildScopeForUser(user, userRepository)),
  };
  return customerRepository.list(scopedFilters);
};

const getCustomerById = async (id, user) => {
  const customer = await customerRepository.findById(id);
  if (!customer) {
    throw new ApiError(404, "Customer not found");
  }

  ensureOwnershipOrElevated({
    user,
    ownerId: customer.owner_id,
    resourceCompanyId: customer.company_id,
    resourceLabel: "customer",
  });

  const activities = await activityRepository.list({
    relatedCustomerId: id,
    ...(await buildScopeForUser(user, userRepository)),
  });
  return {
    ...customer,
    activities,
  };
};

const deleteCustomer = async (id, user) => {
  const customer = await customerRepository.findById(id);
  if (!customer) {
    throw new ApiError(404, "Customer not found");
  }

  ensureOwnershipOrElevated({
    user,
    ownerId: customer.owner_id,
    resourceCompanyId: customer.company_id,
    resourceLabel: "customer",
  });

  const removed = await customerRepository.remove(id);
  if (!removed) {
    throw new ApiError(404, "Customer not found");
  }
};

module.exports = {
  createCustomer,
  updateCustomer,
  listCustomers,
  getCustomerById,
  deleteCustomer,
};
