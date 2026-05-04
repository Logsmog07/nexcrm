import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppShell } from "../components/layout/AppShell";
import { DataTable } from "../components/tables/DataTable";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/common/EmptyState";
import { formatDateTime } from "../lib/formatters";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Modal } from "../components/ui/Modal";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Textarea } from "../components/ui/Textarea";
import { ErrorBanner } from "../components/common/ErrorBanner";
import authApi from "../api/authApi";
import crmApi from "../api/crmApi";
import { fetchDashboardData, hydrateAuth } from "../store";
import { useNavigate } from "../hooks/useNavigate";
import { StatCard } from "../components/common/StatCard";
import { isCompanyAdmin, isPlatformAdmin } from "../lib/roles";

const emptyCompanyForm = {
  name: "",
  email: "",
  phone: "",
  industry: "",
  companySize: "",
  address: "",
  subscriptionPlan: "starter",
  status: "trial",
};

const emptyUserForm = {
  fullName: "",
  email: "",
  password: "",
  companyId: "",
  companyRole: "manager",
  managerId: "",
};

export function UsersPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { users, companies, loading } = useSelector((state) => state.crm);
  const currentUser = useSelector((state) => state.auth.user);
  const platformAdminView = isPlatformAdmin(currentUser);
  const companyAdminView = isCompanyAdmin(currentUser);
  const canManageWorkspaceUsers = platformAdminView || companyAdminView;
  const [companyModalOpen, setCompanyModalOpen] = useState(false);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [companyForm, setCompanyForm] = useState(emptyCompanyForm);
  const [passwordModal, setPasswordModal] = useState({ open: false, user: null, password: "" });

  const buildInitialUserForm = () => ({
    ...emptyUserForm,
    companyId: companyAdminView ? String(currentUser?.company_id || "") : "",
  });

  const [userForm, setUserForm] = useState(() => buildInitialUserForm());
  const [editingCompanyId, setEditingCompanyId] = useState(null);
  const [actionError, setActionError] = useState("");
  const [savingCompany, setSavingCompany] = useState(false);
  const [savingUser, setSavingUser] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [accessingUserId, setAccessingUserId] = useState(null);

  const availableCompanies = useMemo(() => {
    if (platformAdminView) {
      return companies;
    }

    if (currentUser?.company_id) {
      return [
        {
          id: currentUser.company_id,
          name: currentUser.company_name || "My Company",
        },
      ];
    }

    return [];
  }, [platformAdminView, companies, currentUser?.company_id, currentUser?.company_name]);

  const roleOptions = useMemo(() => {
    if (platformAdminView) {
      return [
        { value: "company_admin", label: "Company admin" },
        { value: "manager", label: "Manager" },
        { value: "sales_rep", label: "Sales rep" },
      ];
    }

    return [
      { value: "manager", label: "Manager" },
      { value: "sales_rep", label: "Sales rep" },
    ];
  }, [platformAdminView]);

  const selectedManagers = useMemo(
    () =>
      users.filter(
        (user) =>
          user.company_role === "manager" &&
          String(user.company_id || "") === String(userForm.companyId || "")
      ),
    [users, userForm.companyId]
  );

  const managementMetrics = useMemo(
    () => ({
      companies: companies.length,
      companyAdmins: users.filter((user) => user.company_role === "company_admin").length,
      managers: users.filter((user) => user.company_role === "manager").length,
      salesReps: users.filter((user) => user.company_role === "sales_rep").length,
      activeUsers: users.filter((user) => user.is_active).length,
    }),
    [companies, users]
  );

  useEffect(() => {
    if (!companyAdminView || !currentUser?.company_id) {
      return;
    }

    setUserForm((current) => {
      if (String(current.companyId || "") === String(currentUser.company_id)) {
        return current;
      }

      return {
        ...current,
        companyId: String(currentUser.company_id),
      };
    });
  }, [companyAdminView, currentUser?.company_id]);

  const resetCompanyForm = () => {
    setEditingCompanyId(null);
    setCompanyForm(emptyCompanyForm);
    setCompanyModalOpen(false);
    setActionError("");
  };

  const resetUserForm = () => {
    setUserForm(buildInitialUserForm());
    setUserModalOpen(false);
    setActionError("");
  };

  const resetPasswordForm = () => {
    setPasswordModal({ open: false, user: null, password: "" });
    setActionError("");
  };

  const refresh = async () => {
    await dispatch(fetchDashboardData());
  };

  const handleCompanySubmit = async () => {
    try {
      setSavingCompany(true);
      setActionError("");
      if (editingCompanyId) {
        await crmApi.updateCompany(editingCompanyId, companyForm);
      } else {
        await crmApi.createCompany(companyForm);
      }
      resetCompanyForm();
      await refresh();
    } catch (error) {
      setActionError(error.message || "Unable to save company");
    } finally {
      setSavingCompany(false);
    }
  };

  const handleUserSubmit = async () => {
    try {
      setSavingUser(true);
      setActionError("");
      await crmApi.createUser({
        ...userForm,
        companyId: userForm.companyId || String(currentUser?.company_id || ""),
        managerId: userForm.companyRole === "sales_rep" ? userForm.managerId : "",
      });
      resetUserForm();
      await refresh();
    } catch (error) {
      setActionError(error.message || "Unable to create user");
    } finally {
      setSavingUser(false);
    }
  };

  const handleResetPassword = async () => {
    const password = String(passwordModal.password || "");
    if (password.length < 8 || !/[A-Z]/.test(password) || !/[0-9]/.test(password)) {
      setActionError("Password must be at least 8 characters and include one uppercase letter and one number");
      return;
    }

    if (!passwordModal.user?.id) {
      setActionError("Select a valid user to reset password");
      return;
    }

    try {
      setResettingPassword(true);
      setActionError("");
      await crmApi.resetUserPassword(passwordModal.user.id, password);
      resetPasswordForm();
      await refresh();
    } catch (error) {
      setActionError(error.message || "Unable to reset password");
    } finally {
      setResettingPassword(false);
    }
  };

  const handleCompanyStatus = async (companyId, status) => {
    try {
      setActionError("");
      await crmApi.updateCompanyStatus(companyId, status);
      await refresh();
    } catch (error) {
      setActionError(error.message || "Unable to update company status");
    }
  };

  const handleUserStatus = async (userId, isActive) => {
    try {
      setActionError("");
      await crmApi.updateUserStatus(userId, isActive);
      await refresh();
    } catch (error) {
      setActionError(error.message || "Unable to update user status");
    }
  };

  const handleAccessAccount = async (targetUser) => {
    if (!targetUser?.id) {
      return;
    }

    try {
      setAccessingUserId(targetUser.id);
      setActionError("");

      const currentToken =
        localStorage.getItem("token") || localStorage.getItem("crm_token") || "";
      const currentUserRaw =
        localStorage.getItem("user") || localStorage.getItem("crm_user") || "null";

      if (!localStorage.getItem("crm_impersonation_active")) {
        localStorage.setItem("crm_impersonator_token", currentToken);
        localStorage.setItem("crm_impersonator_user", currentUserRaw);
      }

      const response = await authApi.impersonate(targetUser.id);

      localStorage.setItem("token", response.token || "");
      localStorage.setItem("crm_token", response.token || "");
      localStorage.setItem("user", JSON.stringify(response.user || null));
      localStorage.setItem("crm_user", JSON.stringify(response.user || null));
      localStorage.setItem("crm_impersonation_active", "true");

      dispatch(hydrateAuth());
      await dispatch(fetchDashboardData());
      navigate("/dashboard");
    } catch (error) {
      setActionError(error.message || "Unable to access this account");
    } finally {
      setAccessingUserId(null);
    }
  };

  const openEditCompany = (company) => {
    setActionError("");
    setEditingCompanyId(company.id);
    setCompanyForm({
      name: company.name || "",
      email: company.email || "",
      phone: company.phone || "",
      industry: company.industry || "",
      companySize: company.company_size || "",
      address: company.address || "",
      subscriptionPlan: company.subscription_plan || "starter",
      status: company.status || "trial",
    });
    setCompanyModalOpen(true);
  };

  return (
    <AppShell
      title={platformAdminView ? "Companies & Users" : "Team Users"}
      subtitle={
        platformAdminView
          ? "Platform admin visibility into every workspace account"
          : "People and role assignments inside your company workspace"
      }
    >
      <ErrorBanner message={actionError} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={platformAdminView ? "Companies" : "Workspace users"}
          value={platformAdminView ? managementMetrics.companies : users.length}
          detail={
            platformAdminView
              ? `${managementMetrics.activeUsers} active tenant users provisioned`
              : `${managementMetrics.activeUsers} active people in this company`
          }
          accent="#ff6a3d"
        />
        <StatCard
          label="Company admins"
          value={managementMetrics.companyAdmins}
          detail="Primary admins responsible for each tenant workspace"
          accent="#f59e0b"
        />
        <StatCard
          label="Managers"
          value={managementMetrics.managers}
          detail="Mid-layer team leads currently assigned across tenants"
          accent="#38bdf8"
        />
        <StatCard
          label="Sales reps"
          value={managementMetrics.salesReps}
          detail="Front-line operating users inside company workspaces"
          accent="#a78bfa"
        />
      </div>

      {platformAdminView ? (
        <div className="mb-6 mt-6 grid gap-6 xl:grid-cols-[1fr_1.05fr]">
          <Card>
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">
                  Tenant operations
                </div>
                <h3 className="mt-2 text-lg font-semibold text-[var(--text-primary)]">Company management</h3>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  Create companies, update workspace metadata, and suspend or reactivate tenants.
                </p>
              </div>
              <Button type="button" onClick={() => setCompanyModalOpen(true)}>
                Add company
              </Button>
            </div>
            <div className="mt-5 space-y-4">
              {companies.length ? (
                companies.map((company) => (
                  <div key={company.id} className="rounded-[22px] border border-[var(--border-soft)] bg-[var(--surface)] p-4">
                    <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                      <div>
                        <div className="text-base font-semibold text-[var(--text-primary)]">{company.name}</div>
                        <div className="mt-1 text-sm text-[var(--text-secondary)]">
                          {company.email} · {company.industry || "No industry"}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge tone={company.status === "active" ? "success" : company.status === "suspended" ? "danger" : "warning"}>
                          {company.status}
                        </Badge>
                        <Button type="button" variant="secondary" onClick={() => openEditCompany(company)}>
                          Edit
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => navigate(`/companies/${company.id}`)}
                        >
                          Open
                        </Button>
                        {company.status !== "active" ? (
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => handleCompanyStatus(company.id, "active")}
                          >
                            Activate
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => handleCompanyStatus(company.id, "suspended")}
                          >
                            Suspend
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="mt-4 grid gap-3 text-sm text-[var(--text-secondary)] md:grid-cols-4">
                      <div>{company.total_users} users</div>
                      <div>{company.total_leads} leads</div>
                      <div>{company.total_customers} customers</div>
                      <div>{company.subscription_plan} plan</div>
                    </div>
                  </div>
                ))
              ) : (
                <EmptyState
                  title="No companies yet"
                  description="Create the first tenant workspace to start onboarding companies into the platform."
                />
              )}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">
                  Provisioning
                </div>
                <h3 className="mt-2 text-lg font-semibold text-[var(--text-primary)]">Workspace provisioning</h3>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">
                  Create company admins, managers, and sales reps directly from the platform control center.
                </p>
              </div>
              <Button type="button" onClick={() => setUserModalOpen(true)}>
                Add user
              </Button>
            </div>
            <div className="mt-5 grid gap-4 md:grid-cols-3">
              <div className="rounded-[22px] border border-[var(--border-soft)] bg-[var(--surface)] p-4">
                <div className="text-sm text-[var(--text-secondary)]">Company admins</div>
                <div className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
                  {users.filter((user) => user.company_role === "company_admin").length}
                </div>
              </div>
              <div className="rounded-[22px] border border-[var(--border-soft)] bg-[var(--surface)] p-4">
                <div className="text-sm text-[var(--text-secondary)]">Managers</div>
                <div className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
                  {users.filter((user) => user.company_role === "manager").length}
                </div>
              </div>
              <div className="rounded-[22px] border border-[var(--border-soft)] bg-[var(--surface)] p-4">
                <div className="text-sm text-[var(--text-secondary)]">Sales reps</div>
                <div className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
                  {users.filter((user) => user.company_role === "sales_rep").length}
                </div>
              </div>
            </div>
          </Card>
        </div>
      ) : null}

      {!platformAdminView && canManageWorkspaceUsers ? (
        <Card className="mb-6 mt-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">
                Team provisioning
              </div>
              <h3 className="mt-2 text-lg font-semibold text-[var(--text-primary)]">Manage your workspace users</h3>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                Add managers and sales reps, control activation status, and reset credentials for your team.
              </p>
            </div>
            <Button type="button" onClick={() => setUserModalOpen(true)}>
              Add user
            </Button>
          </div>
        </Card>
      ) : null}

      <div className="mt-6">
        <DataTable
          rowKey="id"
          rows={users}
          emptyTitle="No users yet"
          emptyDescription={
            platformAdminView
              ? "Create a company admin, manager, or sales rep to begin provisioning a workspace."
              : "Users will appear here once people are added to this company."
          }
          columns={[
          {
            key: "full_name",
            label: "User",
            render: (user) => (
              <div>
                <div className="font-medium text-[var(--text-primary)]">{user.full_name}</div>
                <div className="mt-1 text-xs text-[var(--text-secondary)]">{user.email}</div>
              </div>
            ),
          },
          {
            key: "role",
            label: "Role",
            render: (user) => (
              <Badge
                tone={
                  user.role === "platform_admin"
                    ? "danger"
                    : user.role === "company_admin"
                    ? "warning"
                    : user.role === "manager"
                    ? "warning"
                    : "info"
                }
              >
                {String(user.role || "sales_rep").replaceAll("_", " ")}
              </Badge>
            ),
          },
          {
            key: "company_name",
            label: "Company",
            render: (user) => (
              <div>
                <div className="text-sm text-[var(--text-primary)]">{user.company_name || "Platform"}</div>
                <div className="mt-1 text-xs text-[var(--text-secondary)]">
                  {user.manager_name || "Top-level access"}
                </div>
              </div>
            ),
          },
          {
            key: "is_active",
            label: "Status",
            render: (user) => <Badge tone={user.is_active ? "success" : "danger"}>{user.is_active ? "active" : "inactive"}</Badge>,
          },
          {
            key: "created_at",
            label: "Joined",
            render: (user) => formatDateTime(user.created_at),
          },
          ...(canManageWorkspaceUsers
            ? [
                {
                  key: "actions",
                  label: "Actions",
                  render: (user) => {
                    if (user.role === "platform_admin") {
                      return null;
                    }

                    const targetCompanyAdmin = user.role === "company_admin";
                    const canManageTarget = platformAdminView || !targetCompanyAdmin;

                    if (!canManageTarget) {
                      return <span className="text-xs text-[var(--text-secondary)]">Restricted</span>;
                    }

                    return (
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() => handleUserStatus(user.id, !user.is_active)}
                        >
                          {user.is_active ? "Deactivate" : "Activate"}
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          onClick={() =>
                            setPasswordModal({
                              open: true,
                              user,
                              password: "",
                            })
                          }
                        >
                          Reset password
                        </Button>
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={accessingUserId === user.id || !user.is_active}
                          onClick={() => handleAccessAccount(user)}
                        >
                          {accessingUserId === user.id ? "Accessing..." : "Access account"}
                        </Button>
                      </div>
                    );
                  },
                },
              ]
            : []),
        ]}
        />
      </div>

      <Modal
        open={companyModalOpen}
        title={editingCompanyId ? "Edit company" : "Add company"}
        onClose={resetCompanyForm}
      >
        <form
          className="grid gap-6"
          onSubmit={(event) => {
            event.preventDefault();
            handleCompanySubmit();
          }}
        >
          <div className="rounded-[24px] border border-[var(--border-soft)] bg-[var(--surface)] p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">
              Company profile
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Input
                placeholder="Company name"
                value={companyForm.name}
                onChange={(event) => setCompanyForm({ ...companyForm, name: event.target.value })}
              />
              <Input
                placeholder="Company email"
                type="email"
                value={companyForm.email}
                onChange={(event) => setCompanyForm({ ...companyForm, email: event.target.value })}
              />
              <Input
                placeholder="Company phone"
                value={companyForm.phone}
                onChange={(event) => setCompanyForm({ ...companyForm, phone: event.target.value })}
              />
              <Input
                placeholder="Industry"
                value={companyForm.industry}
                onChange={(event) => setCompanyForm({ ...companyForm, industry: event.target.value })}
              />
            </div>
          </div>
          <div className="rounded-[24px] border border-[var(--border-soft)] bg-[var(--surface)] p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">
              Commercial setup
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Input
                placeholder="Company size"
                value={companyForm.companySize}
                onChange={(event) =>
                  setCompanyForm({ ...companyForm, companySize: event.target.value })
                }
              />
              <Select
                value={companyForm.subscriptionPlan}
                onChange={(event) =>
                  setCompanyForm({ ...companyForm, subscriptionPlan: event.target.value })
                }
              >
                <option value="starter">Starter</option>
                <option value="growth">Growth</option>
                <option value="enterprise">Enterprise</option>
              </Select>
              <Select
                value={companyForm.status}
                onChange={(event) => setCompanyForm({ ...companyForm, status: event.target.value })}
              >
                <option value="trial">Trial</option>
                <option value="active">Active</option>
                <option value="suspended">Suspended</option>
              </Select>
            </div>
          </div>
          <div className="rounded-[24px] border border-[var(--border-soft)] bg-[var(--surface)] p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">
              Address
            </div>
            <div className="mt-4">
            <Textarea
              placeholder="Address"
              value={companyForm.address}
              onChange={(event) => setCompanyForm({ ...companyForm, address: event.target.value })}
            />
          </div>
          </div>
          <div className="flex justify-end">
            <Button type="submit" disabled={loading || savingCompany}>
              {savingCompany ? "Saving..." : editingCompanyId ? "Save company" : "Create company"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal open={userModalOpen} title="Add workspace user" onClose={resetUserForm}>
        <form
          className="grid gap-6"
          onSubmit={(event) => {
            event.preventDefault();
            handleUserSubmit();
          }}
        >
          <div className="rounded-[24px] border border-[var(--border-soft)] bg-[var(--surface)] p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">
              Identity
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Input
                placeholder="Full name"
                value={userForm.fullName}
                onChange={(event) => setUserForm({ ...userForm, fullName: event.target.value })}
              />
              <Input
                placeholder="Email"
                type="email"
                value={userForm.email}
                onChange={(event) => setUserForm({ ...userForm, email: event.target.value })}
              />
              <Input
                placeholder="Temporary password"
                type="password"
                value={userForm.password}
                onChange={(event) => setUserForm({ ...userForm, password: event.target.value })}
              />
            </div>
          </div>
          <div className="rounded-[24px] border border-[var(--border-soft)] bg-[var(--surface)] p-5">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">
              Workspace assignment
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <Select
                value={userForm.companyId}
                onChange={(event) => setUserForm({ ...userForm, companyId: event.target.value, managerId: "" })}
                disabled={companyAdminView}
              >
                <option value="">Select company</option>
                {availableCompanies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </Select>
              <Select
                value={userForm.companyRole}
                onChange={(event) =>
                  setUserForm({ ...userForm, companyRole: event.target.value, managerId: "" })
                }
              >
                {roleOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              {userForm.companyRole === "sales_rep" ? (
                <Select
                  value={userForm.managerId}
                  onChange={(event) => setUserForm({ ...userForm, managerId: event.target.value })}
                >
                  <option value="">Select manager</option>
                  {selectedManagers.map((manager) => (
                    <option key={manager.id} value={manager.id}>
                      {manager.full_name}
                    </option>
                  ))}
                </Select>
              ) : null}
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={
                loading ||
                savingUser ||
                !userForm.companyId ||
                (userForm.companyRole === "sales_rep" && !userForm.managerId)
              }
            >
              {savingUser ? "Creating..." : "Create user"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={passwordModal.open}
        title={passwordModal.user ? `Reset password: ${passwordModal.user.full_name}` : "Reset password"}
        onClose={resetPasswordForm}
      >
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            handleResetPassword();
          }}
        >
          <Input
            type="password"
            placeholder="New password"
            value={passwordModal.password}
            onChange={(event) =>
              setPasswordModal((current) => ({
                ...current,
                password: event.target.value,
              }))
            }
          />
          <p className="text-xs text-[var(--text-secondary)]">
            Password must be at least 8 characters and include one uppercase letter and one number.
          </p>
          <div className="flex justify-end">
            <Button type="submit" disabled={resettingPassword}>
              {resettingPassword ? "Resetting..." : "Reset password"}
            </Button>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}
