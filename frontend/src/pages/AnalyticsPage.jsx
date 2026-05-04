import { useMemo, useState } from "react";
import { useSelector } from "react-redux";
import crmApi from "../api/crmApi";
import { AppShell } from "../components/layout/AppShell";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/common/EmptyState";
import { LoadingState } from "../components/common/LoadingState";
import { FunnelChartCard } from "../components/charts/FunnelChartCard";
import { RevenueLineChart } from "../components/charts/RevenueLineChart";
import { StatusBarChart } from "../components/charts/StatusBarChart";
import { formatCompactCurrency, formatDate, formatDateTime } from "../lib/formatters";
import { loadAppSettings, saveAppSettings } from "../lib/settings";

const WINDOW_OPTIONS = [
  { key: "1m", label: "1M", months: 1 },
  { key: "3m", label: "3M", months: 3 },
  { key: "6m", label: "6M", months: 6 },
  { key: "12m", label: "12M", months: 12 },
];

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date, months) {
  const includeYear = months > 6;
  return date.toLocaleDateString("en-US", {
    month: "short",
    ...(includeYear ? { year: "2-digit" } : {}),
  });
}

function buildMonthlyRevenueSeries(deals = [], months = 6) {
  const now = new Date();
  const endMonth = startOfMonth(now);
  const startMonth = new Date(endMonth.getFullYear(), endMonth.getMonth() - (months - 1), 1);

  const buckets = new Map();
  for (let index = 0; index < months; index += 1) {
    const date = new Date(startMonth.getFullYear(), startMonth.getMonth() + index, 1);
    buckets.set(monthKey(date), {
      period: monthLabel(date, months),
      revenue: 0,
    });
  }

  for (const deal of deals) {
    if (deal.status !== "won" || !deal.created_at) continue;
    const created = new Date(deal.created_at);
    if (Number.isNaN(created.getTime()) || created < startMonth) continue;

    const key = monthKey(startOfMonth(created));
    if (!buckets.has(key)) continue;

    buckets.get(key).revenue += Number(deal.value || 0);
  }

  return [...buckets.values()];
}

function buildLeadStatusData(leads = [], fallback = []) {
  if (!leads.length) {
    return (fallback || []).map((item) => ({
      label: item.label,
      value: Number(item.value || 0),
    }));
  }

  const statusOrder = ["new", "contacted", "qualified", "converted", "lost"];
  const counts = statusOrder.map((status) => ({
    label: status,
    value: leads.filter((lead) => String(lead.status || "") === status).length,
  }));

  return counts.filter((item) => item.value > 0);
}

function buildSalesPerformanceRows(deals = [], users = [], fallbackRows = []) {
  const userNameMap = new Map(users.map((user) => [String(user.id), user.full_name]));
  const rowsByOwner = new Map();

  for (const deal of deals) {
    const ownerId = deal.owner_id || deal.ownerId;
    if (!ownerId) continue;

    const key = String(ownerId);
    const current = rowsByOwner.get(key) || {
      id: key,
      repName:
        userNameMap.get(key) ||
        fallbackRows.find((row) => String(row.id) === key)?.repName ||
        "Unknown rep",
      totalDeals: 0,
      wonDeals: 0,
      revenue: 0,
      avgProbabilityAccumulator: 0,
    };

    current.totalDeals += 1;
    current.avgProbabilityAccumulator += Number(deal.probability || 0);

    if (deal.status === "won") {
      current.wonDeals += 1;
      current.revenue += Number(deal.value || 0);
    }

    rowsByOwner.set(key, current);
  }

  if (!rowsByOwner.size && fallbackRows.length) {
    return fallbackRows.map((row) => ({
      id: row.id,
      repName: row.repName,
      totalDeals: Number(row.totalDeals || 0),
      wonDeals: Number(row.totalDeals || 0),
      revenue: Number(row.revenue || 0),
      wonRate: Number(row.totalDeals || 0) > 0 ? 100 : 0,
      avgProbability: Number(row.avgProbability || 0),
    }));
  }

  return [...rowsByOwner.values()]
    .map((row) => ({
      id: row.id,
      repName: row.repName,
      totalDeals: row.totalDeals,
      wonDeals: row.wonDeals,
      revenue: row.revenue,
      wonRate: row.totalDeals > 0 ? Number(((row.wonDeals / row.totalDeals) * 100).toFixed(1)) : 0,
      avgProbability:
        row.totalDeals > 0
          ? Number((row.avgProbabilityAccumulator / row.totalDeals).toFixed(1))
          : 0,
    }))
    .sort((left, right) => right.revenue - left.revenue || right.wonRate - left.wonRate)
    .slice(0, 8);
}

