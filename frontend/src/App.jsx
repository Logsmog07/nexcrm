import { lazy, Suspense, useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate as useRouterNavigate,
} from "react-router-dom";
import ProtectedRoute from "./components/ProtectedRoute";
import { ErrorBanner } from "./components/common/ErrorBanner";
import { LoadingState } from "./components/common/LoadingState";
import {
  fetchDashboardData,
  fetchSession,
  hydrateAuth,
  logout,
  setRoute,
} from "./store";
import { canAccessRoute } from "./lib/roles";
import { getPreferredStartRoute } from "./lib/settings";

const LandingPage = lazy(() =>
  import("./pages/LandingPage").then((module) => ({ default: module.LandingPage }))
);
const LoginPage = lazy(() =>
  import("./pages/LoginPage").then((module) => ({ default: module.LoginPage }))
);
const SignupPage = lazy(() =>
  import("./pages/SignupPage").then((module) => ({ default: module.SignupPage }))
);
const DashboardPage = lazy(() =>
  import("./pages/DashboardPage").then((module) => ({ default: module.DashboardPage }))
);
const LeadsPage = lazy(() => import("./pages/LeadsPage").then((module) => ({ default: module.LeadsPage })));
const LeadDetailPage = lazy(() =>
  import("./pages/LeadDetailPage").then((module) => ({ default: module.LeadDetailPage }))
);
const CustomersPage = lazy(() =>
  import("./pages/CustomersPage").then((module) => ({ default: module.CustomersPage }))
);
const CustomerDetailPage = lazy(() =>
  import("./pages/CustomerDetailPage").then((module) => ({ default: module.CustomerDetailPage }))
);
const PipelinePage = lazy(() =>
  import("./pages/PipelinePage").then((module) => ({ default: module.PipelinePage }))
);
const DealDetailPage = lazy(() =>
  import("./pages/DealDetailPage").then((module) => ({ default: module.DealDetailPage }))
);
const ActivitiesPage = lazy(() =>
  import("./pages/ActivitiesPage").then((module) => ({ default: module.ActivitiesPage }))
);
const AnalyticsPage = lazy(() =>
  import("./pages/AnalyticsPage").then((module) => ({ default: module.AnalyticsPage }))
);
const ReportsPage = lazy(() =>
  import("./pages/ReportsPage").then((module) => ({ default: module.ReportsPage }))
);
const AuditLogsPage = lazy(() =>
  import("./pages/AuditLogsPage").then((module) => ({ default: module.AuditLogsPage }))
);
const SettingsPage = lazy(() =>
  import("./pages/SettingsPage").then((module) => ({ default: module.SettingsPage }))
);
const UsersPage = lazy(() =>
  import("./pages/UsersPage").then((module) => ({ default: module.UsersPage }))
);
const CompanyDetailPage = lazy(() =>
  import("./pages/CompanyDetailPage").then((module) => ({ default: module.CompanyDetailPage }))
);

const getStoredToken = () => {
  if (typeof window === "undefined") {
    return null;
  }

  return localStorage.getItem("token") || localStorage.getItem("crm_token");
};

function GuardedRoute({ children }) {
  const location = useLocation();
  const { user, sessionChecked } = useSelector((state) => state.auth);
  const token = useSelector((state) => state.auth.token) || getStoredToken();

  if (token && !sessionChecked && !user) {
    return <LoadingState label="Restoring your secure session..." />;
  }

  if (user && !canAccessRoute(user, location.pathname)) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <ProtectedRoute>
      {children}
    </ProtectedRoute>
  );
}

function PublicOnlyRoute({ children }) {
  const token = useSelector((state) => state.auth.token) || getStoredToken();
  return token ? <Navigate to={getPreferredStartRoute()} replace /> : children;
}

function RoutedApp() {
  const dispatch = useDispatch();
  const location = useLocation();
  const routerNavigate = useRouterNavigate();
  const { token, user } = useSelector((state) => state.auth);
  const { error } = useSelector((state) => state.crm);
  const theme = useSelector((state) => state.ui.theme);
  const effectiveToken = token || getStoredToken();

  useEffect(() => {
    dispatch(setRoute(location.pathname || "/"));
  }, [dispatch, location.pathname]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.classList.remove("light", "dark");
    document.documentElement.classList.add(theme);
  }, [theme]);

  useEffect(() => {
    if (effectiveToken && !token) {
      dispatch(hydrateAuth());
    }
  }, [dispatch, effectiveToken, token]);

  useEffect(() => {
    if (effectiveToken && !user) {
      dispatch(fetchSession());
    }
  }, [dispatch, effectiveToken, user]);

  useEffect(() => {
    const handleUnauthorized = () => {
      dispatch(logout());
      routerNavigate("/login", { replace: true });
    };

    window.addEventListener("crm:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("crm:unauthorized", handleUnauthorized);
  }, [dispatch, routerNavigate]);

  useEffect(() => {
    if (effectiveToken) {
      dispatch(fetchDashboardData());
    }
  }, [dispatch, effectiveToken]);

  return (
    <>
      {error && effectiveToken ? (
        <div className="fixed right-4 top-4 z-50 w-full max-w-md">
          <ErrorBanner message={error} />
        </div>
      ) : null}
      <Suspense fallback={<LoadingState label="Loading workspace..." />}>
        <Routes>
          <Route
            path="/"
            element={
              <PublicOnlyRoute>
                <LandingPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <LoginPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/signup"
            element={
              <PublicOnlyRoute>
                <SignupPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/dashboard"
            element={
              <GuardedRoute>
                <DashboardPage />
              </GuardedRoute>
            }
          />
          <Route
            path="/leads"
            element={
              <GuardedRoute>
                <LeadsPage />
              </GuardedRoute>
            }
          />
          <Route
            path="/leads/:id"
            element={
              <GuardedRoute>
                <LeadDetailPage />
              </GuardedRoute>
            }
          />
          <Route
            path="/customers"
            element={
              <GuardedRoute>
                <CustomersPage />
              </GuardedRoute>
            }
          />
          <Route
            path="/customers/:id"
            element={
              <GuardedRoute>
                <CustomerDetailPage />
              </GuardedRoute>
            }
          />
          <Route
            path="/pipeline"
            element={
              <GuardedRoute>
                <PipelinePage />
              </GuardedRoute>
            }
          />
          <Route
            path="/pipeline/:id"
            element={
              <GuardedRoute>
                <DealDetailPage />
              </GuardedRoute>
            }
          />
          <Route
            path="/activities"
            element={
              <GuardedRoute>
                <ActivitiesPage />
              </GuardedRoute>
            }
          />
          <Route
            path="/analytics"
            element={
              <GuardedRoute>
                <AnalyticsPage />
              </GuardedRoute>
            }
          />
          <Route
            path="/reports"
            element={
              <GuardedRoute>
                <ReportsPage />
              </GuardedRoute>
            }
          />
          <Route
            path="/audit"
            element={
              <GuardedRoute>
                <AuditLogsPage />
              </GuardedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <GuardedRoute>
                <SettingsPage />
              </GuardedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <GuardedRoute>
                <UsersPage />
              </GuardedRoute>
            }
          />
          <Route
            path="/team"
            element={
              <GuardedRoute>
                <UsersPage />
              </GuardedRoute>
            }
          />
          <Route
            path="/companies/:id"
            element={
              <GuardedRoute>
                <CompanyDetailPage />
              </GuardedRoute>
            }
          />
          <Route path="*" element={<Navigate to={effectiveToken ? "/dashboard" : "/"} replace />} />
        </Routes>
      </Suspense>
    </>
  );
}

export default function App() {
  return <RoutedApp />;
}
