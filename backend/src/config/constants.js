const PLATFORM_ROLES = {
  PLATFORM_ADMIN: "platform_admin",
};

const COMPANY_ROLES = {
  COMPANY_ADMIN: "company_admin",
  MANAGER: "manager",
  SALES_REP: "sales_rep",
};

const COMPANY_STATUSES = {
  ACTIVE: "active",
  TRIAL: "trial",
  SUSPENDED: "suspended",
};

const LEAD_STATUSES = {
  NEW: "new",
  CONTACTED: "contacted",
  QUALIFIED: "qualified",
  LOST: "lost",
  CONVERTED: "converted",
};

const DEAL_STAGES = {
  DISCOVERY: "discovery",
  PROPOSAL: "proposal",
  NEGOTIATION: "negotiation",
  WON: "won",
  LOST: "lost",
};

const ACTIVITY_TYPES = {
  CALL: "call",
  EMAIL: "email",
  MEETING: "meeting",
  NOTE: "note",
  TASK: "task",
};

module.exports = {
  PLATFORM_ROLES,
  COMPANY_ROLES,
  COMPANY_STATUSES,
  LEAD_STATUSES,
  DEAL_STAGES,
  ACTIVITY_TYPES,
};
