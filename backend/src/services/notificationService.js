const ApiError = require("../utils/ApiError");
const notificationRepository = require("../repositories/notificationRepository");

const listNotifications = async (userId) =>
  notificationRepository.listForUser(userId);

const markNotificationRead = async (id, userId) => {
  const notification = await notificationRepository.markAsRead(id, userId);
  if (!notification) {
    throw new ApiError(404, "Notification not found");
  }
  return notification;
};

module.exports = {
  listNotifications,
  markNotificationRead,
};
