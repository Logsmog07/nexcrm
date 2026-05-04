const catchAsync = require("../utils/catchAsync");
const activityService = require("../services/activityService");

const createActivity = catchAsync(async (req, res) => {
  const activity = await activityService.createActivity(req.body, req.user);
  res.status(201).json({ success: true, data: activity });
});

const listActivities = catchAsync(async (req, res) => {
  const activities = await activityService.listActivities(req.query, req.user);
  res.json({ success: true, data: activities });
});

const markActivityCompleted = catchAsync(async (req, res) => {
  const activity = await activityService.markCompleted(req.params.id, req.user);
  res.json({ success: true, data: activity });
});

module.exports = {
  createActivity,
  listActivities,
  markActivityCompleted,
};