function buildPipelineHealthRows(deals = []) {
  const openDeals = deals.filter((deal) => deal.status === "open");

  const stalled = openDeals.filter((deal) => {
    const baseline = deal.updated_at || deal.created_at;
    if (!baseline) return false;
    const ageDays = (Date.now() - new Date(baseline).getTime()) / (1000 * 60 * 60 * 24);
    return ageDays >= 14;
  }).length;

  const closingSoon = openDeals.filter((deal) => {
    if (!deal.expected_close_date) return false;
    const deltaMs = new Date(deal.expected_close_date).getTime() - Date.now();
    return deltaMs >= 0 && deltaMs <= 21 * 24 * 60 * 60 * 1000;
  }).length;

  const highProbability = openDeals.filter((deal) => Number(deal.probability || 0) >= 70).length;

  return [
    {
      label: "Open deals",
      value: openDeals.length,
      tone: "info",
      detail: "Deals actively in progress",
    },
    {
      label: "Stalled 14+ days",
      value: stalled,
      tone: stalled > 0 ? "warning" : "success",
      detail: "Needs qualification or re-engagement",
    },
    {
      label: "Closing in 21 days",
      value: closingSoon,
      tone: "info",
      detail: "Priority close planning window",
    },
    {
      label: "70%+ probability",
      value: highProbability,
      tone: "success",
      detail: "Likely near-term opportunities",
    },
  ];
}

function KpiCard({ label, value, detail }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-sm">
      <div className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{value}</div>
      <div className="mt-1 text-xs text-[var(--text-secondary)]">{detail}</div>
    </div>
  );
}

