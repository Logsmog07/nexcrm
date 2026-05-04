const catchAsync = require("../utils/catchAsync");
const leadService = require("../services/leadService");

const createLead = catchAsync(async (req, res) => {
  const lead = await leadService.createLead(req.body, req.user);
  res.status(201).json({ success: true, data: lead });
});

const listLeads = catchAsync(async (req, res) => {
  const leads = await leadService.listLeads(req.query, req.user);
  res.json({ success: true, data: leads });
});

const getLead = catchAsync(async (req, res) => {
  const lead = await leadService.getLeadById(req.params.id, req.user);
  res.json({ success: true, data: lead });
});

const updateLead = catchAsync(async (req, res) => {
  const lead = await leadService.updateLead(req.params.id, req.body, req.user);
  res.json({ success: true, data: lead });
});

const deleteLead = catchAsync(async (req, res) => {
  await leadService.deleteLead(req.params.id, req.user);
  res.json({ success: true, message: "Lead deleted successfully" });
});

const convertLead = catchAsync(async (req, res) => {
  const customer = await leadService.convertLead(req.params.id, req.user);
  res.json({
    success: true,
    message: "Lead converted successfully",
    data: customer,
  });
});

module.exports = {
  createLead,
  listLeads,
  getLead,
  updateLead,
  deleteLead,
  convertLead,
};
