import client from "./client";

const unwrap = async (promise) => {
  const { data } = await promise;
  return data;
};

const crmApi = {
  getDashboard: () => unwrap(client.get("/analytics/dashboard")),
  listCompanies: () => unwrap(client.get("/companies")),
  getCompanyOverview: (id) => unwrap(client.get(`/companies/${id}/overview`)),
  createCompany: (payload) => unwrap(client.post("/companies", payload)),
  updateCompany: (id, payload) => unwrap(client.put(`/companies/${id}`, payload)),
  updateCompanyStatus: (id, status) =>
    unwrap(client.patch(`/companies/${id}/status`, { status })),
  deleteCompany: (id) => unwrap(client.delete(`/companies/${id}`)),
  listUsers: () => unwrap(client.get("/users")),
  createUser: (payload) => unwrap(client.post("/users", payload)),
  updateUserStatus: (id, isActive) => unwrap(client.patch(`/users/${id}/status`, { isActive })),
  resetUserPassword: (id, password) =>
    unwrap(client.patch(`/users/${id}/password`, { password })),
  reassignSalesRep: (id, managerId) =>
    unwrap(client.patch(`/users/${id}/manager`, { managerId })),
  listLeads: (params = {}) => unwrap(client.get("/leads", { params })),
  getLead: (id) => unwrap(client.get(`/leads/${id}`)),
  createLead: (payload) => unwrap(client.post("/leads", payload)),
  updateLead: (id, payload) => unwrap(client.put(`/leads/${id}`, payload)),
  deleteLead: (id) => unwrap(client.delete(`/leads/${id}`)),
  convertLead: (id) => unwrap(client.post(`/leads/${id}/convert`)),
  listCustomers: (params = {}) => unwrap(client.get("/customers", { params })),
  getCustomer: (id) => unwrap(client.get(`/customers/${id}`)),
  createCustomer: (payload) => unwrap(client.post("/customers", payload)),
  updateCustomer: (id, payload) => unwrap(client.put(`/customers/${id}`, payload)),
  deleteCustomer: (id) => unwrap(client.delete(`/customers/${id}`)),
  listDeals: (params = {}) => unwrap(client.get("/deals", { params })),
  getDeal: (id) => unwrap(client.get(`/deals/${id}`)),
  createDeal: (payload) => unwrap(client.post("/deals", payload)),
  updateDeal: (id, payload) => unwrap(client.put(`/deals/${id}`, payload)),
  moveDeal: (id, stage) => unwrap(client.patch(`/deals/${id}/stage`, { stage })),
  deleteDeal: (id) => unwrap(client.delete(`/deals/${id}`)),
  listActivities: (params = {}) => unwrap(client.get("/activities", { params })),
  createActivity: (payload) => unwrap(client.post("/activities", payload)),
  completeActivity: (id) => unwrap(client.patch(`/activities/${id}/complete`)),
  listNotifications: () => unwrap(client.get("/notifications")),
  markNotificationRead: (id) => unwrap(client.patch(`/notifications/${id}/read`)),
  getMySettings: () => unwrap(client.get("/settings")),
  updateMySettings: (payload) => unwrap(client.patch("/settings", payload)),
  listAuditLogs: (params = {}) => unwrap(client.get("/audit/logs", { params })),
  downloadAuditLogsCsv: (params = {}) =>
    client.get("/audit/logs/export", {
      params: { ...params, format: "csv" },
      responseType: "blob",
    }),
  downloadAuditLogsCsvGzip: (params = {}) =>
    client.get("/audit/logs/export", {
      params: { ...params, format: "csv", compress: true },
      responseType: "blob",
    }),
  downloadAuditLogsJson: (params = {}) =>
    client.get("/audit/logs/export", {
      params: { ...params, format: "json" },
      responseType: "blob",
    }),
};

export default crmApi;
