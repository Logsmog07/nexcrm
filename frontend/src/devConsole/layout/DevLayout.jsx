import { useState } from "react";
import { Outlet } from "react-router-dom";
import DevSidebar from "./DevSidebar";
import DevTopBar from "./DevTopBar";

export default function DevLayout() {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className="dev-console-root dev-shell">
      <DevSidebar collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} />
      <div className="dev-shell-main">
        <DevTopBar />
        <main className="dev-page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
