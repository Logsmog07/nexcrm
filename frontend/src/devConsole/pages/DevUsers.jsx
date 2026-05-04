import { useEffect, useMemo, useState } from "react";
import { getDevUsers } from "../api/devApi";
import { formatDateTime } from "../utils";

const resolveIsActiveFilter = (filter) => {
  if (filter === "active") {
    return "true";
  }

  if (filter === "inactive") {
    return "false";
  }

  return undefined;
};

export default function DevUsers() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [users, setUsers] = useState([]);

  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");

  useEffect(() => {
    let active = true;

    queueMicrotask(() => {
      if (active) {
        setLoading(true);
      }
    });

    getDevUsers({
      search: searchQuery || undefined,
      isActive: resolveIsActiveFilter(activeFilter),
    })
      .then((payload) => {
        if (active) {
          setUsers(payload.data || []);
          setError("");
        }
      })
      .catch((requestError) => {
        if (active) {
          setError(requestError?.response?.data?.message || requestError.message || "Unable to load users");
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
  }, [activeFilter, searchQuery]);

  const stats = useMemo(() => {
    const total = users.length;
    const activeCount = users.filter((user) => user.isActive).length;
    const inactiveCount = total - activeCount;
    const platformUsers = users.filter((user) => user.platformRole).length;

    return {
      total,
      activeCount,
      inactiveCount,
      platformUsers,
    };
  }, [users]);

  const onSubmitSearch = (event) => {
    event.preventDefault();
    setError("");
    setSearchQuery(searchInput.trim());
  };

  return (
    <div className="dev-page-stack">
      <section className="dev-stat-grid">
        <article className="dev-stat-card">
          <h3>Total Signed-up Users</h3>
          <strong>{stats.total}</strong>
        </article>
        <article className="dev-stat-card">
          <h3>Active</h3>
          <strong>{stats.activeCount}</strong>
        </article>
        <article className="dev-stat-card">
          <h3>Inactive</h3>
          <strong>{stats.inactiveCount}</strong>
        </article>
        <article className="dev-stat-card">
          <h3>Platform Accounts</h3>
          <strong>{stats.platformUsers}</strong>
        </article>
      </section>

      <section className="dev-card">
        <div className="dev-card-head">
          <div>
            <h2 className="dev-heading">Portal Users</h2>
            <p className="dev-muted">Only safe profile details are shown. Password fields are never exposed.</p>
          </div>
        </div>

        <form className="dev-inline-actions" onSubmit={onSubmitSearch}>
          <input
            className="dev-inline-input"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Search by email, name, or company"
          />

          <select
            className="dev-select"
            value={activeFilter}
            onChange={(event) => setActiveFilter(event.target.value)}
          >
            <option value="all">All statuses</option>
            <option value="active">Active only</option>
            <option value="inactive">Inactive only</option>
          </select>

          <button type="submit" className="dev-run-btn">Search</button>
          <button
            type="button"
            className="dev-ghost-btn"
            onClick={() => {
              setSearchInput("");
              setSearchQuery("");
              setActiveFilter("all");
              setError("");
            }}
          >
            Reset
          </button>
        </form>

        {loading ? <p className="dev-muted">Loading users...</p> : null}
        {error ? <div className="dev-error-box">{error}</div> : null}

        {!loading && !error ? (
          <div className="dev-table-wrap">
            <table className="dev-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Full Name</th>
                  <th>Email</th>
                  <th>Workspace</th>
                  <th>Role</th>
                  <th>Manager</th>
                  <th>Status</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {users.length ? (
                  users.map((user) => (
                    <tr key={user.id}>
                      <td>{user.id}</td>
                      <td>{user.fullName || "-"}</td>
                      <td>{user.email}</td>
                      <td>{user.companyName || "Platform"}</td>
                      <td>{user.effectiveRole || "-"}</td>
                      <td>{user.managerEmail || "-"}</td>
                      <td>{user.isActive ? "Active" : "Inactive"}</td>
                      <td>{formatDateTime(user.createdAt)}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8}>No users matched your filter.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </div>
  );
}
