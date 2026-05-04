import { useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import crmApi from "../../api/crmApi";
import {
  fetchDashboardData,
  hydrateAuth,
  logout,
  setNotifications,
  setSidebarOpen,
  toggleSidebarCollapsed,
  toggleTheme,
} from "../../store";
import { useNavigate } from "../../hooks/useNavigate";
import { canAccessAnalytics, canManageUsers, isPlatformAdmin } from "../../lib/roles";

export function AppShell({ title, subtitle, children }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const { theme, sidebarOpen, sidebarCollapsed, route } = useSelector((state) => state.ui);
  const { user } = useSelector((state) => state.auth);
  const { notifications, leads, customers, deals, activities, users, companies } = useSelector(
    (state) => state.crm
  );
  const isImpersonating =
    typeof window !== "undefined" &&
    localStorage.getItem("crm_impersonation_active") === "true";

  const handleLogout = () => {
    dispatch(logout());
    navigate("/login");
  };

  const handleReturnToAdmin = async () => {
    if (typeof window === "undefined") {
      return;
    }

    const originalToken = localStorage.getItem("crm_impersonator_token");
    const originalUser = localStorage.getItem("crm_impersonator_user");

    if (!originalToken || !originalUser) {
      return;
    }

    localStorage.setItem("token", originalToken);
    localStorage.setItem("crm_token", originalToken);
    localStorage.setItem("user", originalUser);
    localStorage.setItem("crm_user", originalUser);

    localStorage.removeItem("crm_impersonation_active");
    localStorage.removeItem("crm_impersonator_token");
    localStorage.removeItem("crm_impersonator_user");

    dispatch(hydrateAuth());
    await dispatch(fetchDashboardData());
    navigate("/team");
  };

  const handleAccountClick = () => {
    if (route?.startsWith("/settings")) {
      if (isPlatformAdmin(user) || canManageUsers(user)) {
        navigate("/users");
      } else {
        navigate("/dashboard");
      }
      return;
    }

    if (isPlatformAdmin(user) || canManageUsers(user)) {
      if (route?.startsWith("/users") || route?.startsWith("/team")) {
        navigate("/settings");
        return;
      }

      navigate("/users");
      return;
    }

    navigate("/settings");
  };

  const searchItems = useMemo(() => {
    const quickLinks = [
      {
        id: "route-dashboard",
        label: "Dashboard",
        subtitle: "Open dashboard",
        path: "/dashboard",
        keywords: ["home", "overview"],
      },
      {
        id: "route-leads",
        label: "Leads",
        subtitle: "Open leads workspace",
        path: "/leads",
        keywords: ["prospects", "pipeline"],
      },
      {
        id: "route-customers",
        label: "Customers",
        subtitle: "Open customer accounts",
        path: "/customers",
        keywords: ["accounts", "clients"],
      },
      {
        id: "route-pipeline",
        label: "Pipeline",
        subtitle: "Open deal pipeline",
        path: "/pipeline",
        keywords: ["deals", "stages"],
      },
      {
        id: "route-activities",
        label: "Activities",
        subtitle: "Open activity board",
        path: "/activities",
        keywords: ["tasks", "reminders"],
      },
      {
        id: "route-reports",
        label: "Reports",
        subtitle: "Open reports",
        path: "/reports",
        keywords: ["insights", "exports"],
      },
      {
        id: "route-settings",
        label: "Settings",
        subtitle: "Open account settings",
        path: "/settings",
        keywords: ["preferences", "profile"],
      },
      {
        id: "route-team",
        label: "Team",
        subtitle: "Open user management",
        path: "/team",
        keywords: ["users", "members"],
      },
      {
        id: "route-analytics",
        label: "Analytics",
        subtitle: "Open analytics",
        path: "/analytics",
        keywords: ["charts", "kpi"],
      },
    ];

    const visibleQuickLinks = quickLinks.filter((item) => {
      if (item.path === "/team") {
        return isPlatformAdmin(user) || canManageUsers(user);
      }

      if (item.path === "/analytics") {
        return isPlatformAdmin(user) || canAccessAnalytics(user);
      }

      return true;
    });

    const leadItems = (leads || []).slice(0, 60).map((lead) => ({
      id: `lead-${lead.id}`,
      label: lead.name || `Lead #${lead.id}`,
      subtitle: `Lead • ${lead.company || lead.email || "no company"}`,
      path: `/leads/${lead.id}`,
      keywords: [lead.email, lead.company, lead.status, lead.source],
    }));

    const customerItems = (customers || []).slice(0, 60).map((customer) => ({
      id: `customer-${customer.id}`,
      label: customer.name || `Customer #${customer.id}`,
      subtitle: `Customer • ${customer.company || customer.email || "account"}`,
      path: `/customers/${customer.id}`,
      keywords: [customer.email, customer.company, customer.lifecycle_stage],
    }));

    const dealItems = (deals || []).slice(0, 60).map((deal) => ({
      id: `deal-${deal.id}`,
      label: deal.title || `Deal #${deal.id}`,
      subtitle: `Deal • ${deal.stage || "open"}`,
      path: `/pipeline/${deal.id}`,
      keywords: [deal.status, deal.stage, String(deal.value || "")],
    }));

    const activityItems = (activities || []).slice(0, 40).map((activity) => ({
      id: `activity-${activity.id}`,
      label: activity.subject || `Activity #${activity.id}`,
      subtitle: `Activity • ${activity.type || "task"}`,
      path: "/activities",
      keywords: [activity.type, activity.notes],
    }));

    const userItems = (users || []).slice(0, 40).map((member) => ({
      id: `user-${member.id}`,
      label: member.full_name || member.email || `User #${member.id}`,
      subtitle: `User • ${member.company_name || member.role || "workspace"}`,
      path: isPlatformAdmin(user) || canManageUsers(user) ? "/users" : "/settings",
      keywords: [member.email, member.role, member.company_name],
    }));

    const companyItems = (companies || []).slice(0, 40).map((company) => ({
      id: `company-${company.id}`,
      label: company.name || `Company #${company.id}`,
      subtitle: `Company • ${company.email || company.industry || "workspace"}`,
      path: `/companies/${company.id}`,
      keywords: [company.industry, company.status, company.email],
    }));

    return [
      ...visibleQuickLinks,
      ...leadItems,
      ...customerItems,
      ...dealItems,
      ...activityItems,
      ...userItems,
      ...companyItems,
    ];
  }, [activities, companies, customers, deals, leads, user, users]);

  const handleNotificationRead = async (notificationId) => {
    const target = notifications.find((item) => item.id === notificationId);
    if (!target || target.is_read || notificationsLoading) {
      return;
    }

    const previousNotifications = notifications;
    dispatch(
      setNotifications(
        notifications.map((item) =>
          item.id === notificationId ? { ...item, is_read: true } : item
        )
      )
    );

    try {
      await crmApi.markNotificationRead(notificationId);
    } catch {
      dispatch(setNotifications(previousNotifications));
      dispatch(fetchDashboardData());
    }
  };

  const handleMarkAllNotificationsRead = async () => {
    if (notificationsLoading) {
      return;
    }

    const unreadIds = notifications.filter((item) => !item.is_read).map((item) => item.id);
    if (unreadIds.length === 0) {
      return;
    }

    const previousNotifications = notifications;
    dispatch(setNotifications(notifications.map((item) => ({ ...item, is_read: true }))));
    setNotificationsLoading(true);

    try {
      await Promise.all(unreadIds.map((id) => crmApi.markNotificationRead(id)));
    } catch {
      dispatch(setNotifications(previousNotifications));
      dispatch(fetchDashboardData());
    } finally {
      setNotificationsLoading(false);
    }
  };

  return (
    <div className={`min-h-screen ${theme}`}>
      <div className="app-background min-h-screen">
        <Sidebar
          currentRoute={route}
          user={user}
          sidebarOpen={sidebarOpen}
          sidebarCollapsed={sidebarCollapsed}
          onToggleCollapsed={() => dispatch(toggleSidebarCollapsed())}
          onLogout={handleLogout}
          onClose={() => dispatch(setSidebarOpen(false))}
        />

        <main
          className={`relative z-10 min-h-screen pb-24 transition-[padding] duration-300 lg:pb-0 ${
            sidebarCollapsed ? "lg:pl-16" : "lg:pl-64"
          }`}
        >
          <div className="relative z-10 mx-auto max-w-[1680px] px-4 py-5 sm:px-6 lg:px-8">
            {isImpersonating ? (
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-400/40 bg-amber-500/10 px-4 py-3">
                <div className="text-sm text-amber-100">
                  You are currently viewing this workspace as another user account.
                </div>
                <button
                  type="button"
                  className="rounded-lg border border-amber-300/60 bg-amber-400/15 px-3 py-1.5 text-xs font-semibold text-amber-100 transition hover:bg-amber-400/25"
                  onClick={handleReturnToAdmin}
                >
                  Return to company admin
                </button>
              </div>
            ) : null}
            <Topbar
              title={title}
              subtitle={subtitle}
              onMenuClick={() => dispatch(setSidebarOpen(true))}
              onThemeToggle={() => dispatch(toggleTheme())}
              onLogout={handleLogout}
              onAccountClick={handleAccountClick}
              onAlertsClick={() => navigate("/activities")}
              onNotificationNavigate={(path) => navigate(path)}
              onNotificationRead={handleNotificationRead}
              onNotificationsReadAll={handleMarkAllNotificationsRead}
              onSearchNavigate={(path) => navigate(path)}
              notificationsLoading={notificationsLoading}
              searchItems={searchItems}
              theme={theme}
              notifications={notifications}
              user={user}
            />
            <div
              className="ux-page-enter rounded-[34px] border border-[var(--border-soft)] p-4 shadow-[var(--shadow-panel)] sm:p-5 lg:p-6"
              style={{ background: "var(--shell-panel-bg)" }}
            >
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
