export const designTokens = {
  light: {
    primary: "#4F46E5",
    primaryHover: "#4338CA",
    success: "#10B981",
    warning: "#F59E0B",
    danger: "#EF4444",
    bgBase: "#F9FAFB",
    bgCard: "#FFFFFF",
    border: "#E5E7EB",
    textPrimary: "#111827",
    textSecondary: "#6B7280",
    sidebarBg: "#FFFFFF",
    sidebarActive: "#EEF2FF",
  },
  dark: {
    bgBase: "#0F172A",
    bgCard: "#1E293B",
    border: "#334155",
    textPrimary: "#F1F5F9",
    textSecondary: "#94A3B8",
    sidebarBg: "#1E293B",
    sidebarActive: "#312E81",
  },
};

export const THEME_STORAGE_KEY = "crm_theme";

export function initializeDesignSystem() {
  if (typeof document === "undefined") return;

  const root = document.documentElement;
  const persistedTheme = localStorage.getItem(THEME_STORAGE_KEY);
  const theme = persistedTheme === "light" ? "light" : "dark";

  root.classList.remove("light", "dark");
  root.classList.add(theme);
  root.dataset.theme = theme;
}