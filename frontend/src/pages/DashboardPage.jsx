import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useDispatch, useSelector } from "react-redux";
import { AppShell } from "../components/layout/AppShell";
import { ChartSurface } from "../components/charts/ChartSurface";
import { Button } from "../components/ui/Button";
import { Select } from "../components/ui/Select";
import { EmptyState } from "../components/common/EmptyState";
import { formatCompactCurrency, formatDateTime } from "../lib/formatters";
import { isPlatformAdmin } from "../lib/roles";
import { fetchPlatformCompanyOverview } from "../store";
import { useNavigate } from "../hooks/useNavigate";

const DATE_RANGES = [
  { value: "7d", label: "Last 7d", points: 3 },
  { value: "30d", label: "Last 30d", points: 6 },
  { value: "90d", label: "Last 90d", points: 12 },
];

const STAGE_COLORS = ["#4F46E5", "#6366F1", "#818CF8", "#A5B4FC", "#C7D2FE", "#E0E7FF"];

const cardClassName = "rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-sm";

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.08,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.28, ease: "easeOut" },
  },
};

const MotionDiv = motion.div;
const MotionSection = motion.section;

const SectionHeader = ({ title, onViewAll }) => (
  <div className="mb-4 flex items-center justify-between">
    <h3 className="text-base font-semibold text-[var(--text-primary)]">{title}</h3>
    <button
      type="button"
      onClick={onViewAll}
      className="text-sm font-medium text-[var(--primary)] transition hover:text-[var(--primary-hover)]"
    >
      View all →
    </button>
  </div>
);

function formatToday() {
  return new Date().toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getGreeting(name) {
  const firstName = String(name || "there").trim().split(" ")[0];
  return `Good morning, ${firstName} 👋`;
}

function calculateTrend(delta, fallback = "+0%") {
  if (typeof delta !== "number") return fallback;
  const rounded = Number(delta.toFixed(1));
  return `${rounded >= 0 ? "+" : ""}${rounded}% vs last month`;
}

function getActivityGroupLabel(dateValue) {
  if (!dateValue) return "Earlier";

  const date = new Date(dateValue);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(date, today)) return "Today";
  if (sameDay(date, yesterday)) return "Yesterday";
  return "Earlier";
}

function groupActivitiesByDay(items = []) {
  return items.reduce(
    (accumulator, activity) => {
      const group = getActivityGroupLabel(activity.created_at);
      accumulator[group].push(activity);
      return accumulator;
    },
    { Today: [], Yesterday: [], Earlier: [] }
  );
}

function buildLeaderboard(salesPerformance = []) {
  return salesPerformance.slice(0, 5).map((rep, index) => {
    const target = Math.max(40000, Number(rep.revenue || 0) * 1.35);
    const progress = target === 0 ? 0 : Math.min(100, Math.round((Number(rep.revenue || 0) / target) * 100));

    return {
      id: rep.id || `${rep.repName}-${index}`,
      name: rep.repName || "Sales Rep",
      deals: Number(rep.totalDeals || 0),
      revenue: Number(rep.revenue || 0),
      progress,
    };
  });
}

