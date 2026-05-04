import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import WorkspaceRouter from "./WorkspaceRouter";
import { initializeDesignSystem } from "./styles/design-system";
import "./index.css";

initializeDesignSystem();

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root not found");
}

createRoot(rootElement).render(
  <StrictMode>
    <BrowserRouter>
      <WorkspaceRouter />
    </BrowserRouter>
  </StrictMode>
);
