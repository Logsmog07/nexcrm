import { useCallback, useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { Database, GitBranch, KeyRound, LogOut, RefreshCw, Building2 } from "lucide-react";
import developerApi from "../api/developerApi";
import { logout } from "../store";

const numberFormat = new Intl.NumberFormat("en-US");

const formatValue = (value) => {
  if (value === null || value === undefined) {
    return "-";
  }

  if (typeof value === "object") {
    return JSON.stringify(value);
  }

  return String(value);
};

const SectionCard = ({ title, subtitle, action, children }) => (
  <section className="rounded-3xl border border-slate-200 bg-white/95 p-5 shadow-[0_24px_40px_rgba(15,23,42,0.08)]">
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {action}
    </div>
    {children}
  </section>
);

const StatTile = ({ icon, label, value }) => (
  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
    <div className="mb-2 flex items-center gap-2 text-slate-500">
      {icon}
      <span className="text-xs uppercase tracking-wide">{label}</span>
    </div>
    <div className="text-2xl font-semibold text-slate-900">{value}</div>
  </div>
);

export function DeveloperPortalPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [overview, setOverview] = useState(null);
  const [schema, setSchema] = useState(null);
  const [selectedTable, setSelectedTable] = useState("");
  const [selectedCompanyId, setSelectedCompanyId] = useState("");
  const [tableData, setTableData] = useState(null);
  const [tableLoading, setTableLoading] = useState(false);
  const [companySnapshot, setCompanySnapshot] = useState(null);
  const [companyLoading, setCompanyLoading] = useState(false);

  const loadPortal = useCallback(async ({ silent } = { silent: false }) => {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const [overviewPayload, schemaPayload] = await Promise.all([
        developerApi.getOverview(),
        developerApi.getSchema(),
      ]);

      setOverview(overviewPayload);
      setSchema(schemaPayload);

      if (!selectedTable && schemaPayload.tables?.length) {
        setSelectedTable(schemaPayload.tables[0].name);
      }
    } catch (requestError) {
      setError(requestError.message || "Unable to load developer portal");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedTable]);

  useEffect(() => {
    loadPortal();
  }, [loadPortal]);

  useEffect(() => {
    const loadTablePreview = async () => {
      if (!selectedTable) {
        return;
      }

      setTableLoading(true);

      try {
        const payload = await developerApi.getTablePreview(selectedTable, {
          companyId: selectedCompanyId || undefined,
          limit: 40,
        });
        setTableData(payload);
      } catch (requestError) {
        setTableData(null);
        setError(requestError.message || "Unable to load table preview");
      } finally {
        setTableLoading(false);
      }
    };

    loadTablePreview();
  }, [selectedTable, selectedCompanyId]);

  useEffect(() => {
    const loadSnapshot = async () => {
      if (!selectedCompanyId) {
        setCompanySnapshot(null);
        return;
      }

      setCompanyLoading(true);
      try {
        const payload = await developerApi.getCompanySnapshot(selectedCompanyId);
        setCompanySnapshot(payload);
      } catch (requestError) {
        setCompanySnapshot(null);
        setError(requestError.message || "Unable to load company snapshot");
      } finally {
        setCompanyLoading(false);
      }
    };

    loadSnapshot();
  }, [selectedCompanyId]);

  const previewColumns = useMemo(() => {
    if (tableData?.columns?.length) {
      return tableData.columns.map((column) => column.name);
    }

    if (tableData?.rows?.length) {
      return Object.keys(tableData.rows[0]);
    }

    return [];
  }, [tableData]);

  const companyOptions = overview?.companyBreakdown || [];

  const handleLogout = () => {
    dispatch(logout());
    navigate("/login", { replace: true });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 px-6 py-12 text-slate-100">
        <div className="mx-auto max-w-6xl">Loading developer portal...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#dbeafe_0%,#f8fafc_45%,#e2e8f0_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="rounded-3xl border border-slate-200 bg-white/90 p-6 shadow-[0_30px_50px_rgba(30,41,59,0.12)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-600">
                <KeyRound className="h-3.5 w-3.5" />
                Developer-only access
              </p>
              <h1 className="mt-3 text-3xl font-semibold text-slate-900">Database Intelligence Console</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">
                Unified view of schema structure, company workspaces, login accounts, and raw table storage.
                This console is isolated from the standard CRM workspace UI.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => loadPortal({ silent: true })}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
                Refresh
              </button>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
              >
                <LogOut className="h-4 w-4" />
                Exit
              </button>
            </div>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <StatTile
              icon={<Database className="h-4 w-4" />}
              label="Tables"
              value={numberFormat.format(overview?.totals?.tables || 0)}
            />
            <StatTile
              icon={<GitBranch className="h-4 w-4" />}
              label="Relations"
              value={numberFormat.format(overview?.totals?.relationships || 0)}
            />
            <StatTile
              icon={<Database className="h-4 w-4" />}
              label="Columns"
              value={numberFormat.format(overview?.totals?.columns || 0)}
            />
            <StatTile
              icon={<Building2 className="h-4 w-4" />}
              label="Companies"
              value={numberFormat.format(overview?.totals?.companies || 0)}
            />
            <StatTile
              icon={<KeyRound className="h-4 w-4" />}
              label="Login Accounts"
              value={numberFormat.format(overview?.totals?.users || 0)}
            />
            <StatTile
              icon={<Database className="h-4 w-4" />}
              label="Estimated Rows"
              value={numberFormat.format(overview?.totals?.estimatedRows || 0)}
            />
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Signed in as {user?.email || "developer"} · Snapshot generated at {overview?.generatedAt}
          </p>
        </header>

        {error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[1.1fr_1fr]">
          <SectionCard
            title="Schema Relationship Diagram"
            subtitle="Foreign-key graph between core entities"
          >
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-4 flex flex-wrap gap-2">
                {(schema?.tables || []).map((table) => (
                  <span
                    key={table.name}
                    className="rounded-full border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700"
                  >
                    {table.name}
                  </span>
                ))}
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {(overview?.topRelationships || []).map((relation) => (
                  <div
                    key={relation.constraint_name}
                    className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-700"
                  >
                    <span className="font-semibold">{relation.from_table}.{relation.from_column}</span>
                    <span className="mx-2 text-slate-400">→</span>
                    <span className="font-semibold">{relation.to_table}.{relation.to_column}</span>
                  </div>
                ))}
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Workspace Company Matrix"
            subtitle="How records are distributed across each company"
            action={
              <select
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                value={selectedCompanyId}
                onChange={(event) => setSelectedCompanyId(event.target.value)}
              >
                <option value="">All companies</option>
                {companyOptions.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            }
          >
            <div className="max-h-[350px] overflow-auto rounded-2xl border border-slate-200">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Company</th>
                    <th className="px-3 py-2">Users</th>
                    <th className="px-3 py-2">Leads</th>
                    <th className="px-3 py-2">Customers</th>
                    <th className="px-3 py-2">Deals</th>
                  </tr>
                </thead>
                <tbody>
                  {companyOptions.map((company) => (
                    <tr key={company.id} className="border-t border-slate-100 text-slate-700">
                      <td className="px-3 py-2 font-medium">{company.name}</td>
                      <td className="px-3 py-2">{company.users_count}</td>
                      <td className="px-3 py-2">{company.leads_count}</td>
                      <td className="px-3 py-2">{company.customers_count}</td>
                      <td className="px-3 py-2">{company.deals_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_1.15fr]">
          <SectionCard
            title="Login Directory"
            subtitle="All accounts across platform and company scopes"
          >
            <div className="max-h-[360px] overflow-auto rounded-2xl border border-slate-200">
              <table className="min-w-full text-left text-xs">
                <thead className="bg-slate-100 text-slate-600">
                  <tr>
                    <th className="px-3 py-2">Name</th>
                    <th className="px-3 py-2">Email</th>
                    <th className="px-3 py-2">Role</th>
                    <th className="px-3 py-2">Company</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {(overview?.loginDirectory || []).map((account) => (
                    <tr key={account.id} className="border-t border-slate-100 text-slate-700">
                      <td className="px-3 py-2 font-medium">{account.full_name}</td>
                      <td className="px-3 py-2">{account.email}</td>
                      <td className="px-3 py-2">{String(account.role || "-").replaceAll("_", " ")}</td>
                      <td className="px-3 py-2">{account.company_name || "Platform"}</td>
                      <td className="px-3 py-2">{account.is_active ? "Active" : "Inactive"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <SectionCard
            title="Table Browser"
            subtitle="Raw row-level inspection with optional company scope"
            action={
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700"
                  value={selectedTable}
                  onChange={(event) => setSelectedTable(event.target.value)}
                >
                  {(schema?.tables || []).map((table) => (
                    <option key={table.name} value={table.name}>
                      {table.name}
                    </option>
                  ))}
                </select>
              </div>
            }
          >
            {tableLoading ? <p className="text-sm text-slate-500">Loading rows...</p> : null}
            {!tableLoading && tableData ? (
              <div className="space-y-3">
                <div className="text-xs text-slate-500">
                  Showing {tableData.rowCount} rows from <span className="font-semibold">{tableData.tableName}</span>
                </div>
                <div className="max-h-[380px] overflow-auto rounded-2xl border border-slate-200">
                  <table className="min-w-full text-left text-xs">
                    <thead className="bg-slate-100 text-slate-600">
                      <tr>
                        {previewColumns.map((column) => (
                          <th key={column} className="px-3 py-2">
                            {column}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {tableData.rows.map((row, rowIndex) => (
                        <tr key={`${tableData.tableName}-${rowIndex}`} className="border-t border-slate-100 text-slate-700">
                          {previewColumns.map((column) => (
                            <td key={column} className="max-w-[260px] truncate px-3 py-2 align-top" title={formatValue(row[column])}>
                              {formatValue(row[column])}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </SectionCard>
        </div>

        {selectedCompanyId ? (
          <SectionCard
            title="Company Snapshot"
            subtitle="Quick operational snapshot for the selected workspace"
          >
            {companyLoading ? <p className="text-sm text-slate-500">Loading company snapshot...</p> : null}
            {!companyLoading && companySnapshot ? (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <StatTile
                  icon={<KeyRound className="h-4 w-4" />}
                  label="Users"
                  value={numberFormat.format(companySnapshot.users?.length || 0)}
                />
                <StatTile
                  icon={<Database className="h-4 w-4" />}
                  label="Leads"
                  value={numberFormat.format(companySnapshot.leads?.length || 0)}
                />
                <StatTile
                  icon={<Database className="h-4 w-4" />}
                  label="Customers"
                  value={numberFormat.format(companySnapshot.customers?.length || 0)}
                />
                <StatTile
                  icon={<Database className="h-4 w-4" />}
                  label="Deals"
                  value={numberFormat.format(companySnapshot.deals?.length || 0)}
                />
              </div>
            ) : null}
          </SectionCard>
        ) : null}
      </div>
    </div>
  );
}
