const catchAsync = require("../utils/catchAsync");
const analyticsService = require("../services/analyticsService");

const getDashboard = catchAsync(async (req, res) => {
  const dashboard = await analyticsService.getDashboardAnalytics(req.user);
  res.json({ success: true, data: dashboard });
});

module.exports = {
  getDashboard,
};
