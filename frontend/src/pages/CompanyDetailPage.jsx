import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { AppShell } from "../components/layout/AppShell";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { ErrorBanner } from "../components/common/ErrorBanner";
import { EmptyState } from "../components/common/EmptyState";
import { RevenueLineChart } from "../components/charts/RevenueLineChart";
import { StatusBarChart } from "../components/charts/StatusBarChart";
import { formatCompactCurrency, formatDateTime } from "../lib/formatters";
import { fetchDashboardData, fetchPlatformCompanyOverview } from "../store";
import crmApi from "../api/crmApi";
import { useNavigate } from "../hooks/useNavigate";
import { StatCard } from "../components/common/StatCard";

export function CompanyDetailPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { companyOverview, loading } = useSelector((state) => state.crm);
  const route = useSelector((state) => state.ui.route);
  const companyId = route.split("/")[2];
  const [error, setError] = useState("");
  const [passwordModal, setPasswordModal] = useState({ open: false, user: null, password: "" });
  const [reassignModal, setReassignModal] = useState({ open: false, user: null, managerId: "" });
  const [submittingPassword, setSubmittingPassword] = useState(false);
  const [submittingReassignment, setSubmittingReassignment] = useState(false);

  useEffect(() => {
    if (companyId) {
      dispatch(fetchPlatformCompanyOverview(companyId));
    }
  }, [companyId, dispatch]);

  const company = companyOverview?.company;
  const dashboard = companyOverview?.dashboard;
  const users = useMemo(() => companyOverview?.users || [], [companyOverview?.users]);
  const recentActivity = companyOverview?.recentActivity || [];
  const managers = useMemo(
    () => users.filter((user) => user.company_role === "manager"),
    [users]
  );

  const refresh = async () => {
    await dispatch(fetchPlatformCompanyOverview(companyId));
    await dispatch(fetchDashboardData());
  };

  const handleDelete = async () => {
    try {
      setError("");
      await crmApi.deleteCompany(companyId);
      await dispatch(fetchDashboardData());
      navigate("/users");
    } catch (apiError) {
      setError(apiError.message || "Unable to delete company");
    }
  };

  const handleUserStatus = async (userId, isActive) => {
    try {
      setError("");
      await crmApi.updateUserStatus(userId, isActive);
      await refresh();
    } catch (apiError) {
      setError(apiError.message || "Unable to update user");
    }
  };

  const submitPasswordReset = async () => {
    try {
      setSubmittingPassword(true);
      setError("");
      await crmApi.resetUserPassword(passwordModal.user.id, passwordModal.password);
      setPasswordModal({ open: false, user: null, password: "" });
    } catch (apiError) {
      setError(apiError.message || "Unable to reset password");
    } finally {
      setSubmittingPassword(false);
    }
  };

  const submitReassignment = async () => {
    try {
      setSubmittingReassignment(true);
      setError("");
      await crmApi.reassignSalesRep(reassignModal.user.id, reassignModal.managerId);
      setReassignModal({ open: false, user: null, managerId: "" });
      await refresh();
    } catch (apiError) {
      setError(apiError.message || "Unable to reassign sales rep");
    } finally {
      setSubmittingReassignment(false);
    }
  };

  if (!company) {
    return (
      <AppShell
        title="Company Detail"
        subtitle="Tenant-level management for platform admins"
      >
        <EmptyState
          title="Company not found"
          description="Select a valid company from the control center to inspect it here."
        />
      </AppShell>
    );
  }

  return (
    <AppShell
      title={company.name}
      subtitle="Tenant detail, team provisioning, lifecycle controls, and operational oversight"
    >
      <ErrorBanner message={error} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Tenant revenue"
          value={formatCompactCurrency(dashboard?.kpis?.revenue || 0)}
          detail={`${dashboard?.kpis?.wonDeals || 0} won deals in this workspace`}
          accent="#ff6a3d"
        />
        <StatCard
          label="Workspace users"
          value={users.length}
          detail={`${users.filter((user) => user.company_role === "manager").length} managers and ${users.filter((user) => user.company_role === "sales_rep").length} reps`}
          accent="#38bdf8"
        />
        <StatCard
          label="Open deals"
          value={dashboard?.kpis?.openDeals || 0}
          detail={`${dashboard?.kpis?.activeLeads || 0} active leads in the funnel`}
          accent="#22c55e"
        />
        <StatCard
          label="Subscription"
          value={company.subscription_plan}
          detail={`${company.status} tenant in ${company.industry || "general industry"}`}
          accent="#a78bfa"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_1fr]">
        <Card>
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-xs uppercase tracking-[0.28em] text-[var(--text-muted)]">
                Company profile
              </div>
              <h3 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{company.name}</h3>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                {company.email} · {company.phone || "No phone"} · {company.industry || "No industry"}
              </p>
            </div>
            <Badge tone={company.status === "active" ? "success" : company.status === "suspended" ? "danger" : "warning"}>
              {company.status}
            </Badge>
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div className="rounded-[20px] border border-[var(--border-soft)] bg-[var(--surface)] p-4">
              <div className="text-sm text-[var(--text-secondary)]">Plan</div>
              <div className="mt-2 text-lg font-semibold text-[var(--text-primary)]">{company.subscription_plan}</div>
            </div>
            <div className="rounded-[20px] border border-[var(--border-soft)] bg-[var(--surface)] p-4">
              <div className="text-sm text-[var(--text-secondary)]">Company size</div>
              <div className="mt-2 text-lg font-semibold text-[var(--text-primary)]">{company.company_size || "Unknown"}</div>
            </div>
            <div className="rounded-[20px] border border-[var(--border-soft)] bg-[var(--surface)] p-4 md:col-span-2">
              <div className="text-sm text-[var(--text-secondary)]">Address</div>
              <div className="mt-2 text-sm text-[var(--text-primary)]">{company.address || "No address provided"}</div>
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button type="button" variant="secondary" onClick={() => navigate("/users")}>
              Back to companies
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                crmApi.updateCompanyStatus(
                  company.id,
                  company.status === "active" ? "suspended" : "active"
                ).then(refresh).catch((apiError) =>
                  setError(apiError.message || "Unable to update company status")
                )
              }
            >
              {company.status === "active" ? "Archive company" : "Reactivate company"}
            </Button>
            <Button type="button" variant="secondary" onClick={handleDelete}>
              Delete company
            </Button>
          </div>
        </Card>

        <Card>
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">
            Tenant controls
          </div>
          <h3 className="mt-2 text-xl font-semibold text-[var(--text-primary)]">Operations summary</h3>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
            Manage lifecycle, review tenant metrics, and intervene on user access without entering the company’s operating CRM.
          </p>
          <div className="mt-6 grid gap-3">
            {[
              ["Governance", "Archive, reactivate, or remove the tenant from one place."],
              ["Team ops", "Reset passwords and reassign reps across managers safely."],
              ["Oversight", "Review trend movement and recent activity before taking action."],
            ].map(([title, detail]) => (
              <div
                key={title}
                className="rounded-[20px] border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-4"
              >
                <div className="text-sm font-semibold text-[var(--text-primary)]">{title}</div>
                <div className="mt-1 text-sm text-[var(--text-secondary)]">{detail}</div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_1fr]">
        <RevenueLineChart data={dashboard?.charts?.revenueTrend || []} />
        <StatusBarChart data={dashboard?.charts?.leadStatusDistribution || []} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">Team directory</h3>
              <p className="mt-2 text-sm text-[var(--text-secondary)]">
                Reset passwords, deactivate accounts, and reassign sales reps between managers.
              </p>
            </div>
          </div>
            <div className="mt-5 space-y-4">
              {users.map((user) => (
              <div key={user.id} className="rounded-[20px] border border-[var(--border-soft)] bg-[var(--surface)] p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="text-sm font-semibold text-[var(--text-primary)]">{user.full_name}</div>
                    <div className="mt-1 text-sm text-[var(--text-secondary)]">{user.email}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge tone={user.company_role === "company_admin" ? "warning" : user.company_role === "manager" ? "info" : "neutral"}>
                        {String(user.role || "").replaceAll("_", " ")}
                      </Badge>
                      <Badge tone={user.is_active ? "success" : "danger"}>
                        {user.is_active ? "active" : "inactive"}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {user.role !== "platform_admin" ? (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() =>
                          setPasswordModal({ open: true, user, password: "" })
                        }
                      >
                        Reset password
                      </Button>
                    ) : null}
                    {user.company_role === "sales_rep" ? (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() =>
                          setReassignModal({
                            open: true,
                            user,
                            managerId: user.manager_id || "",
                          })
                        }
                      >
                        Reassign
                      </Button>
                    ) : null}
                    {user.role !== "platform_admin" ? (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => handleUserStatus(user.id, !user.is_active)}
                      >
                        {user.is_active ? "Deactivate" : "Activate"}
                      </Button>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
                  Manager: {user.manager_name || "Top-level"}
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Recent tenant activity</h3>
          <div className="mt-5 space-y-4">
            {recentActivity.length ? (
              recentActivity.map((activity) => (
                <div key={activity.id} className="rounded-[20px] border border-[var(--border-soft)] bg-[var(--surface)] p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <div className="text-sm font-medium text-[var(--text-primary)]">{activity.subject}</div>
                      <div className="mt-1 text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
                        {activity.type} by {activity.user_name || "System"}
                      </div>
                    </div>
                    <div className="text-xs text-[var(--text-secondary)]">
                      {formatDateTime(activity.created_at)}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState
                title="No recent tenant activity"
                description="Recent lead, customer, and deal actions will appear here once the workspace is active."
              />
            )}
          </div>
        </Card>
      </div>

      <Modal
        open={passwordModal.open}
        title={`Reset password for ${passwordModal.user?.full_name || ""}`}
        onClose={() => setPasswordModal({ open: false, user: null, password: "" })}
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            submitPasswordReset();
          }}
        >
          <Input
            type="password"
            placeholder="New temporary password"
            value={passwordModal.password}
            onChange={(event) =>
              setPasswordModal((current) => ({ ...current, password: event.target.value }))
            }
          />
          <div className="flex justify-end">
            <Button type="submit" disabled={loading || submittingPassword || !passwordModal.password}>
              {submittingPassword ? "Saving..." : "Save password"}
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={reassignModal.open}
        title={`Reassign ${reassignModal.user?.full_name || ""}`}
        onClose={() => setReassignModal({ open: false, user: null, managerId: "" })}
      >
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            submitReassignment();
          }}
        >
          <Select
            value={reassignModal.managerId}
            onChange={(event) =>
              setReassignModal((current) => ({ ...current, managerId: event.target.value }))
            }
          >
            <option value="">Select manager</option>
            {managers.map((manager) => (
              <option key={manager.id} value={manager.id}>
                {manager.full_name}
              </option>
            ))}
          </Select>
          <div className="flex justify-end">
            <Button
              type="submit"
              disabled={loading || submittingReassignment || !reassignModal.managerId}
            >
              {submittingReassignment ? "Saving..." : "Save assignment"}
            </Button>
          </div>
        </form>
      </Modal>
    </AppShell>
  );
}
