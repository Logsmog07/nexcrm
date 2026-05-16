import { configureStore, createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import authApi from "../api/authApi";
import crmApi from "../api/crmApi";
import {
  canAccessAnalytics,
  canManageUsers,
  isPlatformAdmin,
} from "../lib/roles";
import { saveAppSettings } from "../lib/settings";

const storage = typeof window !== "undefined" ? window.localStorage : null;
const currentPath = typeof window !== "undefined" ? window.location.pathname || "/" : "/";
const storedToken = storage?.getItem("token") || storage?.getItem("crm_token") || null;
const storedUser = storage?.getItem("user") || storage?.getItem("crm_user") || null;
const storedTheme = storage?.getItem("crm_theme") || "dark";
const storedSidebarCollapsed = storage?.getItem("crm_sidebar_collapsed") === "true";

function parseStoredUserSafely(rawValue) {
  if (!rawValue) {
    return null;
  }

  try {
    return JSON.parse(rawValue);
  } catch {
    storage?.removeItem("user");
    storage?.removeItem("crm_user");
    return null;
  }
}

export const loginUser = createAsyncThunk("auth/login", async (payload, thunkApi) => {
  try {
    const response = await authApi.login(payload);
    if (response?.settings) {
      saveAppSettings(response.settings);
    }
    return response;
  } catch (error) {
    return thunkApi.rejectWithValue(error.message);
  }
});

export const signupUser = createAsyncThunk("auth/signup", async (payload, thunkApi) => {
  try {
    const response = await authApi.signup(payload);
    if (response?.settings) {
      saveAppSettings(response.settings);
    }
    return response;
  } catch (error) {
    return thunkApi.rejectWithValue(error.message);
  }
});

export const fetchSession = createAsyncThunk("auth/session", async (_, thunkApi) => {
  try {
    const response = await authApi.me();
    if (response?.settings) {
      saveAppSettings(response.settings);
    }
    return response.user;
  } catch (error) {
    return thunkApi.rejectWithValue(error.message);
  }
});

const authSlice = createSlice({
  name: "auth",
  initialState: {
    token: storedToken || null,
    user: parseStoredUserSafely(storedUser),
    loading: false,
    sessionChecked: !storedToken,
    error: null,
  },
  reducers: {
    logout(state) {
      state.token = null;
      state.user = null;
      state.sessionChecked = true;
      state.error = null;
      storage?.removeItem("token");
      storage?.removeItem("user");
      storage?.removeItem("crm_token");
      storage?.removeItem("crm_user");
      storage?.removeItem("crm_impersonation_active");
      storage?.removeItem("crm_impersonator_token");
      storage?.removeItem("crm_impersonator_user");
    },
    hydrateAuth(state) {
      state.token = storage?.getItem("token") || storage?.getItem("crm_token") || null;
      const rawUser = storage?.getItem("user") || storage?.getItem("crm_user") || null;
      state.user = parseStoredUserSafely(rawUser);
      state.sessionChecked = !state.token;
    },
    clearAuthError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSession.pending, (state) => {
        state.loading = true;
        state.sessionChecked = false;
      })
      .addCase(loginUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action) => {
        state.loading = false;
        state.sessionChecked = true;
        state.token = action.payload.token;
        state.user = action.payload.user;
        storage?.setItem("token", action.payload.token);
        storage?.setItem("user", JSON.stringify(action.payload.user));
        storage?.setItem("crm_token", action.payload.token);
        storage?.setItem("crm_user", JSON.stringify(action.payload.user));
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.loading = false;
        state.sessionChecked = true;
        state.error = action.payload || "Unable to login";
      })
      .addCase(signupUser.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(signupUser.fulfilled, (state, action) => {
        state.loading = false;
        state.sessionChecked = true;
        state.token = action.payload.token;
        state.user = action.payload.user;
        storage?.setItem("token", action.payload.token);
        storage?.setItem("user", JSON.stringify(action.payload.user));
        storage?.setItem("crm_token", action.payload.token);
        storage?.setItem("crm_user", JSON.stringify(action.payload.user));
      })
      .addCase(signupUser.rejected, (state, action) => {
        state.loading = false;
        state.sessionChecked = true;
        state.error = action.payload || "Unable to signup";
      })
      .addCase(fetchSession.rejected, (state) => {
        state.loading = false;
        state.sessionChecked = true;
        state.token = null;
        state.user = null;
        storage?.removeItem("token");
        storage?.removeItem("user");
        storage?.removeItem("crm_token");
        storage?.removeItem("crm_user");
        storage?.removeItem("crm_impersonation_active");
        storage?.removeItem("crm_impersonator_token");
        storage?.removeItem("crm_impersonator_user");
      })
      .addCase(fetchSession.fulfilled, (state, action) => {
        state.loading = false;
        state.sessionChecked = true;
        state.user = action.payload;
        storage?.setItem("user", JSON.stringify(action.payload));
        storage?.setItem("crm_user", JSON.stringify(action.payload));
      });
  },
});

