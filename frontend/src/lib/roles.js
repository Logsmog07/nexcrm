export const ROLES = {
  DEVELOPER: "developer",
  PLATFORM_ADMIN: "platform_admin",
  COMPANY_ADMIN: "company_admin",
  MANAGER: "manager",
  SALES_REP: "sales_rep",
};

export const isDeveloper = (user) => Boolean(user?.is_developer);
export const isPlatformAdmin = (user) => user?.role === ROLES.PLATFORM_ADMIN;
export const isCompanyAdmin = (user) => user?.role === ROLES.COMPANY_ADMIN;
export const isManager = (user) => user?.role === ROLES.MANAGER;
export const isSalesRep = (user) => user?.role === ROLES.SALES_REP;
export const isAdmin = (user) => isPlatformAdmin(user) || isCompanyAdmin(user);

export const canManageUsers = (user) =>
  isPlatformAdmin(user) || isCompanyAdmin(user) || isManager(user);
export const canAccessAnalytics = (user) =>
  isCompanyAdmin(user) || isManager(user);
export const canAccessCustomers = () => true;
export const canCreateCustomers = (user) => isAdmin(user) || isManager(user);
export const canDeleteLeads = (user) => isAdmin(user);
export const canDeleteDeals = (user) => isAdmin(user);
export const getRoleLabel = (user) =>
  String(user?.role || ROLES.SALES_REP).replaceAll("_", " ");

export const getNavItemsForRole = (user) => {
  const base = [
    {
      path: "/dashboard",
      label: isPlatformAdmin(user)
        ? "Control Center"
        : isSalesRep(user)
        ? "My Workspace"
        : "Dashboard",
    },
  ];

  if (isPlatformAdmin(user)) {
    base.push({ path: "/users", label: "Companies & Users" });
    base.push({ path: "/reports", label: "Reports" });
    base.push({ path: "/settings", label: "Settings" });
    return base;
  }

  base.push({ path: "/leads", label: isSalesRep(user) ? "My Leads" : "Leads" });

  base.push({ path: "/customers", label: isSalesRep(user) ? "My Customers" : "Customers" });

  base.push({ path: "/pipeline", label: isSalesRep(user) ? "My Pipeline" : "Pipeline" });
  base.push({ path: "/activities", label: isSalesRep(user) ? "My Activities" : "Activities" });

  if (canAccessAnalytics(user)) {
    base.push({ path: "/analytics", label: "Analytics" });
  }

  if (canManageUsers(user)) {
    base.push({
      path: "/team",
      label: "Team",
    });
  }

  base.push({ path: "/reports", label: "Reports" });
  base.push({ path: "/settings", label: "Settings" });

  return base;
};

export const canAccessRoute = (user, route) => {
  if (!user) return route === "/" || route === "/login" || route === "/signup";

  if (isDeveloper(user)) {
    return route === "/developer";
  }

  if (route === "/settings") return true;
  if (route === "/team") return canManageUsers(user);
  if (route === "/reports") return canAccessAnalytics(user) || isPlatformAdmin(user);
  if (route === "/audit") return isPlatformAdmin(user) || isCompanyAdmin(user);
  if (route === "/dashboard") return true;

  if (isPlatformAdmin(user)) {
    return (
      route === "/dashboard" ||
      route === "/users" ||
      route === "/team" ||
      route === "/audit" ||
      route === "/reports" ||
      route === "/settings" ||
      route.startsWith("/companies/")
    );
  }
  if (route === "/analytics") return canAccessAnalytics(user);
  if (route === "/users") return canManageUsers(user);
  if (route.startsWith("/leads/")) return true;
  if (route.startsWith("/customers/")) return true;
  if (route.startsWith("/pipeline/")) return true;
  return true;
};
