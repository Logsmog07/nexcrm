const catchAsync = require("../utils/catchAsync");
const notificationService = require("../services/notificationService");

const listNotifications = catchAsync(async (req, res) => {
  const notifications = await notificationService.listNotifications(req.user.id);
  res.json({ success: true, data: notifications });
});

const markAsRead = catchAsync(async (req, res) => {
  const notification = await notificationService.markNotificationRead(
    req.params.id,
    req.user.id
  );
  res.json({ success: true, data: notification });
});

module.exports = {
  listNotifications,
  markAsRead,
};
