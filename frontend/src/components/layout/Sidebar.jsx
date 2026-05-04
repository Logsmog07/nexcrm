import { NavLink } from "react-router-dom";
import { canAccessRoute, getRoleLabel, isPlatformAdmin } from "../../lib/roles";

const Icon = ({ children, className = "" }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className || "h-4 w-4"}
    aria-hidden="true"
  >
    {children}
  </svg>
);

const icons = {
  dashboard: <Icon><rect x="3" y="3" width="8" height="8" /><rect x="13" y="3" width="8" height="5" /><rect x="13" y="10" width="8" height="11" /><rect x="3" y="13" width="8" height="8" /></Icon>,
  pipeline: <Icon><path d="M4 6h7l2 3h7" /><path d="M4 12h5l2 3h9" /><path d="M4 18h4" /></Icon>,
  leads: <Icon><path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" /></Icon>,
  customers: <Icon><path d="M3 21h18" /><path d="M5 21V8l7-5 7 5v13" /><path d="M9 21v-6h6v6" /></Icon>,
  activities: <Icon><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" /></Icon>,
  analytics: <Icon><path d="M12 20V10" /><path d="M18 20V4" /><path d="M6 20v-6" /></Icon>,
  reports: <Icon><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><path d="M14 2v6h6" /><path d="M8 13h8" /><path d="M8 17h6" /></Icon>,
  audit: <Icon><path d="M12 3l7 3v6c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6l7-3z" /><path d="M9.5 12.5l1.8 1.8 3.2-3.2" /></Icon>,
  team: <Icon><circle cx="9" cy="7" r="3" /><circle cx="17" cy="9" r="3" /><path d="M2 21a7 7 0 0 1 14 0" /><path d="M15 21a5 5 0 0 1 7 0" /></Icon>,
  settings: <Icon><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51h.01a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></Icon>,
  logout: <Icon><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><path d="M16 17l5-5-5-5" /><path d="M21 12H9" /></Icon>,
  chevronLeft: <Icon><path d="M15 18l-6-6 6-6" /></Icon>,
  chevronRight: <Icon><path d="M9 18l6-6-6-6" /></Icon>,
};

const NAV_GROUPS = [
  {
    label: "MAIN",
    items: [
      { path: "/dashboard", label: "Dashboard", icon: icons.dashboard },
      { path: "/pipeline", label: "Pipeline", icon: icons.pipeline },
    ],
  },
  {
    label: "MANAGE",
    items: [
      { path: "/leads", label: "Leads", icon: icons.leads },
      { path: "/customers", label: "Customers", icon: icons.customers },
      { path: "/activities", label: "Activities", icon: icons.activities },
    ],
  },
  {
    label: "INSIGHTS",
    items: [
      { path: "/analytics", label: "Analytics", icon: icons.analytics },
      { path: "/reports", label: "Reports", icon: icons.reports },
      { path: "/audit", label: "Audit", icon: icons.audit },
    ],
  },
  {
    label: "SETTINGS",
    items: [
      { path: "/team", label: "Team", icon: icons.team },
      { path: "/settings", label: "Settings", icon: icons.settings },
    ],
  },
];

const MOBILE_TABS = [
  { path: "/dashboard", label: "Home", icon: icons.dashboard },
  { path: "/pipeline", label: "Pipeline", icon: icons.pipeline },
  { path: "/leads", label: "Leads", icon: icons.leads },
  { path: "/customers", label: "Customers", icon: icons.customers },
  { path: "/analytics", label: "Analytics", icon: icons.analytics },
];

const isRouteActive = (itemPath, currentRoute) => {
  if (itemPath === "/dashboard") {
    return currentRoute === "/dashboard";
  }

  if (itemPath === "/team") {
    return (
      currentRoute === "/team" ||
      currentRoute === "/users" ||
      currentRoute.startsWith("/companies/")
    );
  }

  return currentRoute === itemPath || currentRoute.startsWith(`${itemPath}/`);
};

