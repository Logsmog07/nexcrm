import { Provider } from "react-redux";
import { Toaster } from "react-hot-toast";
import { useLocation } from "react-router-dom";
import App from "./App";
import DevConsoleApp from "./devConsole/DevConsoleApp";
import { store } from "./store";
import { AppErrorBoundary } from "./components/common/AppErrorBoundary";

export default function WorkspaceRouter() {
  const location = useLocation();
  const isDevConsoleRoute = location.pathname.startsWith("/dev-console");

  if (isDevConsoleRoute) {
    return <DevConsoleApp />;
  }

  return (
    <AppErrorBoundary>
      <Provider store={store}>
        <App />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3500,
            style: {
              borderRadius: "12px",
              background: "#2b0f16",
              color: "#ffe4e6",
              border: "1px solid rgba(251, 113, 133, 0.4)",
            },
          }}
        />
      </Provider>
    </AppErrorBoundary>
  );
}