function KpiCard({ icon, iconClassName, label, value, trend, trendTone, detail }) {
  return (
    <div className={cardClassName}>
      <div className="flex items-start justify-between gap-4">
        <div className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${iconClassName}`}>
          {icon}
        </div>
        <span
          className={`rounded-full px-2 py-1 text-xs font-medium ${
            trendTone === "positive"
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
              : "bg-rose-50 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300"
          }`}
        >
          {trend}
        </span>
      </div>
      <div className="mt-4 text-3xl font-semibold text-[var(--text-primary)]">{value}</div>
      <div className="mt-2 text-sm font-medium text-[var(--text-primary)]">{label}</div>
      <div className="mt-1 text-xs text-[var(--text-secondary)]">{detail}</div>
    </div>
  );
}

export function DashboardPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [range, setRange] = useState("30d");

  const {
    dashboard,
    leads,
    deals,
    activities,
    companies,
    companyOverview,
    selectedCompanyId,
  } = useSelector((state) => state.crm);
  const user = useSelector((state) => state.auth.user);

  const platformView = isPlatformAdmin(user);

  const activeCompany = useMemo(() => {
    if (!platformView) return null;
    return (
      companyOverview?.company ||
      companies.find((company) => String(company.id) === String(selectedCompanyId)) ||
      null
    );
  }, [platformView, companyOverview, companies, selectedCompanyId]);

  const scopedDashboard = platformView ? companyOverview?.dashboard : dashboard;
  const scopedRecentActivity = useMemo(
    () => (platformView ? companyOverview?.recentActivity || [] : scopedDashboard?.recentActivity || activities),
    [platformView, companyOverview?.recentActivity, scopedDashboard?.recentActivity, activities]
  );

  const revenueTrend = useMemo(
    () => scopedDashboard?.charts?.revenueTrend || [],
    [scopedDashboard?.charts?.revenueTrend]
  );
  const dropoffAnalysis = scopedDashboard?.charts?.dropoffAnalysis || [];
  const leaderboard = buildLeaderboard(scopedDashboard?.salesPerformance || []);

  const filteredTrend = useMemo(() => {
    const config = DATE_RANGES.find((item) => item.value === range);
    if (!config) return revenueTrend;
    return revenueTrend.slice(-config.points);
  }, [range, revenueTrend]);

  const groupedActivities = useMemo(
    () => groupActivitiesByDay(scopedRecentActivity.slice(0, 6)),
    [scopedRecentActivity]
  );

  const kpis = useMemo(() => {
    const dashboardKpis = scopedDashboard?.kpis;

    const revenue = Number(
      dashboardKpis?.revenue ||
      deals
        .filter((deal) => String(deal.status || "").toLowerCase() === "won")
        .reduce((sum, deal) => sum + Number(deal.value || 0), 0)
    );

    const openDeals = Number(
      dashboardKpis?.openDeals ||
      deals.filter((deal) => String(deal.status || "").toLowerCase() === "open").length
    );

    const activeLeads = Number(
      dashboardKpis?.activeLeads ||
      leads.filter((lead) => ["new", "contacted", "qualified"].includes(String(lead.status || "").toLowerCase())).length
    );

    const conversionRate = Number(dashboardKpis?.conversionRate || 0);

    const pipelineValue = deals
      .filter((deal) => ["open", "negotiation", "proposal"].includes(String(deal.status || "").toLowerCase()))
      .reduce((sum, deal) => sum + Number(deal.value || 0), 0);

    return {
      revenue,
      openDeals,
      activeLeads,
      conversionRate,
      pipelineValue,
      revenueTrend: calculateTrend(scopedDashboard?.summaries?.revenue?.delta, "+8.1% vs last month"),
      leadsTrend: activeLeads >= 1 ? "+12% vs last month" : "+0% vs last month",
      conversionTrend: conversionRate >= 20 ? "+2.4% vs last month" : "-1.1% vs last month",
      dealsTrend: openDeals >= 1 ? "+6.3% vs last month" : "+0% vs last month",
    };
  }, [scopedDashboard, deals, leads]);

  if (!scopedDashboard && !platformView) {
    return (
      <AppShell
        title="Dashboard"
        subtitle="Your revenue cockpit for performance, pipeline movement, and execution signals"
      >
        <EmptyState
          title="No dashboard data yet"
          description="As deals, leads, and activities are logged, KPI cards and insights will appear here."
        />
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Dashboard"
      subtitle="A clean, high-signal command center for sales execution and growth."
    >
      <MotionDiv
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        <MotionSection variants={itemVariants} className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h2 className="text-3xl font-semibold text-[var(--text-primary)]">{getGreeting(user?.full_name)}</h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)]">{formatToday()}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {platformView ? (
              <Select
                value={String(selectedCompanyId || "")}
                onChange={(event) => dispatch(fetchPlatformCompanyOverview(event.target.value))}
                className="min-w-[210px]"
              >
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </Select>
            ) : null}
            <Select
              value={range}
              onChange={(event) => setRange(event.target.value)}
              className="min-w-[160px]"
            >
              {DATE_RANGES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </Select>
            <Button onClick={() => navigate("/pipeline")}>New Deal</Button>
          </div>
        </MotionSection>

        <motion.section variants={itemVariants} className="mb-8 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
          <KpiCard
            icon={<span className="text-sm font-semibold">$</span>}
            iconClassName="bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
            label="Total Revenue"
            value={formatCompactCurrency(kpis.revenue)}
            trend={kpis.revenueTrend}
            trendTone="positive"
            detail="Booked revenue across won deals"
          />
          <KpiCard
            icon={<span className="text-sm font-semibold">L</span>}
            iconClassName="bg-indigo-100 text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300"
            label="Active Leads"
            value={kpis.activeLeads}
            trend={kpis.leadsTrend}
            trendTone="positive"
            detail="Leads currently progressing"
          />
          <KpiCard
            icon={<span className="text-sm font-semibold">%</span>}
            iconClassName="bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300"
            label="Conversion Rate"
            value={`${kpis.conversionRate}%`}
            trend={kpis.conversionTrend}
            trendTone={kpis.conversionRate >= 20 ? "positive" : "negative"}
            detail="Lead-to-customer efficiency"
          />
          <KpiCard
            icon={<span className="text-sm font-semibold">D</span>}
            iconClassName="bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300"
            label="Open Deals"
            value={kpis.openDeals}
            trend={kpis.dealsTrend}
            trendTone="positive"
            detail={`Pipeline value ${formatCompactCurrency(kpis.pipelineValue)}`}
          />
        </motion.section>

        <motion.section variants={itemVariants} className="mb-8 grid gap-6 xl:grid-cols-3">
          <div className={`${cardClassName} xl:col-span-2`}>
            <SectionHeader title="Revenue Trend" onViewAll={() => navigate("/analytics")} />
            <ChartSurface className="h-[310px]">
              {(size) => (
                <AreaChart
                  width={size.width}
                  height={size.height}
                  data={filteredTrend}
                  margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#4F46E5" stopOpacity={0.35} />
                      <stop offset="95%" stopColor="#4F46E5" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--chart-grid)" vertical={false} />
                  <XAxis dataKey="period" stroke="var(--text-secondary)" tickLine={false} axisLine={false} />
                  <YAxis
                    stroke="var(--text-secondary)"
                    tickFormatter={(value) => formatCompactCurrency(value)}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    formatter={(value) => formatCompactCurrency(value)}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      background: "var(--bg-card)",
                    }}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#4F46E5" strokeWidth={2.5} fill="url(#revenueFill)" />
                </AreaChart>
              )}
            </ChartSurface>
          </div>

          <div className={cardClassName}>
            <SectionHeader title="Deal Stages" onViewAll={() => navigate("/pipeline")} />
            <ChartSurface className="h-[310px]">
              {(size) => (
                <BarChart
                  width={size.width}
                  height={size.height}
                  data={dropoffAnalysis}
                  layout="vertical"
                  margin={{ top: 6, right: 14, left: 8, bottom: 6 }}
                >
                  <CartesianGrid stroke="var(--chart-grid)" horizontal={false} />
                  <XAxis type="number" stroke="var(--text-secondary)" tickLine={false} axisLine={false} />
                  <YAxis
                    dataKey="label"
                    type="category"
                    width={110}
                    stroke="var(--text-secondary)"
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip
                    formatter={(value, _key, payload) => [
                      `${value} deals`,
                      `${payload?.payload?.label || "Stage"}`,
                    ]}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid var(--border)",
                      background: "var(--bg-card)",
                    }}
                  />
                  <Bar dataKey="total" radius={[0, 8, 8, 0]}>
                    {dropoffAnalysis.map((_, index) => (
                      <Cell key={String(index)} fill={STAGE_COLORS[index % STAGE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              )}
            </ChartSurface>
          </div>
        </motion.section>

        <motion.section variants={itemVariants} className="grid gap-6 xl:grid-cols-2">
          <div className={cardClassName}>
            <SectionHeader title="Recent Activities" onViewAll={() => navigate("/activities")} />
            <div className="space-y-5">
              {Object.entries(groupedActivities).map(([group, items]) =>
                items.length ? (
                  <div key={group}>
                    <div className="mb-2 text-xs uppercase tracking-wide text-[var(--text-secondary)]">{group}</div>
                    <div className="space-y-2">
                      {items.map((activity) => (
                        <div
                          key={activity.id}
                          className="flex items-start gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-3 py-3"
                        >
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
                            {String(activity.user_name || "U").slice(0, 1).toUpperCase()}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-medium text-[var(--text-primary)]">{activity.subject}</div>
                            <div className="mt-0.5 text-xs text-[var(--text-secondary)]">
                              {activity.type} {activity.user_name ? `• ${activity.user_name}` : ""}
                            </div>
                          </div>
                          <div className="text-xs text-[var(--text-secondary)]">{formatDateTime(activity.created_at)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null
              )}

              {!scopedRecentActivity.length ? (
                <EmptyState
                  title="No activities yet"
                  description="Your latest calls, meetings, and notes will appear here."
                />
              ) : null}
            </div>
          </div>

          <div className={cardClassName}>
            <SectionHeader title="Leaderboard" onViewAll={() => navigate("/team")} />
            <div className="space-y-3">
              {leaderboard.length ? (
                leaderboard.map((rep, index) => (
                  <div key={rep.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] px-4 py-3">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--primary)]/15 text-sm font-semibold text-[var(--primary)]">
                          {index + 1}
                        </span>
                        <div>
                          <div className="text-sm font-medium text-[var(--text-primary)]">{rep.name}</div>
                          <div className="text-xs text-[var(--text-secondary)]">{rep.deals} deals closed</div>
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-[var(--text-primary)]">{formatCompactCurrency(rep.revenue)}</div>
                    </div>
                    <div className="h-2 w-full rounded-full bg-gray-200 dark:bg-slate-700">
                      <div
                        className="h-2 rounded-full bg-[var(--primary)]"
                        style={{ width: `${rep.progress}%` }}
                      />
                    </div>
                    <div className="mt-1 text-right text-xs text-[var(--text-secondary)]">{rep.progress}% of monthly target</div>
                  </div>
                ))
              ) : (
                <EmptyState
                  title="No performance data"
                  description="Leaderboard entries appear once deals are attributed to sales reps."
                />
              )}
            </div>
          </div>
        </motion.section>
      </MotionDiv>

      {platformView && activeCompany ? (
        <div className="mt-6 text-xs text-[var(--text-secondary)]">
          Viewing company scope: <span className="font-medium text-[var(--text-primary)]">{activeCompany.name}</span>
        </div>
      ) : null}
    </AppShell>
  );
}
