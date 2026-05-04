import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getDevCompanies } from "../api/devApi";
import { useDevConsoleContext } from "../useDevConsoleContext";
import { formatDateTime } from "../utils";

const totalForCompany = (company) =>
  company.usersCount +
  company.leadsCount +
  company.customersCount +
  company.dealsCount +
  company.activitiesCount;

export default function DevCompanies() {
  const navigate = useNavigate();
  const { selectedCompanyId, setSelectedCompanyId } = useDevConsoleContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [companies, setCompanies] = useState([]);

  useEffect(() => {
    let active = true;

    getDevCompanies()
      .then((payload) => {
        if (active) {
          setCompanies(payload.data || []);
        }
      })
      .catch((requestError) => {
        if (active) {
          setError(requestError?.response?.data?.message || requestError.message || "Unable to load companies");
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

  const companyTotals = useMemo(
    () => companies.map((company) => ({
      company,
      total: totalForCompany(company),
    })),
    [companies]
  );

  if (loading) {
    return <div className="dev-card">Loading companies...</div>;
  }

  if (error) {
    return <div className="dev-card dev-error">{error}</div>;
  }

  return (
    <div className="dev-page-stack">
      <section className="dev-card">
        <div className="dev-card-head">
          <h2 className="dev-heading">Company Data Breakdown</h2>
          <button
            type="button"
            className="dev-ghost-btn"
            onClick={() => setSelectedCompanyId("")}
          >
            Clear Global Filter
          </button>
        </div>

        <div className="dev-company-grid">
          {companyTotals.map(({ company, total }) => {
            const isActive = String(selectedCompanyId || "") === String(company.id);
            const segments = [
              { key: "users", value: company.usersCount, color: "#00ff88" },
              { key: "leads", value: company.leadsCount, color: "#58a6ff" },
              { key: "customers", value: company.customersCount, color: "#f2cc60" },
              { key: "deals", value: company.dealsCount, color: "#ff7b72" },
              { key: "activities", value: company.activitiesCount, color: "#a371f7" },
            ];

            return (
              <article key={company.id} className={`dev-company-card ${isActive ? "is-active" : ""}`}>
                <div className="dev-company-head">
                  <h3 className="dev-heading">{company.name}</h3>
                  <span>#{company.id}</span>
                </div>

                <p className="dev-muted">Created {formatDateTime(company.createdAt)}</p>

                <table className="dev-mini-table">
                  <tbody>
                    <tr><td>Users</td><td>{company.usersCount}</td></tr>
                    <tr><td>Leads</td><td>{company.leadsCount}</td></tr>
                    <tr><td>Customers</td><td>{company.customersCount}</td></tr>
                    <tr><td>Deals</td><td>{company.dealsCount}</td></tr>
                    <tr><td>Activities</td><td>{company.activitiesCount}</td></tr>
                  </tbody>
                </table>

                <div className="dev-bar-track" aria-label="Company distribution bar">
                  {segments.map((segment) => (
                    <span
                      key={segment.key}
                      className="dev-bar-segment"
                      style={{
                        width: `${total ? (segment.value / total) * 100 : 0}%`,
                        background: segment.color,
                      }}
                    />
                  ))}
                </div>

                <button
                  type="button"
                  className="dev-small-btn"
                  onClick={() => {
                    setSelectedCompanyId(String(company.id));
                    navigate("/dev-console/tables");
                  }}
                >
                  Filter All Table Views
                </button>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
