import { useEffect, useState } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { DevConsoleProvider } from "./DevConsoleContext";
import DevConsoleLogin from "./DevConsoleLogin";
import DevLayout from "./layout/DevLayout";
import DevAuditLogs from "./pages/DevAuditLogs";
import DevCompanies from "./pages/DevCompanies";
import DevOverview from "./pages/DevOverview";
import DevQuery from "./pages/DevQuery";
import DevSchema from "./pages/DevSchema";
import DevTables from "./pages/DevTables";
import DevUsers from "./pages/DevUsers";
import { validateDevSession } from "./api/devApi";
import "./devConsole.css";

const DEV_TOKEN_KEY = "devToken";

function ProtectedDevConsole({ children }) {
  const [status, setStatus] = useState(() =>
    localStorage.getItem(DEV_TOKEN_KEY) ? "checking" : "unauthorized"
  );

  useEffect(() => {
    if (status !== "checking") {
      return;
    }

    let active = true;
    validateDevSession()
      .then(() => {
        if (active) {
          setStatus("authorized");
        }
      })
      .catch(() => {
        localStorage.removeItem(DEV_TOKEN_KEY);
        if (active) {
          setStatus("unauthorized");
        }
      });

    return () => {
      active = false;
    };
  }, [status]);

  if (status === "checking") {
    return (
      <div className="dev-console-root dev-console-grid">
        <div className="dev-console-card">Verifying dev console session...</div>
      </div>
    );
  }

  if (status === "unauthorized") {
    return <Navigate to="/dev-console/login" replace />;
  }

  return children;
}
export default function DevConsoleApp() {
  return (
    <Routes>
      <Route path="/dev-console/login" element={<DevConsoleLogin />} />
      <Route
        path="/dev-console"
        element={
          <ProtectedDevConsole>
            <DevConsoleProvider>
              <DevLayout />
            </DevConsoleProvider>
          </ProtectedDevConsole>
        }
      >
        <Route index element={<Navigate to="/dev-console/dashboard" replace />} />
        <Route path="dashboard" element={<DevOverview />} />
        <Route path="tables" element={<DevTables />} />
        <Route path="schema" element={<DevSchema />} />
        <Route path="users" element={<DevUsers />} />
        <Route path="companies" element={<DevCompanies />} />
        <Route path="query" element={<DevQuery />} />
        <Route path="audit" element={<DevAuditLogs />} />
        <Route path="*" element={<Navigate to="/dev-console/dashboard" replace />} />
      </Route>
      <Route path="*" element={<Navigate to="/dev-console/login" replace />} />
    </Routes>
  );
}