const getInitials = (name = "User") =>
  String(name)
    .split(" ")
    .map((item) => item[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

function NavItem({ item, currentRoute, collapsed, onClose }) {
  const active = isRouteActive(item.path, currentRoute);

  return (
    <NavLink
      to={item.path}
      onClick={onClose}
      className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
        active
          ? "bg-[var(--sidebar-active)] text-[var(--text-primary)] font-medium"
          : "text-[var(--text-secondary)] hover:bg-gray-100 dark:hover:bg-slate-700"
      } ${collapsed ? "justify-center" : "justify-start"}`}
      title={item.label}
    >
      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">{item.icon}</span>
      {!collapsed ? <span>{item.label}</span> : null}
    </NavLink>
  );
}

export function Sidebar({
  currentRoute,
  user,
  sidebarOpen,
  sidebarCollapsed,
  onToggleCollapsed,
  onLogout,
  onClose,
}) {
  const platformView = isPlatformAdmin(user);
  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => canAccessRoute(user, item.path)),
  })).filter((group) => group.items.length > 0);

  const mobileTabs = MOBILE_TABS.filter((item) => canAccessRoute(user, item.path));

  return (
    <>
      {sidebarOpen ? (
        <div className="fixed inset-0 z-30 bg-black/35 backdrop-blur-sm lg:hidden" onClick={onClose} />
      ) : null}

      <aside
        className={`fixed left-0 top-0 z-40 hidden h-screen shrink-0 flex-col border-r border-[var(--border)] bg-[var(--sidebar-bg)] transition-[width] duration-300 lg:flex ${
          sidebarCollapsed ? "w-16" : "w-64"
        }`}
      >
        <div className="flex h-16 items-center border-b border-[var(--border)] px-3">
          <div className={`flex min-w-0 items-center gap-2 ${sidebarCollapsed ? "justify-center" : ""}`}>
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--primary)]" />
            {!sidebarCollapsed ? (
              <span className="truncate text-sm font-semibold text-[var(--text-primary)]">NexCRM</span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onToggleCollapsed}
            className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--text-secondary)] hover:bg-gray-100 dark:hover:bg-slate-700"
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? icons.chevronRight : icons.chevronLeft}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 py-4">
          {visibleGroups.map((group) => (
            <div key={group.label} className="mb-4">
              {!sidebarCollapsed ? (
                <div className="px-3 pb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
                  {group.label}
                </div>
              ) : null}
              <div className="space-y-1">
                {group.items.map((item) => (
                  <NavItem
                    key={item.path}
                    item={item}
                    currentRoute={currentRoute}
                    collapsed={sidebarCollapsed}
                    onClose={onClose}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="border-t border-[var(--border)] px-2 py-3">
          <div
            className={`mb-2 flex items-center gap-2 rounded-lg px-2 py-2 ${
              sidebarCollapsed ? "justify-center" : ""
            }`}
          >
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--primary)] text-xs font-semibold text-white">
              {getInitials(user?.full_name)}
            </span>
            {!sidebarCollapsed ? (
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-[var(--text-primary)]">
                  {user?.full_name || "Workspace User"}
                </div>
                <div className="truncate text-xs uppercase tracking-wide text-[var(--text-secondary)]">
                  {platformView ? "Platform" : getRoleLabel(user)}
                </div>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onLogout}
            className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--text-secondary)] transition hover:bg-gray-100 dark:hover:bg-slate-700 ${
              sidebarCollapsed ? "justify-center" : "justify-start"
            }`}
          >
            <span className="inline-flex h-5 w-5 items-center justify-center">{icons.logout}</span>
            {!sidebarCollapsed ? <span>Logout</span> : null}
          </button>
        </div>
      </aside>

      <aside
        className={`fixed left-0 top-0 z-40 flex h-screen w-72 flex-col border-r border-[var(--border)] bg-[var(--sidebar-bg)] p-4 transition-transform duration-300 lg:hidden ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-[var(--primary)]" />
            <span className="text-sm font-semibold text-[var(--text-primary)]">NexCRM</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-2 py-1 text-sm text-[var(--text-secondary)] hover:bg-gray-100 dark:hover:bg-slate-700"
          >
            Close
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto">
          {visibleGroups.map((group) => (
            <div key={group.label}>
              <div className="px-2 pb-2 text-xs font-medium uppercase tracking-wide text-gray-400">
                {group.label}
              </div>
              <div className="space-y-1">
                {group.items.map((item) => (
                  <NavItem
                    key={item.path}
                    item={item}
                    currentRoute={currentRoute}
                    collapsed={false}
                    onClose={onClose}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </aside>

      <nav className="fixed bottom-0 left-0 right-0 z-30 border-t border-[var(--border)] bg-[var(--bg-card)]/95 px-2 py-2 backdrop-blur lg:hidden">
        <div className="grid grid-cols-5 gap-1">
          {mobileTabs.slice(0, 5).map((item) => {
            const active = isRouteActive(item.path, currentRoute);
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={`flex flex-col items-center gap-1 rounded-lg px-2 py-2 text-[11px] ${
                  active
                    ? "bg-[var(--sidebar-active)] text-[var(--text-primary)]"
                    : "text-[var(--text-secondary)]"
                }`}
              >
                <span className="inline-flex h-4 w-4 items-center justify-center">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </div>
      </nav>
    </>
  );
}