function SalesPerformanceTable({ rows = [] }) {
  return (
    <Card>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Sales performance</h3>
          <p className="text-sm text-[var(--text-secondary)]">
            Rep-level output across deal ownership, conversion quality, and won revenue.
          </p>
        </div>
        <Badge tone="info">Top reps</Badge>
      </div>

      {rows.length ? (
        <div className="overflow-hidden rounded-2xl border border-[var(--border)]">
          <div className="grid grid-cols-[1.3fr_0.7fr_0.8fr_0.9fr_0.8fr] bg-[var(--bg-base)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)]">
            <div>Rep</div>
            <div>Total deals</div>
            <div>Won rate</div>
            <div>Revenue</div>
            <div>Avg probability</div>
          </div>
          <div className="divide-y divide-[var(--border)]">
            {rows.map((row) => (
              <div
                key={row.id}
                className="grid grid-cols-[1.3fr_0.7fr_0.8fr_0.9fr_0.8fr] items-center px-4 py-3 text-sm"
              >
                <div className="font-medium text-[var(--text-primary)]">{row.repName}</div>
                <div className="text-[var(--text-secondary)]">{row.totalDeals}</div>
                <div>
                  <Badge tone={row.wonRate >= 35 ? "success" : row.wonRate >= 20 ? "info" : "warning"}>
                    {row.wonRate}%
                  </Badge>
                </div>
                <div className="font-semibold text-[var(--text-primary)]">
                  {formatCompactCurrency(row.revenue)}
                </div>
                <div className="text-[var(--text-secondary)]">{row.avgProbability}%</div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <EmptyState
          title="No performance records"
          description="Assign deals to owners to activate rep-level analytics."
        />
      )}
    </Card>
  );
}

function UpcomingClosuresCard({ deals = [] }) {
  return (
    <Card>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">Upcoming closures</h3>
        <Badge tone="warning">Next 5</Badge>
      </div>

      {deals.length ? (
        <div className="space-y-3">
          {deals.map((deal) => (
            <div key={deal.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3">
              <div className="text-sm font-semibold text-[var(--text-primary)]">{deal.title}</div>
              <div className="mt-1 text-xs text-[var(--text-secondary)]">{deal.account_name || "Unassigned account"}</div>
              <div className="mt-2 flex items-center justify-between text-xs text-[var(--text-secondary)]">
                <span>Close {formatDate(deal.expected_close_date)}</span>
                <span>{formatCompactCurrency(deal.value)}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No upcoming closures"
          description="Open deals with expected close dates appear here."
        />
      )}
    </Card>
  );
}

function RecentActivityCard({ activities = [] }) {
  return (
    <Card>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">Recent activity</h3>
        <Badge tone="info">Live feed</Badge>
      </div>

      {activities.length ? (
        <div className="space-y-3">
          {activities.map((activity) => (
            <div key={activity.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-semibold text-[var(--text-primary)]">{activity.subject}</div>
                <Badge tone="neutral">{activity.type}</Badge>
              </div>
              <div className="mt-1 text-xs text-[var(--text-secondary)]">
                {activity.user_name || "System"} · {formatDateTime(activity.created_at)}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <EmptyState
          title="No activity records"
          description="Recent calls, tasks, and updates appear here as your team works deals."
        />
      )}
    </Card>
  );
}

function LeadAgingCard({ rows = [] }) {
  const maxValue = Math.max(...rows.map((row) => Number(row.avgDaysOpen || 0)), 1);

  return (
    <Card>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">Lead aging</h3>
        <Badge tone="warning">By stage</Badge>
      </div>

      {rows.length ? (
        <div className="space-y-3">
          {rows.map((row) => {
            const width = Math.max(8, Math.round((Number(row.avgDaysOpen || 0) / maxValue) * 100));
            return (
              <div key={row.label}>
                <div className="mb-1 flex items-center justify-between text-xs text-[var(--text-secondary)]">
                  <span className="capitalize">{row.label}</span>
                  <span>{Number(row.avgDaysOpen || 0)} days</span>
                </div>
                <div className="h-2 rounded-full bg-[var(--surface)]">
                  <div
                    className="h-2 rounded-full bg-[var(--primary)]"
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          title="No aging metrics"
          description="Lead aging appears when active lead records are available."
        />
      )}
    </Card>
  );
}

export function AnalyticsPage() {
  const [windowKey, setWindowKey] = useState(() => loadAppSettings().analyticsWindow || "6m");
  const { dashboard, deals, leads, users, loading } = useSelector((state) => state.crm);

  const handleWindowChange = async (nextWindowKey) => {
    setWindowKey(nextWindowKey);

    const localSettings = loadAppSettings();
    const mergedSettings = saveAppSettings({
      ...localSettings,
      analyticsWindow: nextWindowKey,
    });

    try {
      const response = await crmApi.updateMySettings(mergedSettings);
      if (response?.data) {
        saveAppSettings(response.data);
      }
    } catch {
      // Keep local preference even if remote sync is unavailable.
    }
  };

  const selectedWindow =
    WINDOW_OPTIONS.find((item) => item.key === windowKey) || WINDOW_OPTIONS[2];

  const revenueSeries = useMemo(
    () => buildMonthlyRevenueSeries(deals, selectedWindow.months),
    [deals, selectedWindow.months]
  );

  const leadDistribution = useMemo(
    () => buildLeadStatusData(leads, dashboard?.charts?.leadStatusDistribution || []),
    [leads, dashboard?.charts?.leadStatusDistribution]
  );

  const dropoffData = useMemo(
    () => (dashboard?.charts?.dropoffAnalysis || []).map((item) => ({
      label: item.label,
      total: Number(item.total || 0),
    })),
    [dashboard?.charts?.dropoffAnalysis]
  );

  const salesRows = useMemo(
    () => buildSalesPerformanceRows(deals, users, dashboard?.salesPerformance || []),
    [deals, users, dashboard?.salesPerformance]
  );

  const healthRows = useMemo(() => buildPipelineHealthRows(deals), [deals]);

  if (loading && !dashboard) {
    return (
      <AppShell title="Analytics" subtitle="Loading your analytics command center">
        <LoadingState label="Loading analytics..." />
      </AppShell>
    );
  }

  if (!dashboard) {
    return (
      <AppShell
        title="Analytics"
        subtitle="Revenue intelligence, funnel quality, and rep performance in one command center"
      >
        <EmptyState
          title="No analytics available yet"
          description="As leads and deals move through the CRM, this workspace will auto-populate."
        />
      </AppShell>
    );
  }

  const kpis = dashboard.kpis || {};
  const alerts = dashboard.alerts || [];
  const insights = dashboard.insights || [];
  const upcomingClosures = dashboard.upcomingClosures || [];
  const recentActivity = dashboard.recentActivity || [];
  const leadAging = dashboard.charts?.leadAging || [];

  return (
    <AppShell
      title="Analytics"
      subtitle="Revenue intelligence, funnel quality, and rep performance in one command center"
    >
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)]">Analytics</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Monitor pipeline performance, conversion pressure, and team execution from a single surface.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {WINDOW_OPTIONS.map((option) => (
            <Button
              key={option.key}
              variant={windowKey === option.key ? "primary" : "secondary"}
              onClick={() => handleWindowChange(option.key)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Won Revenue"
          value={formatCompactCurrency(kpis.revenue)}
          detail="Total closed-won revenue"
        />
        <KpiCard
          label="Lead Conversion"
          value={`${Number(kpis.conversionRate || 0).toFixed(1)}%`}
          detail="Leads converted into customers"
        />
        <KpiCard
          label="Win Rate"
          value={`${Number(kpis.winRate || 0).toFixed(1)}%`}
          detail="Won deals out of total deals"
        />
        <KpiCard
          label="Avg Won Deal"
          value={formatCompactCurrency(kpis.avgWonDealSize)}
          detail={`${Number(kpis.wonDeals || 0)} won deals so far`}
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <RevenueLineChart data={revenueSeries} />

        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">Pipeline health</h3>
            <Badge tone="info">Live</Badge>
          </div>

          <div className="space-y-3">
            {healthRows.map((row) => (
              <div key={row.label} className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3">
                <div className="mb-1 flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-[var(--text-primary)]">{row.label}</div>
                  <Badge tone={row.tone}>{row.value}</Badge>
                </div>
                <div className="text-xs text-[var(--text-secondary)]">{row.detail}</div>
              </div>
            ))}
          </div>

          <div className="mt-5 border-t border-[var(--border)] pt-4">
            <div className="mb-2 text-xs uppercase tracking-[0.16em] text-[var(--text-secondary)]">
              Priority alerts
            </div>
            {alerts.length ? (
              <div className="space-y-2">
                {alerts.map((alert) => (
                  <div key={alert.title} className="rounded-lg border border-[var(--border)] bg-[var(--bg-base)] p-3">
                    <div className="text-sm font-semibold text-[var(--text-primary)]">{alert.title}</div>
                    <div className="mt-1 text-xs text-[var(--text-secondary)]">{alert.description}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-sm text-[var(--text-secondary)]">No active alerts right now.</div>
            )}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <StatusBarChart data={leadDistribution} />
        <FunnelChartCard data={dropoffData} />
      </div>

      <div className="mt-6">
        <SalesPerformanceTable rows={salesRows} />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <UpcomingClosuresCard deals={upcomingClosures} />
        <LeadAgingCard rows={leadAging} />
        <RecentActivityCard activities={recentActivity} />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        {insights.length ? (
          insights.map((insight) => (
            <Card key={insight.title} className="border-[var(--border)] bg-[var(--bg-card)]">
              <div className="text-xs uppercase tracking-[0.16em] text-[var(--text-secondary)]">Insight</div>
              <h4 className="mt-2 text-lg font-semibold text-[var(--text-primary)]">{insight.title}</h4>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">{insight.description}</p>
            </Card>
          ))
        ) : (
          <Card className="xl:col-span-3">
            <EmptyState
              title="No strategic insights yet"
              description="Insights will appear here as activity and outcomes grow across your pipeline."
            />
          </Card>
        )}
      </div>
    </AppShell>
  );
}
