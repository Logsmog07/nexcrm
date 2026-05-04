import { createContext, useEffect, useMemo, useState } from "react";

const COMPANY_FILTER_KEY = "devConsole_company_filter";

const DevConsoleContext = createContext(null);

export function DevConsoleProvider({ children }) {
  const [selectedCompanyId, setSelectedCompanyId] = useState(() =>
    sessionStorage.getItem(COMPANY_FILTER_KEY) || ""
  );

  useEffect(() => {
    if (selectedCompanyId) {
      sessionStorage.setItem(COMPANY_FILTER_KEY, selectedCompanyId);
      return;
    }

    sessionStorage.removeItem(COMPANY_FILTER_KEY);
  }, [selectedCompanyId]);

  const value = useMemo(
    () => ({ selectedCompanyId, setSelectedCompanyId }),
    [selectedCompanyId]
  );

  return <DevConsoleContext.Provider value={value}>{children}</DevConsoleContext.Provider>;
}

export { DevConsoleContext };
