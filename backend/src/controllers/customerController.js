const catchAsync = require("../utils/catchAsync");
const customerService = require("../services/customerService");

const createCustomer = catchAsync(async (req, res) => {
  const customer = await customerService.createCustomer(req.body, req.user);
  res.status(201).json({ success: true, data: customer });
});

const listCustomers = catchAsync(async (req, res) => {
  const customers = await customerService.listCustomers(req.query, req.user);
  res.json({ success: true, data: customers });
});

const getCustomer = catchAsync(async (req, res) => {
  const customer = await customerService.getCustomerById(req.params.id, req.user);
  res.json({ success: true, data: customer });
});

const updateCustomer = catchAsync(async (req, res) => {
  const customer = await customerService.updateCustomer(req.params.id, req.body, req.user);
  res.json({ success: true, data: customer });
});

const deleteCustomer = catchAsync(async (req, res) => {
  await customerService.deleteCustomer(req.params.id, req.user);
  res.json({ success: true, message: "Customer deleted successfully" });
});

module.exports = {
  createCustomer,
  listCustomers,
  getCustomer,
  updateCustomer,
  deleteCustomer,
};
