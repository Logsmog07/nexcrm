import client from "./client";

const unwrap = async (promise) => {
  const { data } = await promise;
  return data;
};

const developerApi = {
  getOverview: () => unwrap(client.get("/dev/overview")),
  getSchema: () => unwrap(client.get("/dev/schema")),
  getCompanySnapshot: (companyId) => unwrap(client.get(`/dev/companies/${companyId}`)),
  getTablePreview: (tableName, params = {}) =>
    unwrap(client.get(`/dev/table/${tableName}`, { params })),
};

export default developerApi;