export const fetchDashboardData = createAsyncThunk(
  "crm/fetchDashboard",
  async (_, thunkApi) => {
    try {
      const state = thunkApi.getState();
      const currentUser = state.auth.user;
      const selectedCompanyId = state.crm.selectedCompanyId;

      if (isPlatformAdmin(currentUser)) {
        const companies = await crmApi.listCompanies();
        const resolvedCompanyId =
          selectedCompanyId || companies.data?.[0]?.id || null;
        const companyOverview = resolvedCompanyId
          ? await crmApi.getCompanyOverview(resolvedCompanyId)
          : { data: null };
        const users = await crmApi.listUsers().catch(() => ({ data: [] }));

        return {
          dashboard: null,
          leads: [],
          customers: [],
          deals: [],
          activities: [],
          notifications: [],
          users: users.data || [],
          companies: companies.data || [],
          selectedCompanyId: resolvedCompanyId,
          companyOverview: companyOverview.data || null,
        };
      }

      const dashboardPromise = canAccessAnalytics(currentUser)
        ? crmApi.getDashboard()
        : Promise.resolve({ data: null });
      const [dashboard, leads, customers, deals, activities, notifications, users] =
        await Promise.all([
          dashboardPromise,
          crmApi.listLeads(),
          crmApi.listCustomers(),
          crmApi.listDeals(),
          crmApi.listActivities(),
          crmApi.listNotifications(),
          canManageUsers(currentUser)
            ? crmApi.listUsers().catch(() => ({ data: [] }))
            : Promise.resolve({ data: [] }),
        ]);

      return {
        dashboard: dashboard.data,
        leads: leads.data,
        customers: customers.data,
        deals: deals.data,
        activities: activities.data,
        notifications: notifications.data,
        users: users.data || [],
        companies: [],
        selectedCompanyId: null,
        companyOverview: null,
      };
    } catch (error) {
      return thunkApi.rejectWithValue(error.message);
    }
  }
);

export const fetchPlatformCompanyOverview = createAsyncThunk(
  "crm/fetchPlatformCompanyOverview",
  async (companyId, thunkApi) => {
    try {
      const response = await crmApi.getCompanyOverview(companyId);
      return {
        companyId,
        overview: response.data,
      };
    } catch (error) {
      return thunkApi.rejectWithValue(error.message);
    }
  }
);

const crmSlice = createSlice({
  name: "crm",
  initialState: {
    dashboard: null,
    leads: [],
    customers: [],
    deals: [],
    activities: [],
    notifications: [],
    users: [],
    companies: [],
    selectedCompanyId: null,
    companyOverview: null,
    loading: false,
    error: null,
  },
  reducers: {
    setLeads(state, action) {
      state.leads = action.payload;
    },
    setCustomers(state, action) {
      state.customers = action.payload;
    },
    setDeals(state, action) {
      state.deals = action.payload;
    },
    setActivities(state, action) {
      state.activities = action.payload;
    },
    setNotifications(state, action) {
      state.notifications = action.payload;
    },
    setUsers(state, action) {
      state.users = action.payload;
    },
    setCompanies(state, action) {
      state.companies = action.payload;
    },
    setSelectedCompanyId(state, action) {
      state.selectedCompanyId = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchDashboardData.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchDashboardData.fulfilled, (state, action) => {
        state.loading = false;
        state.dashboard = action.payload.dashboard;
        state.leads = action.payload.leads;
        state.customers = action.payload.customers;
        state.deals = action.payload.deals;
        state.activities = action.payload.activities;
        state.notifications = action.payload.notifications;
        state.users = action.payload.users;
        state.companies = action.payload.companies || [];
        state.selectedCompanyId = action.payload.selectedCompanyId || null;
        state.companyOverview = action.payload.companyOverview || null;
      })
      .addCase(fetchDashboardData.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Unable to load dashboard";
      })
      .addCase(fetchPlatformCompanyOverview.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPlatformCompanyOverview.fulfilled, (state, action) => {
        state.loading = false;
        state.selectedCompanyId = action.payload.companyId;
        state.companyOverview = action.payload.overview;
      })
      .addCase(fetchPlatformCompanyOverview.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Unable to load company overview";
      });
  },
});

const uiSlice = createSlice({
  name: "ui",
  initialState: {
    theme: storedTheme,
    route: currentPath,
    sidebarOpen: false,
    sidebarCollapsed: storedSidebarCollapsed,
  },
  reducers: {
    toggleTheme(state) {
      state.theme = state.theme === "dark" ? "light" : "dark";
      storage?.setItem("crm_theme", state.theme);
    },
    setRoute(state, action) {
      state.route = action.payload;
    },
    setSidebarOpen(state, action) {
      state.sidebarOpen = action.payload;
    },
    toggleSidebarCollapsed(state) {
      state.sidebarCollapsed = !state.sidebarCollapsed;
      storage?.setItem("crm_sidebar_collapsed", String(state.sidebarCollapsed));
    },
  },
});

export const { logout, hydrateAuth, clearAuthError } = authSlice.actions;
export const {
  setLeads,
  setCustomers,
  setDeals,
  setActivities,
  setNotifications,
  setUsers,
  setCompanies,
  setSelectedCompanyId,
} =
  crmSlice.actions;
export const { toggleTheme, setRoute, setSidebarOpen, toggleSidebarCollapsed } = uiSlice.actions;

export const store = configureStore({
  reducer: {
    auth: authSlice.reducer,
    crm: crmSlice.reducer,
    ui: uiSlice.reducer,
  },
});
