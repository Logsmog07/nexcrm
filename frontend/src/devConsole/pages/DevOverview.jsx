import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  getDevCompanies,
  getDevSchema,
  getDevStats,
  getDevTables,
} from "../api/devApi";
import { formatDateTime } from "../utils";

const buildSchemaMap = (schemaRows) => {
  const map = new Map();

  for (const row of schemaRows) {
    const tableName = row.table_name;
    if (!map.has(tableName)) {
      map.set(tableName, {
        columns: 0,
        hasCompanyId: false,
      });
    }

    const current = map.get(tableName);
    current.columns += 1;
    if (row.column_name === "company_id") {
      current.hasCompanyId = true;
    }
  }

  return map;
};

export default function DevOverview() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tables, setTables] = useState([]);
  const [stats, setStats] = useState(null);
  const [schema, setSchema] = useState([]);
  const [companies, setCompanies] = useState([]);

  useEffect(() => {
    let active = true;

    Promise.all([getDevTables(), getDevStats(), getDevSchema(), getDevCompanies()])
      .then(([tablesPayload, statsPayload, schemaPayload, companiesPayload]) => {
        if (!active) {
          return;
        }

        setTables(tablesPayload.data || []);
        setStats(statsPayload);
        setSchema(schemaPayload.data || []);
        setCompanies(companiesPayload.data || []);
      })
      .catch((requestError) => {
        if (active) {
          setError(requestError?.response?.data?.message || requestError.message || "Unable to load overview");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const schemaMap = useMemo(() => buildSchemaMap(schema), [schema]);
  const statsMap = useMemo(() => {
    const map = new Map();
    for (const table of stats?.tables || []) {
      map.set(table.tableName, table);
    }
    return map;
  }, [stats]);

  if (loading) {
    return <div className="dev-card">Loading overview...</div>;
  }

  if (error) {
    return <div className="dev-card dev-error">{error}</div>;
  }

  return (
    <div className="dev-page-stack">
      <section className="dev-stat-grid">
        <article className="dev-stat-card">
          <h3>Total Tables</h3>
          <strong>{tables.length}</strong>
        </article>
        <article className="dev-stat-card">
          <h3>Total Rows</h3>
          <strong>{Number(stats?.totalRows || 0).toLocaleString()}</strong>
        </article>
        <article className="dev-stat-card">
          <h3>Total Companies</h3>
          <strong>{companies.length}</strong>
        </article>
        <article className="dev-stat-card">
          <h3>DB Size</h3>
          <strong>{stats?.databaseSize?.pretty || "-"}</strong>
        </article>
      </section>

      <section className="dev-card">
        <div className="dev-card-head">
          <h2 className="dev-heading">Storage Summary</h2>
        </div>

        <div className="dev-table-wrap">
          <table className="dev-table">
            <thead>
              <tr>
                <th>Table Name</th>
                <th>Row Count</th>
                <th>Columns</th>
                <th>Has company_id</th>
                <th>Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {tables.map((table) => {
                const schemaInfo = schemaMap.get(table.tableName) || { columns: 0, hasCompanyId: false };
                const tableStats = statsMap.get(table.tableName);
                return (
                  <tr key={table.tableName}>
                    <td>
                      <button
                        type="button"
                        className="dev-link-btn"
                        onClick={() => navigate(`/dev-console/tables?table=${table.tableName}`)}
                      >
                        {table.tableName}
                      </button>
                    </td>
                    <td>{Number(table.rowCount || 0).toLocaleString()}</td>
                    <td>{schemaInfo.columns}</td>
                    <td>{schemaInfo.hasCompanyId ? "Yes" : "No"}</td>
                    <td>{formatDateTime(tableStats?.latestRecordCreatedAt)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
