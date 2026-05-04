import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import { useParams } from "react-router-dom";
import crmApi from "../api/crmApi";
import { AppShell } from "../components/layout/AppShell";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { EmptyState } from "../components/common/EmptyState";
import { ErrorBanner } from "../components/common/ErrorBanner";
import { LoadingState } from "../components/common/LoadingState";
import { formatCompactCurrency, formatDate, formatDateTime } from "../lib/formatters";
import { useNavigate } from "../hooks/useNavigate";

const toneMap = {
  active: "success",
  at_risk: "warning",
  churned: "danger",
  vip: "info",
};

const dealToneMap = {
  discovery: "info",
  proposal: "warning",
  negotiation: "warning",
  won: "success",
  lost: "danger",
};

const tabs = {
  overview: "overview",
  deals: "deals",
  activity: "activity",
};

function formatLifecycle(value) {
  return String(value || "active").replaceAll("_", " ");
}

function getAccountGuidance(stage) {
  if (stage === "vip") {
    return "High-value relationship. Prioritize proactive expansion and executive check-ins.";
  }
  if (stage === "at_risk") {
    return "Relationship health is declining. Prioritize outreach and a specific recovery plan.";
  }
  if (stage === "churned") {
    return "Account is marked as churned. Track win-back signals and renewal opportunities.";
  }
  return "Relationship is stable. Keep momentum with regular touchpoints and value updates.";
}

