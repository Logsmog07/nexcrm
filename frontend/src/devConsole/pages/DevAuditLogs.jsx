import { useCallback, useEffect, useMemo, useState } from "react";
import { runDevQuery } from "../api/devApi";
import { formatDateTime } from "../utils";

const buildWhereClause = ({ action, user, fromDate, toDate }) => {
  const conditions = [];

  if (action) {
    conditions.push(`a.action = '${String(action).replaceAll("'", "''")}'`);
  }

  if (user) {
    conditions.push(`COALESCE(u.email, '') ILIKE '%${String(user).replaceAll("'", "''") }%'`);
  }

  if (fromDate) {
    conditions.push(`a.created_at >= '${fromDate}T00:00:00Z'`);
  }

  if (toDate) {
    conditions.push(`a.created_at <= '${toDate}T23:59:59Z'`);
  }

  if (!conditions.length) {
    return "";
  }

  return `WHERE ${conditions.join(" AND ")}`;
};

export default function DevAuditLogs() {
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [error, setError] = useState("");
  const [logs, setLogs] = useState([]);
  const [actions, setActions] = useState([]);

  const [actionFilter, setActionFilter] = useState("");
  const [userFilter, setUserFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const runFetch = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const existsPayload = await runDevQuery("SELECT to_regclass('public.audit_logs') AS table_name");
      const exists = Boolean(existsPayload?.rows?.[0]?.table_name);
      setConfigured(exists);

      if (!exists) {
        setLogs([]);
        setActions([]);
        return;
      }

      const actionPayload = await runDevQuery("SELECT DISTINCT action FROM audit_logs ORDER BY action");
      setActions((actionPayload.rows || []).map((row) => row.action).filter(Boolean));

      const whereClause = buildWhereClause({
        action: actionFilter,
        user: userFilter,
        fromDate,
        toDate,
      });

      const logsPayload = await runDevQuery(`
        SELECT
          a.created_at,
          COALESCE(u.email, 'system') AS actor_email,
          a.action,
          a.entity_type,
          a.entity_id,
          a.ip_address
        FROM audit_logs a
        LEFT JOIN users u ON u.id = a.actor_user_id
        ${whereClause}
        ORDER BY a.created_at DESC
        LIMIT 100
      `);

      setLogs(logsPayload.rows || []);
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError.message || "Unable to load audit logs");
    } finally {
      setLoading(false);
    }
  }, [actionFilter, fromDate, toDate, userFilter]);

  useEffect(() => {
    runFetch();
  }, [runFetch]);

  const hasLogs = useMemo(() => logs.length > 0, [logs]);

  return (
    <div className="dev-page-stack">
      <section className="dev-card">
        <div className="dev-card-head">
          <h2 className="dev-heading">Audit Timeline</h2>
          <button type="button" className="dev-run-btn" onClick={runFetch}>Apply Filters</button>
        </div>

        <div className="dev-filter-grid">
          <select className="dev-select" value={actionFilter} onChange={(event) => setActionFilter(event.target.value)}>
            <option value="">All actions</option>
            {actions.map((action) => (
              <option key={action} value={action}>{action}</option>
            ))}
          </select>

          <input
            className="dev-inline-input"
            placeholder="Filter by user email"
            value={userFilter}
            onChange={(event) => setUserFilter(event.target.value)}
          />

          <input type="date" className="dev-inline-input" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          <input type="date" className="dev-inline-input" value={toDate} onChange={(event) => setToDate(event.target.value)} />
        </div>

        {loading ? <p className="dev-muted">Loading audit logs...</p> : null}
        {error ? <div className="dev-error-box">{error}</div> : null}

        {!loading && !configured ? (
          <div className="dev-warning">
            Audit logging not configured. Add an audit_logs table to enable this.
          </div>
        ) : null}

        {!loading && configured && !hasLogs ? (
          <p className="dev-muted">No matching audit events found.</p>
        ) : null}

        {configured && hasLogs ? (
          <div className="dev-timeline">
            {logs.map((entry, index) => (
              <article key={`${entry.created_at}-${index}`} className="dev-timeline-item">
                <div className="dev-timeline-dot" />
                <div className="dev-timeline-content">
                  <h4>{entry.action}</h4>
                  <p>
                    <strong>{entry.actor_email}</strong> touched {entry.entity_type || "record"}
                    {entry.entity_id ? ` #${entry.entity_id}` : ""}
                  </p>
                  <small>
                    {formatDateTime(entry.created_at)} - IP {entry.ip_address || "n/a"}
                  </small>
                </div>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
