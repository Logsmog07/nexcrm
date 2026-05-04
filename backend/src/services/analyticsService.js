const ApiError = require("../utils/ApiError");
const analyticsRepository = require("../repositories/analyticsRepository");
const notificationRepository = require("../repositories/notificationRepository");
const userRepository = require("../repositories/userRepository");
const { buildScopeForUser, isPlatformAdmin } = require("../utils/access");

const formatCurrency = (value) =>
  Number(value || 0).toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });

const buildRevenueSummary = (revenueTrend) => {
  if (!revenueTrend.length) {
    return {
      current: 0,
      previous: 0,
      delta: 0,
      direction: "flat",
    };
  }

  const current = Number(revenueTrend[revenueTrend.length - 1]?.revenue || 0);
  const previous = Number(revenueTrend[revenueTrend.length - 2]?.revenue || 0);
  const delta = previous === 0 ? current : ((current - previous) / previous) * 100;

  return {
    current,
    previous,
    delta: Number(delta.toFixed(1)),
    direction: delta > 0 ? "up" : delta < 0 ? "down" : "flat",
  };
};

const buildPriorityAlerts = ({ kpis, pendingReminders, leadAging, dropoffAnalysis }) => {
  const alerts = [];

  if (Number(kpis.conversion_rate || 0) < 20) {
    alerts.push({
      tone: "warning",
      title: "Conversion is lagging",
      description:
        "Lead conversion is below 20%. Tighten qualification standards and speed up qualified follow-up.",
    });
  }

  if (pendingReminders.length > 3) {
    alerts.push({
      tone: "danger",
      title: "Reminder backlog detected",
      description: `${pendingReminders.length} reminders are overdue or due now. Reassign or clear stalled tasks.`,
    });
  }

  const oldestLeadBucket = leadAging[0];
  if (oldestLeadBucket && Number(oldestLeadBucket.avg_days_open || 0) > 14) {
    alerts.push({
      tone: "warning",
      title: "Aging leads need attention",
      description: `${oldestLeadBucket.label} leads average ${oldestLeadBucket.avg_days_open} days open.`,
    });
  }

  const biggestCluster = [...dropoffAnalysis].sort(
    (a, b) => Number(b.total || 0) - Number(a.total || 0)
  )[0];

  if (biggestCluster) {
    alerts.push({
      tone: "info",
      title: "Pipeline concentration",
      description: `${biggestCluster.label} holds ${biggestCluster.total} deals worth ${formatCurrency(
        biggestCluster.pipeline_value
      )}.`,
    });
  }

  return alerts.slice(0, 4);
};

const buildDashboardForScope = async (scope, user) => {
  const [
    kpis,
    revenueTrend,
    leadStatusDistribution,
    salesPerformance,
    dropoffAnalysis,
    recentActivity,
    pendingReminders,
    leadAging,
    upcomingClosures,
  ] = await Promise.all([
    analyticsRepository.getKpis(scope),
    analyticsRepository.getRevenueTrend(scope),
    analyticsRepository.getLeadStatusDistribution(scope),
    analyticsRepository.getSalesPerformance(scope),
    analyticsRepository.getDropoffAnalysis(scope),
    analyticsRepository.getRecentActivity(scope),
    scope.ownerId && user
      ? notificationRepository.listForUser(user.id)
      : notificationRepository.listPendingReminders({
          companyId: scope.companyId,
          userIds: scope.ownerIds,
        }),
    analyticsRepository.getLeadAging(scope),
    analyticsRepository.getUpcomingClosures(scope),
  ]);

  const revenueSummary = buildRevenueSummary(revenueTrend);
  const conversionRate = Number(kpis.conversion_rate || 0);
  const wonDeals = Number(kpis.won_deals || 0);
  const totalDeals = Number(kpis.total_deals || 0);
  const winRate = totalDeals === 0 ? 0 : Number(((wonDeals / totalDeals) * 100).toFixed(1));

  return {
    kpis: {
      revenue: Number(kpis.revenue || 0),
      openDeals: Number(kpis.open_deals || 0),
      activeLeads: Number(kpis.active_leads || 0),
      totalLeads: Number(kpis.total_leads || 0),
      totalCustomers: Number(kpis.total_customers || 0),
      qualifiedLeads: Number(kpis.qualified_leads || 0),
      wonDeals,
      avgWonDealSize: Number(kpis.avg_won_deal_size || 0),
      conversionRate,
      winRate,
    },
    summaries: {
      revenue: revenueSummary,
      pipelineCoverage:
        Number(kpis.open_deals || 0) > 0
          ? Number(
              (
                Number(kpis.active_leads || 0) /
                Number(kpis.open_deals || 1)
              ).toFixed(1)
            )
          : 0,
    },
    charts: {
      revenueTrend: revenueTrend.map((item) => ({
        period: item.period,
        revenue: Number(item.revenue || 0),
      })),
      leadStatusDistribution: leadStatusDistribution.map((item) => ({
        label: item.label,
        value: Number(item.value || 0),
      })),
      dropoffAnalysis: dropoffAnalysis.map((item) => ({
        label: item.label,
        total: Number(item.total || 0),
        pipelineValue: Number(item.pipeline_value || 0),
      })),
      leadAging: leadAging.map((item) => ({
        label: item.label,
        avgDaysOpen: Number(item.avg_days_open || 0),
      })),
    },
    salesPerformance: salesPerformance.map((item) => ({
      id: item.id,
      repName: item.rep_name,
      totalDeals: Number(item.total_deals || 0),
      revenue: Number(item.revenue || 0),
      avgProbability: Number(item.avg_probability || 0),
    })),
    scope: {
      companyId: scope.companyId || null,
      ownerId: scope.ownerId || null,
      ownerIds: scope.ownerIds || [],
    },
    recentActivity,
    upcomingClosures: upcomingClosures.map((deal) => ({
      ...deal,
      value: Number(deal.value || 0),
      probability: Number(deal.probability || 0),
    })),
    alerts: buildPriorityAlerts({
      kpis,
      pendingReminders,
      leadAging,
      dropoffAnalysis,
    }),
    insights: [
      {
        title: "Pipeline focus",
        description:
          conversionRate < 20
            ? "Conversion rate is under 20%. Prioritize qualified follow-ups and lead scoring hygiene."
            : "Conversion rate is healthy. Focus on increasing deal size in later stages.",
      },
      {
        title: "Reminder pressure",
        description:
          pendingReminders.length > 5
            ? "There are several overdue reminders. A manager review could unblock stalled outreach."
            : "Reminder load looks manageable across the team.",
      },
      {
        title: "Win-rate signal",
        description:
          winRate < 25
            ? "Won-deal rate is soft relative to overall deal volume. Review proposal quality and late-stage qualification."
            : "Win-rate is healthy. Push for larger multi-stakeholder deals to grow average contract value.",
      },
    ],
  };
};

const getDashboardAnalytics = async (user) => {
  const scope = await buildScopeForUser(user, userRepository);
  return buildDashboardForScope(scope, user);
};

const getCompanyDashboardAnalytics = async (companyId, user) => {
  if (!isPlatformAdmin(user)) {
    throw new ApiError(403, "Only platform admins can inspect company dashboards directly");
  }

  return buildDashboardForScope({ companyId }, null);
};

module.exports = {
  getDashboardAnalytics,
  getCompanyDashboardAnalytics,
};
