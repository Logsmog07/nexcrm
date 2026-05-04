import { NavLink } from "react-router-dom";
import { useDevConsoleContext } from "../useDevConsoleContext";

const NAV_ITEMS = [
  { to: "/dev-console/dashboard", label: "Overview", icon: "📊" },
  { to: "/dev-console/tables", label: "Tables", icon: "🗂️" },
  { to: "/dev-console/schema", label: "Schema & Relations", icon: "🔗" },
  { to: "/dev-console/users", label: "Signed-up Users", icon: "👥" },
  { to: "/dev-console/companies", label: "Companies", icon: "🏢" },
  { to: "/dev-console/query", label: "Query Runner", icon: "🔍" },
  { to: "/dev-console/audit", label: "Audit Logs", icon: "📋" },
];

export default function DevSidebar({ collapsed, onToggle }) {
  const { selectedCompanyId } = useDevConsoleContext();

  return (
    <aside className={`dev-sidebar ${collapsed ? "is-collapsed" : ""}`}>
      <div className="dev-sidebar-top">
        <button type="button" className="dev-collapse-btn" onClick={onToggle}>
          {collapsed ? ">>" : "<<"}
        </button>
      </div>

      <nav className="dev-sidebar-nav">
        {NAV_ITEMS.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === "/dev-console/dashboard"}
            className={({ isActive }) =>
              `dev-nav-item ${isActive ? "is-active" : ""} ${collapsed ? "is-collapsed" : ""}`
            }
            title={`${item.icon} ${item.label}`}
          >
            <span className="dev-nav-icon" aria-hidden="true">{item.icon}</span>
            {!collapsed ? <span>{item.label}</span> : null}
          </NavLink>
        ))}
      </nav>

      {!collapsed ? (
        <div className="dev-sidebar-footer">
          <p>Global Company Filter</p>
          <strong>{selectedCompanyId ? `Company #${selectedCompanyId}` : "All companies"}</strong>
        </div>
      ) : null}
    </aside>
  );
}
