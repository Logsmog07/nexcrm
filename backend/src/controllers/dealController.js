const catchAsync = require("../utils/catchAsync");
const dealService = require("../services/dealService");

const createDeal = catchAsync(async (req, res) => {
  const deal = await dealService.createDeal(req.body, req.user);
  res.status(201).json({ success: true, data: deal });
});

const listDeals = catchAsync(async (req, res) => {
  const deals = await dealService.listDeals(req.query, req.user);
  res.json({ success: true, data: deals });
});

const getDeal = catchAsync(async (req, res) => {
  const deal = await dealService.getDealById(req.params.id, req.user);
  res.json({ success: true, data: deal });
});

const updateDeal = catchAsync(async (req, res) => {
  const deal = await dealService.updateDeal(req.params.id, req.body, req.user);
  res.json({ success: true, data: deal });
});

const moveDeal = catchAsync(async (req, res) => {
  const deal = await dealService.moveDeal(req.params.id, req.body.stage, req.user);
  res.json({ success: true, data: deal });
});

const deleteDeal = catchAsync(async (req, res) => {
  await dealService.deleteDeal(req.params.id, req.user);
  res.json({ success: true, message: "Deal deleted successfully" });
});

module.exports = {
  createDeal,
  listDeals,
  getDeal,
  updateDeal,
  moveDeal,
  deleteDeal,
};