export function CustomerDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { deals, activities } = useSelector((state) => state.crm);

  const [customer, setCustomer] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState(tabs.overview);

  useEffect(() => {
    let active = true;

    const loadCustomer = async () => {
      try {
        setLoading(true);
        setError("");
        const response = await crmApi.getCustomer(id);
        if (active) {
          setCustomer(response.data);
        }
      } catch (apiError) {
        if (active) {
          setError(apiError.message || "Unable to load customer details");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadCustomer();
    return () => {
      active = false;
    };
  }, [id]);

  const relatedDeals = useMemo(() => {
    if (!customer) return [];

    return deals
      .filter((deal) => String(deal.customer_id || "") === String(customer.id))
      .sort(
        (left, right) =>
          new Date(right.updated_at || 0).getTime() - new Date(left.updated_at || 0).getTime()
      );
  }, [customer, deals]);

  const relatedActivities = useMemo(() => {
    if (!customer) return [];

    const byId = new Map();

    for (const activity of customer.activities || []) {
      byId.set(activity.id, activity);
    }

    for (const activity of activities) {
      if (String(activity.related_customer_id || "") === String(customer.id)) {
        byId.set(activity.id, activity);
      }
    }

    return [...byId.values()].sort(
      (left, right) =>
        new Date(right.created_at || right.updated_at || 0).getTime() -
        new Date(left.created_at || left.updated_at || 0).getTime()
    );
  }, [customer, activities]);

  const dealMetrics = useMemo(() => {
    const open = relatedDeals.filter((deal) => deal.status === "open").length;
    const won = relatedDeals.filter((deal) => deal.status === "won").length;
    const lost = relatedDeals.filter((deal) => deal.status === "lost").length;
    const openValue = relatedDeals
      .filter((deal) => deal.status === "open")
      .reduce((sum, deal) => sum + Number(deal.value || 0), 0);

    return {
      open,
      won,
      lost,
      openValue,
    };
  }, [relatedDeals]);

  const nextPlannedActivity = useMemo(() => {
    return relatedActivities
      .filter((activity) => activity.due_at && !activity.completed_at)
      .sort(
        (left, right) =>
          new Date(left.due_at || 0).getTime() - new Date(right.due_at || 0).getTime()
      )[0];
  }, [relatedActivities]);

  if (loading) {
    return (
      <AppShell title="Customer Detail" subtitle="Loading customer context">
        <LoadingState label="Loading customer details..." />
      </AppShell>
    );
  }

  return (
    <AppShell
      title={customer?.name || "Customer profile"}
      subtitle="Customer context, account health, and lifecycle execution in one view"
    >
      <ErrorBanner message={error} />

      {customer ? (
        <>
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
            <Button variant="secondary" onClick={() => navigate("/customers")}>
              Back to customers
            </Button>
            {relatedDeals.length ? (
              <Button onClick={() => navigate(`/pipeline/${relatedDeals[0].id}`)}>
                Open latest deal
              </Button>
            ) : null}
          </div>

          <Card className="mb-6 overflow-hidden">
            <div className="rounded-2xl border border-[var(--border)] bg-gradient-to-r from-[var(--primary)]/10 via-[var(--bg-card)] to-emerald-500/10 p-6">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-xs uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                    Account Profile
                  </div>
                  <h2 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
                    {customer.name}
                  </h2>
                  <div className="mt-2 text-sm text-[var(--text-secondary)]">
                    {customer.email || "No email"}
                    {customer.phone ? ` | ${customer.phone}` : ""}
                    {customer.company ? ` | ${customer.company}` : ""}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone={toneMap[customer.lifecycle_stage] || "neutral"}>
                    {formatLifecycle(customer.lifecycle_stage)}
                  </Badge>
                  <span className="rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1 text-xs text-[var(--text-secondary)]">
                    Owner: {customer.owner_name || "Unassigned"}
                  </span>
                </div>
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
                  <div className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">Revenue</div>
                  <div className="mt-2 text-xl font-semibold text-[var(--text-primary)]">
                    {formatCompactCurrency(customer.total_revenue)}
                  </div>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
                  <div className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">Open Deals</div>
                  <div className="mt-2 text-xl font-semibold text-[var(--text-primary)]">
                    {dealMetrics.open}
                  </div>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
                  <div className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">Won / Lost</div>
                  <div className="mt-2 text-xl font-semibold text-[var(--text-primary)]">
                    {dealMetrics.won} / {dealMetrics.lost}
                  </div>
                </div>
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
                  <div className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">Next Follow-up</div>
                  <div className="mt-2 text-xl font-semibold text-[var(--text-primary)]">
                    {nextPlannedActivity ? formatDate(nextPlannedActivity.due_at) : "None"}
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <div className="mb-6 flex flex-wrap items-center gap-2">
            {[
              { key: tabs.overview, label: "Overview" },
              { key: tabs.deals, label: `Deals (${relatedDeals.length})` },
              { key: tabs.activity, label: `Activity Timeline (${relatedActivities.length})` },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                  activeTab === tab.key
                    ? "bg-[var(--sidebar-active)] font-medium text-[var(--text-primary)]"
                    : "text-[var(--text-secondary)] hover:bg-gray-100 dark:hover:bg-slate-700"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === tabs.overview ? (
            <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              <Card>
                <div className="text-xs uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                  Account Snapshot
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
                    <div className="text-xs text-[var(--text-secondary)]">Company</div>
                    <div className="mt-2 text-base font-semibold text-[var(--text-primary)]">
                      {customer.company || "Independent"}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
                    <div className="text-xs text-[var(--text-secondary)]">Industry</div>
                    <div className="mt-2 text-base font-semibold text-[var(--text-primary)]">
                      {customer.industry || "Not set"}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
                    <div className="text-xs text-[var(--text-secondary)]">Source</div>
                    <div className="mt-2 text-base font-semibold text-[var(--text-primary)]">
                      {customer.source_lead_name || "Direct customer record"}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
                    <div className="text-xs text-[var(--text-secondary)]">Last Updated</div>
                    <div className="mt-2 text-base font-semibold text-[var(--text-primary)]">
                      {formatDateTime(customer.updated_at)}
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4">
                  <div className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">
                    Account Notes
                  </div>
                  <p className="mt-2 text-sm leading-6 text-[var(--text-primary)]">
                    {customer.notes || "No account notes yet. Add context to improve continuity across the team."}
                  </p>
                </div>
              </Card>

              <Card>
                <div className="text-xs uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                  Health Guidance
                </div>
                <h3 className="mt-3 text-xl font-semibold text-[var(--text-primary)]">
                  {formatLifecycle(customer.lifecycle_stage)} lifecycle
                </h3>
                <p className="mt-3 text-sm leading-6 text-[var(--text-secondary)]">
                  {getAccountGuidance(customer.lifecycle_stage)}
                </p>

                <div className="mt-6 space-y-3">
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-4 text-sm text-[var(--text-secondary)]">
                    Open pipeline value:{" "}
                    <span className="font-semibold text-[var(--text-primary)]">
                      {formatCompactCurrency(dealMetrics.openValue)}
                    </span>
                  </div>
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-4 text-sm text-[var(--text-secondary)]">
                    Related activities:{" "}
                    <span className="font-semibold text-[var(--text-primary)]">
                      {relatedActivities.length}
                    </span>
                  </div>
                  <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-4 text-sm text-[var(--text-secondary)]">
                    Relationship created:{" "}
                    <span className="font-semibold text-[var(--text-primary)]">
                      {formatDate(customer.created_at)}
                    </span>
                  </div>
                </div>
              </Card>
            </div>
          ) : null}

          {activeTab === tabs.deals ? (
            <Card>
              <div className="mb-4 text-xs uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                Related Deals
              </div>

              {relatedDeals.length ? (
                <>
                  <div className="hidden overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] md:block">
                    <div className="overflow-x-auto">
                      <table className="min-w-full">
                        <thead className="border-b border-[var(--border)] bg-[var(--bg-base)]">
                          <tr>
                            <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-[var(--text-secondary)]">Deal</th>
                            <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-[var(--text-secondary)]">Stage</th>
                            <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-[var(--text-secondary)]">Value</th>
                            <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-[var(--text-secondary)]">Probability</th>
                            <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-[var(--text-secondary)]">Expected Close</th>
                          </tr>
                        </thead>
                        <tbody>
                          {relatedDeals.map((deal) => (
                            <tr
                              key={deal.id}
                              onClick={() => navigate(`/pipeline/${deal.id}`)}
                              className="cursor-pointer border-b border-[var(--border)] transition hover:bg-gray-50 dark:hover:bg-slate-800/40"
                            >
                              <td className="px-4 py-3">
                                <div className="text-sm font-medium text-[var(--text-primary)]">{deal.title}</div>
                                <div className="text-xs text-[var(--text-secondary)]">
                                  {deal.owner_name || "Unassigned owner"}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <Badge tone={dealToneMap[deal.stage] || "neutral"}>{deal.stage}</Badge>
                              </td>
                              <td className="px-4 py-3 text-sm font-medium text-[var(--text-primary)]">
                                {formatCompactCurrency(deal.value)}
                              </td>
                              <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">
                                {Number(deal.probability || 0)}%
                              </td>
                              <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">
                                {formatDate(deal.expected_close_date)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="space-y-3 md:hidden">
                    {relatedDeals.map((deal) => (
                      <button
                        key={deal.id}
                        type="button"
                        onClick={() => navigate(`/pipeline/${deal.id}`)}
                        className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 text-left shadow-sm"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-semibold text-[var(--text-primary)]">{deal.title}</div>
                            <div className="text-xs text-[var(--text-secondary)]">{deal.owner_name || "Unassigned"}</div>
                          </div>
                          <Badge tone={dealToneMap[deal.stage] || "neutral"}>{deal.stage}</Badge>
                        </div>
                        <div className="mt-3 text-xs text-[var(--text-secondary)]">
                          {formatCompactCurrency(deal.value)} | {Number(deal.probability || 0)}% | {formatDate(deal.expected_close_date)}
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              ) : (
                <EmptyState
                  title="No deals linked"
                  description="Attach or create deals from the pipeline to track expansion for this account."
                />
              )}
            </Card>
          ) : null}

          {activeTab === tabs.activity ? (
            <Card>
              <div className="mb-4 text-xs uppercase tracking-[0.2em] text-[var(--text-secondary)]">
                Activity Timeline
              </div>

              {relatedActivities.length ? (
                <div className="space-y-4">
                  {relatedActivities.map((activity) => (
                    <div
                      key={activity.id}
                      className="relative rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4"
                    >
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-[var(--text-primary)]">
                          {activity.subject || "Activity"}
                        </div>
                        <span className="rounded-full border border-[var(--border)] bg-[var(--bg-base)] px-2.5 py-1 text-[11px] uppercase tracking-wide text-[var(--text-secondary)]">
                          {activity.type || "task"}
                        </span>
                      </div>
                      {activity.notes ? (
                        <p className="text-sm text-[var(--text-secondary)]">{activity.notes}</p>
                      ) : null}
                      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-[var(--text-secondary)]">
                        <span>Created: {formatDateTime(activity.created_at)}</span>
                        {activity.due_at ? <span>Due: {formatDateTime(activity.due_at)}</span> : null}
                        {activity.completed_at ? (
                          <span className="text-emerald-500">Completed: {formatDateTime(activity.completed_at)}</span>
                        ) : (
                          <span className="text-amber-500">Open</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="No customer activity yet"
                  description="Calls, tasks, and meeting history for this account will appear here."
                />
              )}
            </Card>
          ) : null}
        </>
      ) : (
        <Card>
          <EmptyState
            title="Customer not available"
            description="This record may have been removed or you may not have permission to view it."
          />
          <div className="mt-4 flex justify-center">
            <Button variant="secondary" onClick={() => navigate("/customers")}>
              Return to customers
            </Button>
          </div>
        </Card>
      )}
    </AppShell>
  );
}
