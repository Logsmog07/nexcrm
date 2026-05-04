import { useEffect, useState } from "react";
import { DEV_TOKEN_KEY, formatDateTime } from "../utils";

export default function DevTopBar() {
  const [now, setNow] = useState(() => new Date().toISOString());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(new Date().toISOString());
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  const handleExit = () => {
    localStorage.removeItem(DEV_TOKEN_KEY);
    sessionStorage.removeItem("devConsole_company_filter");
    window.location.assign("http://localhost:5175/dev-console/login");
  };

  return (
    <header className="dev-topbar">
      <div className="dev-topbar-title">
        <span className="dev-console-cursor">|</span>
        <h1>NexCRM Dev Console</h1>
      </div>

      <div className="dev-topbar-meta">
        <span>{formatDateTime(now)}</span>
        <button type="button" className="dev-exit-btn" onClick={handleExit}>
          EXIT CONSOLE
        </button>
      </div>
    </header>
  );
}
