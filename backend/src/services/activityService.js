const ApiError = require("../utils/ApiError");
const { ACTIVITY_TYPES } = require("../config/constants");
const { ensureEnum, requireFields } = require("../utils/validators");
const { ensureOwnershipOrElevated, isSalesRep, buildScopeForUser } = require("../utils/access");
const activityRepository = require("../repositories/activityRepository");
const notificationRepository = require("../repositories/notificationRepository");
const userRepository = require("../repositories/userRepository");

const createActivity = async (payload, user) => {
  requireFields(payload, ["type", "subject"]);
  ensureEnum(payload.type, ACTIVITY_TYPES, "type");
  const hasRelation =
    payload.relatedLeadId || payload.relatedCustomerId || payload.relatedDealId;

  if (!hasRelation && !["note", "task"].includes(payload.type)) {
    throw new ApiError(
      400,
      "Calls, emails, and meetings must be linked to a lead, customer, or deal"
    );
  }

  if (isSalesRep(user) && payload.userId && String(payload.userId) !== String(user.id)) {
    throw new ApiError(403, "Sales reps can only create activities for themselves");
  }

  const activity = await activityRepository.create({
    ...payload,
    userId: payload.userId || user.id,
    companyId: user.company_id || null,
  });

  if (payload.dueAt) {
    await notificationRepository.create({
      userId: payload.userId || user.id,
      companyId: user.company_id || null,
      type: "reminder",
      title: `Upcoming ${payload.type}`,
      message: `${payload.subject} is scheduled and needs attention`,
      remindAt: payload.dueAt,
      metadata: {
        activityId: activity.id,
      },
    });
  }

  return activity;
};

const listActivities = async (filters, user) => {
  const scope = await buildScopeForUser(user, userRepository);
  const scopedFilters = {
    ...filters,
    companyId: scope.companyId,
    userId: scope.ownerId,
    userIds: scope.ownerIds,
  };
  return activityRepository.list(scopedFilters);
};

const markCompleted = async (id, user) => {
  const existingActivity = await activityRepository.findById(id);
  if (!existingActivity) {
    throw new ApiError(404, "Activity not found");
  }

  ensureOwnershipOrElevated({
    user,
    ownerId: existingActivity.user_id,
    resourceCompanyId: existingActivity.company_id,
    resourceLabel: "activity",
  });

  const activity = await activityRepository.updateCompletion(
    id,
    new Date().toISOString()
  );
  return activity;
};

module.exports = {
  createActivity,
  listActivities,
  markCompleted,
};
