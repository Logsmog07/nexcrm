import { useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import crmApi from "../api/crmApi";
import { AppShell } from "../components/layout/AppShell";
import { ErrorBanner } from "../components/common/ErrorBanner";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { EmptyState } from "../components/common/EmptyState";
import { LoadingState } from "../components/common/LoadingState";
import { RevenueLineChart } from "../components/charts/RevenueLineChart";
import { StatusBarChart } from "../components/charts/StatusBarChart";
import { formatCompactCurrency, formatDateTime } from "../lib/formatters";
import { buildForecastSummary, getForecastBucket } from "../lib/forecasting";
import { scoreDealSlipRisk } from "../lib/predictive";
import { loadAppSettings } from "../lib/settings";
import { fetchDashboardData } from "../store";

const stageOrder = ["discovery", "proposal", "negotiation", "won", "lost"];

const stageLabels = {
  discovery: "Discovery",
  proposal: "Proposal",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
};

const toneByStage = {
  discovery: "info",
  proposal: "warning",
  negotiation: "warning",
  won: "success",
  lost: "danger",
};

const toneByDealStatus = {
  open: "warning",
  won: "success",
  lost: "danger",
};

const toneByBenchmarkTier = {
  champion: "success",
  steady: "info",
  needs_support: "warning",
};

const toneByApprovalStatus = {
  approved: "success",
  pending: "warning",
};

const toneByEscalationStatus = {
  new: "warning",
  acknowledged: "info",
  closed: "success",
};

const toneByAgingBand = {
  fresh: "success",
  aging: "warning",
  critical: "danger",
};

const toneByPreventionStatus = {
  pending: "warning",
  active: "info",
  completed: "success",
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function getBenchmarkTier(score) {
  if (score >= 80) {
    return "champion";
  }
  if (score >= 55) {
    return "steady";
  }
  return "needs_support";
}

function getCoachingRecommendation(row, teamAvgCompletion) {
  if (row.overdue >= 2) {
    return "Clear overdue recovery queue first, then commit to same-day task updates.";
  }

  if (row.completionRate + 10 < teamAvgCompletion) {
    return "Run a daily 15-minute scenario task triage until completion rate stabilizes.";
  }

  if (row.completed >= 2 && row.wonDeals === 0) {
    return "Pair with a top performer to improve close-plan quality on influenced opportunities.";
  }

  if (row.wonDeals >= 2 || row.wonRevenue > 0) {
    return "Document winning scenario playbook and mentor one teammate this cycle.";
  }

  return "Maintain cadence and focus on converting open influenced deals this week.";
}

function parseCoachingApprovalMetadata(notes = "") {
  const text = String(notes || "");
  const approvedByMatch = text.match(/approved_by=([^;]+)/i);
  const approvedAtMatch = text.match(/approved_at=([^;]+)/i);

  return {
    approvedBy: approvedByMatch?.[1]?.trim() || "",
    approvedAt: approvedAtMatch?.[1]?.trim() || "",
  };
}

function getEscalationAgingBand(hoursOpen) {
  if (hoursOpen >= 72) {
    return "critical";
  }
  if (hoursOpen >= 24) {
    return "aging";
  }
  return "fresh";
}

function startOfWeek(date) {
  const value = new Date(date);
  if (Number.isNaN(value.getTime())) {
    return null;
  }

  const day = value.getDay();
  const diff = (day + 6) % 7;
  value.setHours(0, 0, 0, 0);
  value.setDate(value.getDate() - diff);
  return value;
}

function weekKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function monthKey(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(date) {
  return date.toLocaleDateString("en-US", {
    month: "short",
    year: "2-digit",
  });
}

function buildRevenueSeries(deals = [], months = 6) {
  const now = new Date();
  const endMonth = startOfMonth(now);
  const startMonth = new Date(endMonth.getFullYear(), endMonth.getMonth() - (months - 1), 1);

  const buckets = new Map();
  for (let index = 0; index < months; index += 1) {
    const date = new Date(startMonth.getFullYear(), startMonth.getMonth() + index, 1);
    buckets.set(monthKey(date), {
      period: monthLabel(date),
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

function buildLeadDistribution(leads = []) {
  const statusOrder = ["new", "contacted", "qualified", "converted", "lost"];
  return statusOrder.map((status) => ({
    label: status,
    value: leads.filter((lead) => String(lead.status || "") === status).length,
  }));
}

function buildStageRows(deals = []) {
  return stageOrder.map((stage) => {
    const stageDeals = deals.filter((deal) => String(deal.stage || "") === stage);
    const totalValue = stageDeals.reduce((sum, deal) => sum + Number(deal.value || 0), 0);

    return {
      stage,
      count: stageDeals.length,
      totalValue,
      avgProbability: stageDeals.length
        ? Number(
            (
              stageDeals.reduce((sum, deal) => sum + Number(deal.probability || 0), 0) /
              stageDeals.length
            ).toFixed(1)
          )
        : 0,
    };
  });
}

function buildOwnerRows(deals = [], users = []) {
  const userNameMap = new Map(users.map((user) => [String(user.id), user.full_name]));
  const map = new Map();

  for (const deal of deals) {
    const ownerId = deal.owner_id || deal.ownerId;
    if (!ownerId) continue;

    const key = String(ownerId);
    const current = map.get(key) || {
      ownerId: key,
      ownerName: userNameMap.get(key) || deal.owner_name || "Unknown",
      deals: 0,
      wonDeals: 0,
      revenue: 0,
    };

    current.deals += 1;
    if (deal.status === "won") {
      current.wonDeals += 1;
      current.revenue += Number(deal.value || 0);
    }

    map.set(key, current);
  }

  return [...map.values()]
    .map((row) => ({
      ...row,
      winRate: row.deals > 0 ? Number(((row.wonDeals / row.deals) * 100).toFixed(1)) : 0,
    }))
    .sort((left, right) => right.revenue - left.revenue || right.winRate - left.winRate)
    .slice(0, 10);
}

function buildManagerWeeklyDigestRows(deals = [], users = [], weekStartDate = new Date()) {
  const userNameMap = new Map(users.map((user) => [String(user.id), user.full_name]));
  const digestMap = new Map();

  for (const deal of deals) {
    const ownerId = deal.owner_id || deal.ownerId;
    if (!ownerId) {
      continue;
    }

    const key = String(ownerId);
    const row = digestMap.get(key) || {
      ownerId: key,
      ownerName: userNameMap.get(key) || deal.owner_name || "Unknown",
      openDeals: 0,
      openValue: 0,
      commitDeals: 0,
      bestCaseDeals: 0,
      wonThisWeek: 0,
      wonRevenueThisWeek: 0,
    };

    if (deal.status === "open") {
      row.openDeals += 1;
      row.openValue += Number(deal.value || 0);

      const bucket = getForecastBucket(deal);
      if (bucket === "commit") {
        row.commitDeals += 1;
      } else if (bucket === "best_case") {
        row.bestCaseDeals += 1;
      }
    }

    const referenceDate = new Date(deal.updated_at || deal.created_at || 0);
    if (deal.status === "won" && referenceDate >= weekStartDate) {
      row.wonThisWeek += 1;
      row.wonRevenueThisWeek += Number(deal.value || 0);
    }

    digestMap.set(key, row);
  }

  return [...digestMap.values()].sort(
    (left, right) =>
      right.wonRevenueThisWeek - left.wonRevenueThisWeek || right.openValue - left.openValue
  );
}

function rowsToCsv(rows = [], columns = []) {
  const escape = (value) => {
    const raw = value === null || value === undefined ? "" : String(value);
    if (/[",\n]/.test(raw)) {
      return `"${raw.replace(/"/g, '""')}"`;
    }
    return raw;
  };

  const header = columns.map((column) => escape(column.header)).join(",");
  const lines = rows.map((row) =>
    columns.map((column) => escape(column.render(row))).join(",")
  );

  return [header, ...lines].join("\n");
}

function downloadCsv(filename, csvText) {
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
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

export function ReportsPage() {
  const dispatch = useDispatch();
  const currentUser = useSelector((state) => state.auth.user);
  const { dashboard, deals, leads, customers, users, activities, loading } = useSelector(
    (state) => state.crm
  );
  const settings = loadAppSettings();
  const managerWeeklyDigest = Boolean(settings.managerWeeklyDigest);
  const [lastExportAt, setLastExportAt] = useState("");
  const [scenarioCloseLift, setScenarioCloseLift] = useState("8");
  const [scenarioRiskRecovery, setScenarioRiskRecovery] = useState("20");
  const [scenarioPipelineAdd, setScenarioPipelineAdd] = useState("25000");
  const [scenarioActivationNotice, setScenarioActivationNotice] = useState("");
  const [scenarioActivationError, setScenarioActivationError] = useState("");
  const [scenarioActivationCount, setScenarioActivationCount] = useState(0);
  const [scenarioActivationAt, setScenarioActivationAt] = useState("");
  const [activatingScenario, setActivatingScenario] = useState(false);
  const [coachingActivationNotice, setCoachingActivationNotice] = useState("");
  const [coachingActivationError, setCoachingActivationError] = useState("");
  const [coachingActivationCount, setCoachingActivationCount] = useState(0);
  const [coachingActivationAt, setCoachingActivationAt] = useState("");
  const [activatingCoaching, setActivatingCoaching] = useState(false);
  const [approvalNotice, setApprovalNotice] = useState("");
  const [approvalError, setApprovalError] = useState("");
  const [approvalCount, setApprovalCount] = useState(0);
  const [approvalAt, setApprovalAt] = useState("");
  const [approvingCoaching, setApprovingCoaching] = useState(false);
  const [selectedApprovalOwners, setSelectedApprovalOwners] = useState([]);
  const [escalationNotice, setEscalationNotice] = useState("");
  const [escalationError, setEscalationError] = useState("");
  const [escalationCount, setEscalationCount] = useState(0);
  const [escalationAt, setEscalationAt] = useState("");
  const [escalatingCoaching, setEscalatingCoaching] = useState(false);
  const [escalationResolutionNotice, setEscalationResolutionNotice] = useState("");
  const [escalationResolutionError, setEscalationResolutionError] = useState("");
  const [escalationResolutionCount, setEscalationResolutionCount] = useState(0);
  const [escalationResolutionAt, setEscalationResolutionAt] = useState("");
  const [acknowledgingEscalationId, setAcknowledgingEscalationId] = useState(null);
  const [closingEscalationId, setClosingEscalationId] = useState(null);
  const [preventionNotice, setPreventionNotice] = useState("");
  const [preventionError, setPreventionError] = useState("");
  const [preventionCount, setPreventionCount] = useState(0);
  const [preventionAt, setPreventionAt] = useState("");
  const [activatingPrevention, setActivatingPrevention] = useState(false);
  const [controlTowerNotice, setControlTowerNotice] = useState("");
  const [controlTowerError, setControlTowerError] = useState("");
  const [controlTowerCount, setControlTowerCount] = useState(0);
  const [controlTowerAt, setControlTowerAt] = useState("");
  const [activatingControlTower, setActivatingControlTower] = useState(false);

  const revenueSeries = useMemo(() => buildRevenueSeries(deals, 6), [deals]);
  const leadDistribution = useMemo(() => buildLeadDistribution(leads), [leads]);
  const stageRows = useMemo(() => buildStageRows(deals), [deals]);
  const ownerRows = useMemo(() => buildOwnerRows(deals, users), [deals, users]);
  const forecastRows = useMemo(() => buildForecastSummary(deals), [deals]);
  const weekStartDate = useMemo(() => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), []);
  const managerDigestRows = useMemo(
    () => buildManagerWeeklyDigestRows(deals, users, weekStartDate),
    [deals, users, weekStartDate]
  );
  const scenarioPlanner = useMemo(() => {
    const closeLiftPct = clamp(Number(scenarioCloseLift) || 0, 0, 50);
    const riskRecoveryPct = clamp(Number(scenarioRiskRecovery) || 0, 0, 80);
    const pipelineAdd = Math.max(0, Number(scenarioPipelineAdd) || 0);

    const openDeals = deals.filter((deal) => String(deal.status || "") === "open");
    const baselineWeighted = openDeals.reduce(
      (sum, deal) => sum + Number(deal.value || 0) * (Number(deal.probability || 0) / 100),
      0
    );

    const riskRows = openDeals.map((deal) => {
      const risk = scoreDealSlipRisk(deal);
      const value = Number(deal.value || 0);
      const probability = clamp(Number(deal.probability || 0), 0, 100);
      const conversionLiftWeighted = value * ((100 - probability) / 100) * (closeLiftPct / 100) * 0.4;
      const recoveryLiftWeighted =
        risk.score >= 55
          ? value * (risk.score / 100) * (riskRecoveryPct / 100) * 0.35
          : 0;

      return {
        deal,
        risk,
        probability,
        projectedProbability: clamp(
          probability + closeLiftPct * (risk.score >= 55 ? 0.35 : 0.5),
          0,
          95
        ),
        conversionLiftWeighted,
        recoveryLiftWeighted,
        totalLiftWeighted: conversionLiftWeighted + recoveryLiftWeighted,
      };
    });

    const atRiskRows = riskRows.filter((row) => row.risk.score >= 55);
    const atRiskExposure = atRiskRows.reduce(
      (sum, row) => sum + Number(row.deal.value || 0),
      0
    );
    const conversionLiftWeighted = riskRows.reduce(
      (sum, row) => sum + row.conversionLiftWeighted,
      0
    );
    const recoveryLiftWeighted = riskRows.reduce(
      (sum, row) => sum + row.recoveryLiftWeighted,
      0
    );
    const newPipelineWeighted = pipelineAdd * 0.25;
    const projectedWeighted =
      baselineWeighted + conversionLiftWeighted + recoveryLiftWeighted + newPipelineWeighted;

    const commitBase = forecastRows
      .filter((row) => row.bucket === "commit")
      .reduce((sum, row) => sum + Number(row.value || 0), 0);
    const projectedCommit = commitBase + conversionLiftWeighted * 0.55 + recoveryLiftWeighted * 0.45;

    const topPlays = [...riskRows]
      .sort((left, right) => right.totalLiftWeighted - left.totalLiftWeighted)
      .slice(0, 6);

    return {
      closeLiftPct,
      riskRecoveryPct,
      pipelineAdd,
      baselineWeighted,
      projectedWeighted,
      weightedDelta: projectedWeighted - baselineWeighted,
      commitBase,
      projectedCommit,
      commitDelta: projectedCommit - commitBase,
      atRiskExposure,
      atRiskCount: atRiskRows.length,
      topPlays,
    };
  }, [deals, forecastRows, scenarioCloseLift, scenarioRiskRecovery, scenarioPipelineAdd]);

  const scenarioTaskDueDays = 2;
  const scenarioOpenTaskDealIds = useMemo(() => {
    const ids = activities
      .filter(
        (activity) =>
          !activity.completed_at &&
          String(activity.type || "") === "task" &&
          String(activity.subject || "").startsWith("Scenario recovery:")
      )
      .map((activity) =>
        String(
          activity.related_deal_id ||
            activity.relatedDealId ||
            activity.deal_id ||
            activity.dealId ||
            ""
        )
      )
      .filter(Boolean);

    return new Set(ids);
  }, [activities]);

  const scenarioTaskQueue = useMemo(() => {
    return scenarioPlanner.topPlays.slice(0, 5).map((entry) => ({
      ...entry,
      alreadyQueued: scenarioOpenTaskDealIds.has(String(entry.deal.id)),
    }));
  }, [scenarioOpenTaskDealIds, scenarioPlanner.topPlays]);

  const scenarioPendingQueueCount = useMemo(
    () => scenarioTaskQueue.filter((entry) => !entry.alreadyQueued).length,
    [scenarioTaskQueue]
  );

  const scenarioRecoveryActivities = useMemo(
    () =>
      activities.filter(
        (activity) =>
          String(activity.type || "") === "task" &&
          String(activity.subject || "").startsWith("Scenario recovery:")
      ),
    [activities]
  );

  const scenarioOutcome = useMemo(() => {
    const now = Date.now();
    const last7DaysCutoff = now - 7 * 24 * 60 * 60 * 1000;
    const dealById = new Map(deals.map((deal) => [String(deal.id), deal]));
    const userNameMap = new Map(users.map((user) => [String(user.id), user.full_name]));
    const ownerMap = new Map();
    const influencedWonDeals = new Map();
    const influencedOpenDeals = new Set();
    const influencedLostDeals = new Set();

    const allTaskRows = scenarioRecoveryActivities
      .map((activity) => {
        const relatedDealId = String(
          activity.related_deal_id ||
            activity.relatedDealId ||
            activity.deal_id ||
            activity.dealId ||
            ""
        );
        const deal = relatedDealId ? dealById.get(relatedDealId) : null;
        const dealStatus = String(deal?.status || "unlinked");
        const completedAt = activity.completed_at || activity.completedAt || "";
        const dueAt = activity.due_at || activity.dueAt || "";
        const dueTimestamp = dueAt ? new Date(dueAt).getTime() : 0;
        const overdue = !completedAt && dueTimestamp > 0 && dueTimestamp < now;
        const ownerId = String(activity.user_id || activity.userId || deal?.owner_id || "");
        const ownerName = userNameMap.get(ownerId) || deal?.owner_name || "Unassigned";
        const wonRevenue = dealStatus === "won" ? Number(deal?.value || 0) : 0;

        if (deal) {
          if (dealStatus === "won") {
            influencedWonDeals.set(String(deal.id), Number(deal.value || 0));
          } else if (dealStatus === "open") {
            influencedOpenDeals.add(String(deal.id));
          } else if (dealStatus === "lost") {
            influencedLostDeals.add(String(deal.id));
          }
        }

        const ownerRow = ownerMap.get(ownerName) || {
          ownerId,
          ownerName,
          tasks: 0,
          completed: 0,
          open: 0,
          overdue: 0,
          completedLast7d: 0,
          wonDeals: 0,
          wonRevenue: 0,
        };

        ownerRow.tasks += 1;
        if (completedAt) {
          ownerRow.completed += 1;
          if (new Date(completedAt).getTime() >= last7DaysCutoff) {
            ownerRow.completedLast7d += 1;
          }
        } else {
          ownerRow.open += 1;
          if (overdue) {
            ownerRow.overdue += 1;
          }
        }
        if (dealStatus === "won") {
          ownerRow.wonDeals += 1;
          ownerRow.wonRevenue += wonRevenue;
        }
        ownerMap.set(ownerName, ownerRow);

        return {
          id: String(activity.id),
          subject: activity.subject || "Scenario recovery",
          ownerName,
          dealTitle: deal?.title || "Deal unavailable",
          dealStatus,
          completedAt,
          dueAt,
          overdue,
          wonRevenue,
          sortAt: Math.max(
            completedAt ? new Date(completedAt).getTime() : 0,
            dueTimestamp,
            new Date(activity.created_at || activity.createdAt || 0).getTime() || 0
          ),
        };
      })
      .sort((left, right) => right.sortAt - left.sortAt);

    const completedTasks = allTaskRows.filter((row) => row.completedAt).length;
    const openTasks = allTaskRows.length - completedTasks;
    const overdueTasks = allTaskRows.filter((row) => row.overdue).length;
    const completionRate = allTaskRows.length
      ? Number(((completedTasks / allTaskRows.length) * 100).toFixed(1))
      : 0;
    const completedLast7d = allTaskRows.filter(
      (row) => row.completedAt && new Date(row.completedAt).getTime() >= last7DaysCutoff
    ).length;
    const ownerRows = [...ownerMap.values()]
      .map((row) => ({
        ...row,
        completionRate: row.tasks ? Number(((row.completed / row.tasks) * 100).toFixed(1)) : 0,
        overdueRate: row.tasks ? Number(((row.overdue / row.tasks) * 100).toFixed(1)) : 0,
      }))
      .sort((left, right) => right.wonRevenue - left.wonRevenue || right.completed - left.completed)
      .slice(0, 8);

    return {
      totalTasks: allTaskRows.length,
      completedTasks,
      openTasks,
      overdueTasks,
      completionRate,
      completedLast7d,
      influencedWonCount: influencedWonDeals.size,
      influencedWonRevenue: [...influencedWonDeals.values()].reduce((sum, value) => sum + value, 0),
      influencedOpenCount: influencedOpenDeals.size,
      influencedLostCount: influencedLostDeals.size,
      ownerRows,
      allTaskRows,
      recentRows: allTaskRows.slice(0, 8),
    };
  }, [deals, scenarioRecoveryActivities, users]);

  const scenarioBenchmark = useMemo(() => {
    const owners = scenarioOutcome.ownerRows;
    if (!owners.length) {
      return {
        teamAvgCompletion: 0,
        teamAvgWonRevenue: 0,
        topOwnerName: "None",
        needsSupportCount: 0,
        leagueRows: [],
        coachingRows: [],
      };
    }

    const teamAvgCompletion = Number(
      (
        owners.reduce((sum, row) => sum + Number(row.completionRate || 0), 0) / owners.length
      ).toFixed(1)
    );
    const teamAvgWonRevenue = Number(
      (
        owners.reduce((sum, row) => sum + Number(row.wonRevenue || 0), 0) / owners.length
      ).toFixed(2)
    );

    const leagueRows = owners
      .map((row) => {
        const completionScore = clamp(Number(row.completionRate || 0), 0, 100) * 0.5;
        const revenueRatio =
          teamAvgWonRevenue > 0
            ? Math.min(2, Number(row.wonRevenue || 0) / teamAvgWonRevenue)
            : Number(row.wonRevenue || 0) > 0
            ? 1
            : 0;
        const revenueScore = revenueRatio * 30;
        const hygieneScore = Math.max(0, 20 - Number(row.overdueRate || 0));
        const benchmarkScore = Number((completionScore + revenueScore + hygieneScore).toFixed(1));
        const tier = getBenchmarkTier(benchmarkScore);
        const recommendation = getCoachingRecommendation(row, teamAvgCompletion);

        return {
          ...row,
          benchmarkScore,
          tier,
          recommendation,
        };
      })
      .sort((left, right) => right.benchmarkScore - left.benchmarkScore);

    return {
      teamAvgCompletion,
      teamAvgWonRevenue,
      topOwnerName: leagueRows[0]?.ownerName || "None",
      needsSupportCount: leagueRows.filter((row) => row.tier === "needs_support").length,
      leagueRows,
      coachingRows: [...leagueRows]
        .sort((left, right) => left.benchmarkScore - right.benchmarkScore)
        .slice(0, 4),
    };
  }, [scenarioOutcome.ownerRows]);

  const coachingAssignmentDueDays = 7;
  const coachingOpenOwnerNames = useMemo(() => {
    const names = activities
      .filter(
        (activity) =>
          !activity.completed_at &&
          String(activity.type || "") === "task" &&
          String(activity.subject || "").startsWith("Coaching assignment:")
      )
      .map((activity) => String(activity.subject || "").replace("Coaching assignment:", "").trim())
      .filter(Boolean);

    return new Set(names);
  }, [activities]);

  const coachingAssignmentQueue = useMemo(() => {
    return scenarioBenchmark.leagueRows
      .filter((row) => row.tier === "needs_support" || row.overdue >= 2)
      .sort((left, right) => left.benchmarkScore - right.benchmarkScore)
      .slice(0, 5)
      .map((row) => ({
        ...row,
        alreadyAssigned: coachingOpenOwnerNames.has(row.ownerName),
      }));
  }, [coachingOpenOwnerNames, scenarioBenchmark.leagueRows]);

  const pendingCoachingAssignments = useMemo(
    () => coachingAssignmentQueue.filter((row) => !row.alreadyAssigned).length,
    [coachingAssignmentQueue]
  );

  const weeklyBenchmarkDigestRows = useMemo(
    () =>
      scenarioBenchmark.leagueRows.map((row) => ({
        ...row,
        coachingStatus: coachingOpenOwnerNames.has(row.ownerName) ? "assigned" : "not_assigned",
      })),
    [coachingOpenOwnerNames, scenarioBenchmark.leagueRows]
  );

  const approvalCandidates = useMemo(
    () => coachingAssignmentQueue.filter((row) => !row.alreadyAssigned),
    [coachingAssignmentQueue]
  );

  const selectedApprovalCandidates = useMemo(
    () =>
      approvalCandidates.filter((row) => selectedApprovalOwners.includes(String(row.ownerName))),
    [approvalCandidates, selectedApprovalOwners]
  );

  const coachingAssignmentAudit = useMemo(() => {
    const now = Date.now();
    const userNameMap = new Map(users.map((user) => [String(user.id), user.full_name]));

    const rows = activities
      .filter(
        (activity) =>
          String(activity.type || "") === "task" &&
          String(activity.subject || "").startsWith("Coaching assignment:")
      )
      .map((activity) => {
        const subject = String(activity.subject || "Coaching assignment");
        const ownerName = subject.replace("Coaching assignment:", "").trim() || "Unknown";
        const completedAt = activity.completed_at || activity.completedAt || "";
        const dueAt = activity.due_at || activity.dueAt || "";
        const createdAt = activity.created_at || activity.createdAt || "";
        const dueTimestamp = dueAt ? new Date(dueAt).getTime() : 0;
        const createdTimestamp = createdAt ? new Date(createdAt).getTime() : 0;
        const overdue = !completedAt && dueTimestamp > 0 && dueTimestamp < now;
        const notes = activity.notes || "";
        const metadata = parseCoachingApprovalMetadata(notes);
        const ownerId = String(activity.user_id || activity.userId || "");
        const assigneeName = userNameMap.get(ownerId) || ownerName;

        return {
          id: String(activity.id),
          ownerName,
          assigneeName,
          createdAt,
          createdTimestamp,
          completedAt,
          dueAt,
          overdue,
          approvedBy: metadata.approvedBy,
          approvedAt: metadata.approvedAt,
          approvalStatus: metadata.approvedAt ? "approved" : "pending",
          sortAt: Math.max(
            completedAt ? new Date(completedAt).getTime() : 0,
            dueTimestamp,
            new Date(metadata.approvedAt || 0).getTime() || 0,
            createdTimestamp || 0
          ),
        };
      })
      .sort((left, right) => right.sortAt - left.sortAt);

    const approvedCount = rows.filter((row) => row.approvalStatus === "approved").length;
    const completedCount = rows.filter((row) => Boolean(row.completedAt)).length;

    return {
      totalAssignments: rows.length,
      approvedCount,
      completedCount,
      pendingApproval: rows.length - approvedCount,
      overdueCount: rows.filter((row) => row.overdue).length,
      approvalRate: rows.length ? Number(((approvedCount / rows.length) * 100).toFixed(1)) : 0,
      completionRate: rows.length
        ? Number(((completedCount / rows.length) * 100).toFixed(1))
        : 0,
      rows,
      recentRows: rows.slice(0, 10),
    };
  }, [activities, users]);

  const approvalSlaHours = 48;
  const escalationDueHours = 72;

  const coachingEscalationOpenOwnerNames = useMemo(() => {
    const names = activities
      .filter(
        (activity) =>
          !activity.completed_at &&
          String(activity.type || "") === "task" &&
          String(activity.subject || "").startsWith("Coaching escalation:")
      )
      .map((activity) => String(activity.subject || "").replace("Coaching escalation:", "").trim())
      .filter(Boolean);

    return new Set(names);
  }, [activities]);

  const coachingSlaRows = useMemo(() => {
    const now = Date.now();

    return coachingAssignmentAudit.rows
      .map((row) => {
        const hoursOpen = row.createdTimestamp
          ? Number(((now - row.createdTimestamp) / (1000 * 60 * 60)).toFixed(1))
          : 0;
        const dueTimestamp = row.dueAt ? new Date(row.dueAt).getTime() : 0;
        const hoursPastDue =
          !row.completedAt && dueTimestamp && dueTimestamp < now
            ? Number(((now - dueTimestamp) / (1000 * 60 * 60)).toFixed(1))
            : 0;
        const approvalSlaBreached = row.approvalStatus === "pending" && hoursOpen >= approvalSlaHours;
        const overdueEscalation = !row.completedAt && row.overdue;
        const reasons = [];

        if (approvalSlaBreached) {
          reasons.push(`Approval pending ${hoursOpen}h`);
        }
        if (overdueEscalation) {
          reasons.push(`Assignment overdue ${hoursPastDue}h`);
        }

        return {
          ...row,
          hoursOpen,
          hoursPastDue,
          approvalSlaBreached,
          overdueEscalation,
          needsEscalation: reasons.length > 0,
          escalationReasons: reasons,
          alreadyEscalated: coachingEscalationOpenOwnerNames.has(row.ownerName),
        };
      })
      .sort((left, right) => {
        const leftSeverity = Number(left.approvalSlaBreached) + Number(left.overdueEscalation);
        const rightSeverity = Number(right.approvalSlaBreached) + Number(right.overdueEscalation);
        return rightSeverity - leftSeverity || right.sortAt - left.sortAt;
      });
  }, [coachingAssignmentAudit.rows, coachingEscalationOpenOwnerNames, approvalSlaHours]);

  const coachingEscalationQueue = useMemo(
    () => coachingSlaRows.filter((row) => row.needsEscalation),
    [coachingSlaRows]
  );

  const pendingEscalationCount = useMemo(
    () => coachingEscalationQueue.filter((row) => !row.alreadyEscalated).length,
    [coachingEscalationQueue]
  );

  const approvalSlaBreachCount = useMemo(
    () => coachingSlaRows.filter((row) => row.approvalSlaBreached).length,
    [coachingSlaRows]
  );

  const overdueEscalationCount = useMemo(
    () => coachingSlaRows.filter((row) => row.overdueEscalation).length,
    [coachingSlaRows]
  );

  const escalationAcknowledgementBySourceId = useMemo(() => {
    const userNameMap = new Map(users.map((user) => [String(user.id), user.full_name]));
    const map = new Map();

    for (const activity of activities) {
      const subject = String(activity.subject || "");
      if (!subject.startsWith("Escalation acknowledgement:")) {
        continue;
      }

      const notes = String(activity.notes || "");
      const sourceMatch = notes.match(/source_escalation_id=([^;]+)/i);
      const sourceEscalationId = sourceMatch?.[1]?.trim();
      if (!sourceEscalationId) {
        continue;
      }

      const acknowledgedAtMatch = notes.match(/acknowledged_at=([^;]+)/i);
      const acknowledgedByMatch = notes.match(/acknowledged_by=([^;]+)/i);
      const createdAt = activity.created_at || activity.createdAt || "";
      const sortAt = Math.max(
        new Date(acknowledgedAtMatch?.[1] || 0).getTime() || 0,
        new Date(createdAt || 0).getTime() || 0
      );

      const current = map.get(sourceEscalationId);
      if (current && current.sortAt >= sortAt) {
        continue;
      }

      map.set(sourceEscalationId, {
        sortAt,
        acknowledgedAt: acknowledgedAtMatch?.[1]?.trim() || createdAt || "",
        acknowledgedBy:
          acknowledgedByMatch?.[1]?.trim() ||
          userNameMap.get(String(activity.user_id || activity.userId || "")) ||
          "Manager",
      });
    }

    return map;
  }, [activities, users]);

  const escalationResolution = useMemo(() => {
    const now = Date.now();

    const rows = activities
      .filter(
        (activity) =>
          String(activity.type || "") === "task" &&
          String(activity.subject || "").startsWith("Coaching escalation:")
      )
      .map((activity) => {
        const subject = String(activity.subject || "Coaching escalation");
        const ownerName = subject.replace("Coaching escalation:", "").trim() || "Unknown";
        const id = String(activity.id);
        const createdAt = activity.created_at || activity.createdAt || "";
        const createdTimestamp = createdAt ? new Date(createdAt).getTime() : 0;
        const dueAt = activity.due_at || activity.dueAt || "";
        const dueTimestamp = dueAt ? new Date(dueAt).getTime() : 0;
        const completedAt = activity.completed_at || activity.completedAt || "";
        const closed = Boolean(completedAt);
        const hoursOpen = createdTimestamp
          ? Number(((now - createdTimestamp) / (1000 * 60 * 60)).toFixed(1))
          : 0;
        const agingBand = getEscalationAgingBand(hoursOpen);
        const overdue = !closed && dueTimestamp > 0 && dueTimestamp < now;
        const ack = escalationAcknowledgementBySourceId.get(id) || null;
        const acknowledged = Boolean(ack);
        const status = closed ? "closed" : acknowledged ? "acknowledged" : "new";

        return {
          id,
          ownerName,
          createdAt,
          dueAt,
          completedAt,
          closed,
          acknowledged,
          acknowledgedAt: ack?.acknowledgedAt || "",
          acknowledgedBy: ack?.acknowledgedBy || "",
          status,
          hoursOpen,
          agingBand,
          overdue,
          sortAt: Math.max(
            completedAt ? new Date(completedAt).getTime() : 0,
            dueTimestamp,
            createdTimestamp
          ),
        };
      })
      .sort((left, right) => {
        const leftActive = Number(!left.closed);
        const rightActive = Number(!right.closed);
        return rightActive - leftActive || right.sortAt - left.sortAt;
      });

    const newCount = rows.filter((row) => row.status === "new").length;
    const acknowledgedCount = rows.filter((row) => row.status === "acknowledged").length;
    const closedCount = rows.filter((row) => row.status === "closed").length;

    return {
      rows,
      openRows: rows.filter((row) => !row.closed),
      newCount,
      acknowledgedCount,
      closedCount,
      criticalCount: rows.filter((row) => row.agingBand === "critical" && !row.closed).length,
      recentRows: rows.slice(0, 10),
    };
  }, [activities, escalationAcknowledgementBySourceId]);

  const managerSlaTrend = useMemo(() => {
    const currentWeekStart = startOfWeek(new Date());
    if (!currentWeekStart) {
      return { rows: [], overallCompliance: 0 };
    }

    const weekStarts = [];
    for (let index = 3; index >= 0; index -= 1) {
      const weekStart = new Date(currentWeekStart);
      weekStart.setDate(weekStart.getDate() - index * 7);
      weekStarts.push(weekStart);
    }

    const map = new Map(
      weekStarts.map((weekStart) => [
        weekKey(weekStart),
        {
          weekStart,
          totalAssignments: 0,
          approvedWithinSla: 0,
          approvedEventually: 0,
        },
      ])
    );

    for (const row of coachingAssignmentAudit.rows) {
      if (!row.createdTimestamp) {
        continue;
      }

      const weekStart = startOfWeek(new Date(row.createdTimestamp));
      if (!weekStart) {
        continue;
      }

      const key = weekKey(weekStart);
      const bucket = map.get(key);
      if (!bucket) {
        continue;
      }

      bucket.totalAssignments += 1;

      if (row.approvedAt) {
        bucket.approvedEventually += 1;
        const approvedTimestamp = new Date(row.approvedAt).getTime();
        if (
          approvedTimestamp &&
          row.createdTimestamp &&
          approvedTimestamp - row.createdTimestamp <= approvalSlaHours * 60 * 60 * 1000
        ) {
          bucket.approvedWithinSla += 1;
        }
      }
    }

    const rows = [...map.values()].map((bucket) => ({
      ...bucket,
      label: bucket.weekStart.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      }),
      complianceRate: bucket.totalAssignments
        ? Number(((bucket.approvedWithinSla / bucket.totalAssignments) * 100).toFixed(1))
        : 0,
    }));

    const totalAssignments = rows.reduce((sum, row) => sum + row.totalAssignments, 0);
    const approvedWithinSla = rows.reduce((sum, row) => sum + row.approvedWithinSla, 0);

    return {
      rows,
      overallCompliance: totalAssignments
        ? Number(((approvedWithinSla / totalAssignments) * 100).toFixed(1))
        : 0,
    };
  }, [coachingAssignmentAudit.rows, approvalSlaHours]);

  const escalationPreventionTasks = useMemo(() => {
    const rows = activities
      .filter(
        (activity) =>
          String(activity.type || "") === "task" &&
          String(activity.subject || "").startsWith("Escalation prevention:")
      )
      .map((activity) => {
        const subject = String(activity.subject || "Escalation prevention");
        const ownerName = subject.replace("Escalation prevention:", "").trim() || "Unknown";
        const completedAt = activity.completed_at || activity.completedAt || "";
        const dueAt = activity.due_at || activity.dueAt || "";
        const createdAt = activity.created_at || activity.createdAt || "";

        return {
          id: String(activity.id),
          ownerName,
          completedAt,
          dueAt,
          createdAt,
          completed: Boolean(completedAt),
        };
      });

    const openOwnerNames = new Set(
      rows.filter((row) => !row.completed).map((row) => row.ownerName)
    );
    const completedOwnerNames = new Set(
      rows.filter((row) => row.completed).map((row) => row.ownerName)
    );

    return {
      rows,
      openOwnerNames,
      completedOwnerNames,
      openCount: rows.filter((row) => !row.completed).length,
      completedCount: rows.filter((row) => row.completed).length,
    };
  }, [activities]);

  const escalationPreventionLoop = useMemo(() => {
    const candidateMap = new Map();

    for (const row of escalationResolution.rows) {
      if (!row.closed) {
        continue;
      }

      const requiresPrevention = row.agingBand === "critical" || row.overdue || row.hoursOpen >= 48;
      if (!requiresPrevention) {
        continue;
      }

      const current = candidateMap.get(row.ownerName);
      if (!current || row.sortAt > current.sortAt) {
        candidateMap.set(row.ownerName, row);
      }
    }

    const rows = [...candidateMap.values()]
      .map((row) => {
        const hasOpenPlan = escalationPreventionTasks.openOwnerNames.has(row.ownerName);
        const hasCompletedPlan = escalationPreventionTasks.completedOwnerNames.has(row.ownerName);
        const planStatus = hasCompletedPlan ? "completed" : hasOpenPlan ? "active" : "pending";

        let suggestedAction = "Review escalation timeline and lock preventive owner cadence.";
        if (row.agingBand === "critical") {
          suggestedAction = "Run critical root-cause review and implement 2 preventive controls this week.";
        } else if (row.overdue) {
          suggestedAction = "Create overdue prevention checklist with deadline guardrails and reviewer check-ins.";
        }

        return {
          ...row,
          planStatus,
          hasOpenPlan,
          hasCompletedPlan,
          suggestedAction,
        };
      })
      .sort((left, right) => {
        const leftRank = left.planStatus === "pending" ? 3 : left.planStatus === "active" ? 2 : 1;
        const rightRank = right.planStatus === "pending" ? 3 : right.planStatus === "active" ? 2 : 1;
        return rightRank - leftRank || right.sortAt - left.sortAt;
      });

    const coveredCount = rows.filter((row) => row.planStatus !== "pending").length;

    return {
      rows,
      candidateCount: rows.length,
      pendingCount: rows.filter((row) => row.planStatus === "pending").length,
      activeCount: rows.filter((row) => row.planStatus === "active").length,
      completedCount: rows.filter((row) => row.planStatus === "completed").length,
      coverageRate: rows.length ? Number(((coveredCount / rows.length) * 100).toFixed(1)) : 0,
      openPlanCount: escalationPreventionTasks.openCount,
      completedPlanCount: escalationPreventionTasks.completedCount,
    };
  }, [escalationResolution.rows, escalationPreventionTasks]);

  const controlTowerWeekStart = useMemo(() => startOfWeek(new Date()), []);
  const controlTowerWeekKey = controlTowerWeekStart ? weekKey(controlTowerWeekStart) : "";

  const controlTowerOpenReviewCount = useMemo(
    () =>
      activities.filter(
        (activity) =>
          !activity.completed_at &&
          String(activity.type || "") === "task" &&
          String(activity.subject || "").startsWith(
            `Operating review: Governance control tower (${controlTowerWeekKey})`
          )
      ).length,
    [activities, controlTowerWeekKey]
  );

  const controlTowerSummary = useMemo(() => {
    const scenarioExecution = Number(scenarioOutcome.completionRate || 0);
    const approvalCompliance = Number(managerSlaTrend.overallCompliance || 0);
    const escalationResolutionRate = escalationResolution.rows.length
      ? Number(
          ((escalationResolution.closedCount / escalationResolution.rows.length) * 100).toFixed(1)
        )
      : 100;
    const preventionCoverage = Number(escalationPreventionLoop.coverageRate || 0);

    const healthScore = Number(
      (
        scenarioExecution * 0.25 +
        approvalCompliance * 0.25 +
        escalationResolutionRate * 0.25 +
        preventionCoverage * 0.25
      ).toFixed(1)
    );

    let healthBand = "critical";
    if (healthScore >= 80) {
      healthBand = "strong";
    } else if (healthScore >= 60) {
      healthBand = "watch";
    }

    const actions = [];
    if (scenarioExecution < 70) {
      actions.push("Increase scenario follow-through cadence with owner-level daily check-ins.");
    }
    if (approvalCompliance < 70) {
      actions.push("Tighten manager approval SLAs and pre-schedule weekly approval windows.");
    }
    if (escalationResolutionRate < 75) {
      actions.push("Close lingering escalations and enforce acknowledgement within 24h.");
    }
    if (preventionCoverage < 70) {
      actions.push("Convert resolved critical escalations into prevention plans by default.");
    }
    if (!actions.length) {
      actions.push("Maintain current operating cadence and document repeatable playbooks.");
    }

    return {
      scenarioExecution,
      approvalCompliance,
      escalationResolutionRate,
      preventionCoverage,
      healthScore,
      healthBand,
      actions,
    };
  }, [
    escalationPreventionLoop.coverageRate,
    escalationResolution.closedCount,
    escalationResolution.rows.length,
    managerSlaTrend.overallCompliance,
    scenarioOutcome.completionRate,
  ]);

  const kpis = useMemo(() => {
    const wonRevenue = deals
      .filter((deal) => deal.status === "won")
      .reduce((sum, deal) => sum + Number(deal.value || 0), 0);

    const openDeals = deals.filter((deal) => deal.status === "open").length;

    return {
      wonRevenue,
      openDeals,
      totalLeads: leads.length,
      totalCustomers: customers.length,
      commitValue: forecastRows
        .filter((row) => row.bucket === "commit")
        .reduce((sum, row) => sum + Number(row.value || 0), 0),
      bestCaseValue: forecastRows
        .filter((row) => row.bucket === "best_case")
        .reduce((sum, row) => sum + Number(row.value || 0), 0),
    };
  }, [customers.length, deals, forecastRows, leads.length]);

  const exportExecutiveSummary = () => {
    const rows = [
      {
        snapshotAt: new Date().toISOString(),
        wonRevenue: kpis.wonRevenue,
        openDeals: kpis.openDeals,
        totalLeads: kpis.totalLeads,
        totalCustomers: kpis.totalCustomers,
      },
    ];

    const csv = rowsToCsv(rows, [
      { header: "snapshot_at", render: (row) => row.snapshotAt },
      { header: "won_revenue", render: (row) => row.wonRevenue },
      { header: "open_deals", render: (row) => row.openDeals },
      { header: "total_leads", render: (row) => row.totalLeads },
      { header: "total_customers", render: (row) => row.totalCustomers },
    ]);

    downloadCsv("report-executive-summary.csv", csv);
    setLastExportAt(new Date().toISOString());
  };

  const exportStagePerformance = () => {
    const csv = rowsToCsv(stageRows, [
      { header: "stage", render: (row) => row.stage },
      { header: "deals", render: (row) => row.count },
      { header: "total_value", render: (row) => row.totalValue },
      { header: "avg_probability", render: (row) => row.avgProbability },
    ]);

    downloadCsv("report-stage-performance.csv", csv);
    setLastExportAt(new Date().toISOString());
  };

  const exportTeamPerformance = () => {
    const csv = rowsToCsv(ownerRows, [
      { header: "owner", render: (row) => row.ownerName },
      { header: "total_deals", render: (row) => row.deals },
      { header: "won_deals", render: (row) => row.wonDeals },
      { header: "win_rate", render: (row) => row.winRate },
      { header: "won_revenue", render: (row) => row.revenue },
    ]);

    downloadCsv("report-team-performance.csv", csv);
    setLastExportAt(new Date().toISOString());
  };

  const exportForecastRollup = () => {
    const csv = rowsToCsv(forecastRows, [
      { header: "bucket", render: (row) => row.bucket },
      { header: "label", render: (row) => row.label },
      { header: "opportunity_count", render: (row) => row.count },
      { header: "bucket_value", render: (row) => row.value },
      { header: "weighted_value", render: (row) => row.weightedValue },
    ]);

    downloadCsv("report-forecast-rollup.csv", csv);
    setLastExportAt(new Date().toISOString());
  };

  const exportScenarioPlanner = () => {
    const rows = [
      {
        snapshotAt: new Date().toISOString(),
        closeLiftPct: scenarioPlanner.closeLiftPct,
        riskRecoveryPct: scenarioPlanner.riskRecoveryPct,
        pipelineAdd: scenarioPlanner.pipelineAdd,
        baselineWeighted: scenarioPlanner.baselineWeighted,
        projectedWeighted: scenarioPlanner.projectedWeighted,
        weightedDelta: scenarioPlanner.weightedDelta,
        commitBase: scenarioPlanner.commitBase,
        projectedCommit: scenarioPlanner.projectedCommit,
        commitDelta: scenarioPlanner.commitDelta,
        atRiskExposure: scenarioPlanner.atRiskExposure,
        atRiskCount: scenarioPlanner.atRiskCount,
      },
    ];

    const csv = rowsToCsv(rows, [
      { header: "snapshot_at", render: (row) => row.snapshotAt },
      { header: "close_lift_pct", render: (row) => row.closeLiftPct },
      { header: "risk_recovery_pct", render: (row) => row.riskRecoveryPct },
      { header: "new_pipeline_add", render: (row) => row.pipelineAdd },
      { header: "baseline_weighted", render: (row) => row.baselineWeighted },
      { header: "projected_weighted", render: (row) => row.projectedWeighted },
      { header: "weighted_delta", render: (row) => row.weightedDelta },
      { header: "baseline_commit", render: (row) => row.commitBase },
      { header: "projected_commit", render: (row) => row.projectedCommit },
      { header: "commit_delta", render: (row) => row.commitDelta },
      { header: "at_risk_exposure", render: (row) => row.atRiskExposure },
      { header: "at_risk_count", render: (row) => row.atRiskCount },
    ]);

    downloadCsv("report-scenario-planner.csv", csv);
    setLastExportAt(new Date().toISOString());
  };

  const exportManagerWeeklyDigest = () => {
    const csv = rowsToCsv(managerDigestRows, [
      { header: "owner", render: (row) => row.ownerName },
      { header: "open_deals", render: (row) => row.openDeals },
      { header: "open_value", render: (row) => row.openValue },
      { header: "commit_deals", render: (row) => row.commitDeals },
      { header: "best_case_deals", render: (row) => row.bestCaseDeals },
      { header: "won_this_week", render: (row) => row.wonThisWeek },
      { header: "won_revenue_this_week", render: (row) => row.wonRevenueThisWeek },
    ]);

    downloadCsv("report-manager-weekly-digest.csv", csv);
    setLastExportAt(new Date().toISOString());
  };

  const exportScenarioOutcomes = () => {
    const csv = rowsToCsv(scenarioOutcome.allTaskRows, [
      { header: "task_id", render: (row) => row.id },
      { header: "task_subject", render: (row) => row.subject },
      { header: "owner", render: (row) => row.ownerName },
      { header: "deal_title", render: (row) => row.dealTitle },
      { header: "deal_status", render: (row) => row.dealStatus },
      { header: "overdue", render: (row) => (row.overdue ? "yes" : "no") },
      { header: "due_at", render: (row) => row.dueAt },
      { header: "completed_at", render: (row) => row.completedAt },
      { header: "won_revenue", render: (row) => row.wonRevenue },
    ]);

    downloadCsv("report-scenario-outcomes.csv", csv);
    setLastExportAt(new Date().toISOString());
  };

  const exportScenarioBenchmarks = () => {
    const csv = rowsToCsv(scenarioBenchmark.leagueRows, [
      { header: "owner", render: (row) => row.ownerName },
      { header: "benchmark_tier", render: (row) => row.tier },
      { header: "benchmark_score", render: (row) => row.benchmarkScore },
      { header: "tasks", render: (row) => row.tasks },
      { header: "completed", render: (row) => row.completed },
      { header: "open", render: (row) => row.open },
      { header: "overdue", render: (row) => row.overdue },
      { header: "completion_rate", render: (row) => row.completionRate },
      { header: "overdue_rate", render: (row) => row.overdueRate },
      { header: "won_deals", render: (row) => row.wonDeals },
      { header: "won_revenue", render: (row) => row.wonRevenue },
      { header: "recommendation", render: (row) => row.recommendation },
    ]);

    downloadCsv("report-scenario-benchmarks.csv", csv);
    setLastExportAt(new Date().toISOString());
  };

  const exportWeeklyBenchmarkDigest = () => {
    const csv = rowsToCsv(weeklyBenchmarkDigestRows, [
      { header: "owner", render: (row) => row.ownerName },
      { header: "tier", render: (row) => row.tier },
      { header: "benchmark_score", render: (row) => row.benchmarkScore },
      { header: "completion_rate", render: (row) => row.completionRate },
      { header: "overdue", render: (row) => row.overdue },
      { header: "won_deals", render: (row) => row.wonDeals },
      { header: "won_revenue", render: (row) => row.wonRevenue },
      { header: "coaching_status", render: (row) => row.coachingStatus },
      { header: "recommendation", render: (row) => row.recommendation },
    ]);

    downloadCsv("report-weekly-benchmark-digest.csv", csv);
    setLastExportAt(new Date().toISOString());
  };

  const exportCoachingApprovalAudit = () => {
    const csv = rowsToCsv(coachingAssignmentAudit.rows, [
      { header: "assignment_id", render: (row) => row.id },
      { header: "owner", render: (row) => row.ownerName },
      { header: "assignee", render: (row) => row.assigneeName },
      { header: "approval_status", render: (row) => row.approvalStatus },
      { header: "approved_by", render: (row) => row.approvedBy },
      { header: "approved_at", render: (row) => row.approvedAt },
      { header: "due_at", render: (row) => row.dueAt },
      { header: "completed_at", render: (row) => row.completedAt },
      { header: "overdue", render: (row) => (row.overdue ? "yes" : "no") },
    ]);

    downloadCsv("report-coaching-approval-audit.csv", csv);
    setLastExportAt(new Date().toISOString());
  };

  const exportCoachingSlaEscalations = () => {
    const csv = rowsToCsv(coachingEscalationQueue, [
      { header: "assignment_id", render: (row) => row.id },
      { header: "owner", render: (row) => row.ownerName },
      { header: "approval_status", render: (row) => row.approvalStatus },
      { header: "approval_sla_breached", render: (row) => (row.approvalSlaBreached ? "yes" : "no") },
      { header: "overdue_escalation", render: (row) => (row.overdueEscalation ? "yes" : "no") },
      { header: "hours_open", render: (row) => row.hoursOpen },
      { header: "hours_past_due", render: (row) => row.hoursPastDue },
      { header: "escalation_reasons", render: (row) => row.escalationReasons.join(" | ") },
      { header: "already_escalated", render: (row) => (row.alreadyEscalated ? "yes" : "no") },
    ]);

    downloadCsv("report-coaching-sla-escalations.csv", csv);
    setLastExportAt(new Date().toISOString());
  };

  const exportEscalationResolutionAudit = () => {
    const csv = rowsToCsv(escalationResolution.rows, [
      { header: "escalation_id", render: (row) => row.id },
      { header: "owner", render: (row) => row.ownerName },
      { header: "status", render: (row) => row.status },
      { header: "aging_band", render: (row) => row.agingBand },
      { header: "hours_open", render: (row) => row.hoursOpen },
      { header: "overdue", render: (row) => (row.overdue ? "yes" : "no") },
      { header: "acknowledged_by", render: (row) => row.acknowledgedBy },
      { header: "acknowledged_at", render: (row) => row.acknowledgedAt },
      { header: "due_at", render: (row) => row.dueAt },
      { header: "completed_at", render: (row) => row.completedAt },
    ]);

    downloadCsv("report-escalation-resolution-audit.csv", csv);
    setLastExportAt(new Date().toISOString());
  };

  const exportManagerSlaComplianceTrend = () => {
    const csv = rowsToCsv(managerSlaTrend.rows, [
      { header: "week_start", render: (row) => weekKey(row.weekStart) },
      { header: "label", render: (row) => row.label },
      { header: "total_assignments", render: (row) => row.totalAssignments },
      { header: "approved_within_sla", render: (row) => row.approvedWithinSla },
      { header: "approved_eventually", render: (row) => row.approvedEventually },
      { header: "compliance_rate", render: (row) => row.complianceRate },
    ]);

    downloadCsv("report-manager-sla-compliance-trend.csv", csv);
    setLastExportAt(new Date().toISOString());
  };

  const exportEscalationPreventionLoop = () => {
    const csv = rowsToCsv(escalationPreventionLoop.rows, [
      { header: "owner", render: (row) => row.ownerName },
      { header: "source_escalation_id", render: (row) => row.id },
      { header: "status", render: (row) => row.status },
      { header: "aging_band", render: (row) => row.agingBand },
      { header: "hours_open", render: (row) => row.hoursOpen },
      { header: "plan_status", render: (row) => row.planStatus },
      { header: "suggested_action", render: (row) => row.suggestedAction },
      { header: "closed_at", render: (row) => row.completedAt },
    ]);

    downloadCsv("report-escalation-prevention-loop.csv", csv);
    setLastExportAt(new Date().toISOString());
  };

  const exportControlTowerSummary = () => {
    const rows = [
      {
        snapshotAt: new Date().toISOString(),
        weekStart: controlTowerWeekKey,
        scenarioExecution: controlTowerSummary.scenarioExecution,
        approvalCompliance: controlTowerSummary.approvalCompliance,
        escalationResolutionRate: controlTowerSummary.escalationResolutionRate,
        preventionCoverage: controlTowerSummary.preventionCoverage,
        healthScore: controlTowerSummary.healthScore,
        healthBand: controlTowerSummary.healthBand,
        recommendations: controlTowerSummary.actions.join(" | "),
      },
    ];

    const csv = rowsToCsv(rows, [
      { header: "snapshot_at", render: (row) => row.snapshotAt },
      { header: "week_start", render: (row) => row.weekStart },
      { header: "scenario_execution", render: (row) => row.scenarioExecution },
      { header: "approval_compliance", render: (row) => row.approvalCompliance },
      {
        header: "escalation_resolution_rate",
        render: (row) => row.escalationResolutionRate,
      },
      { header: "prevention_coverage", render: (row) => row.preventionCoverage },
      { header: "health_score", render: (row) => row.healthScore },
      { header: "health_band", render: (row) => row.healthBand },
      { header: "recommendations", render: (row) => row.recommendations },
    ]);

    downloadCsv("report-control-tower-summary.csv", csv);
    setLastExportAt(new Date().toISOString());
  };

  const activateScenarioRecovery = async () => {
    if (!scenarioTaskQueue.length) {
      setScenarioActivationError("");
      setScenarioActivationNotice("No scenario plays are available to convert into tasks yet.");
      return;
    }

    const dueAt = new Date(
      Date.now() + scenarioTaskDueDays * 24 * 60 * 60 * 1000
    ).toISOString();
    const createPayloads = scenarioTaskQueue
      .filter((entry) => !entry.alreadyQueued)
      .map((entry) => ({
        type: "task",
        subject: `Scenario recovery: ${entry.deal.title}`,
        notes: `Step 7 scenario activation. Projected weighted lift ${formatCompactCurrency(
          entry.totalLiftWeighted
        )}. Risk score ${entry.risk.score}. Focus: ${
          (entry.risk.reasons || []).join("; ") || "Win-rate and close-date reinforcement"
        }`,
        relatedDealId: entry.deal.id,
        userId: entry.deal.owner_id || null,
        dueAt,
      }));

    if (!createPayloads.length) {
      setScenarioActivationError("");
      setScenarioActivationNotice(
        "All top scenario plays already have open scenario recovery tasks."
      );
      return;
    }

    try {
      setActivatingScenario(true);
      setScenarioActivationError("");
      setScenarioActivationNotice("");
      await Promise.all(createPayloads.map((payload) => crmApi.createActivity(payload)));
      setScenarioActivationCount(createPayloads.length);
      setScenarioActivationAt(new Date().toISOString());
      setScenarioActivationNotice(
        `Created ${createPayloads.length} scenario recovery task${
          createPayloads.length > 1 ? "s" : ""
        }.`
      );
      await dispatch(fetchDashboardData());
    } catch (error) {
      setScenarioActivationError(error.message || "Unable to activate scenario recovery queue");
    } finally {
      setActivatingScenario(false);
    }
  };

  const activateCoachingAssignments = async () => {
    if (!coachingAssignmentQueue.length) {
      setCoachingActivationError("");
      setCoachingActivationNotice("No owners currently meet coaching assignment criteria.");
      return;
    }

    const dueAt = new Date(
      Date.now() + coachingAssignmentDueDays * 24 * 60 * 60 * 1000
    ).toISOString();
    const createPayloads = coachingAssignmentQueue
      .filter((row) => !row.alreadyAssigned)
      .map((row) => ({
        type: "task",
        subject: `Coaching assignment: ${row.ownerName}`,
        notes: `Step 10 coaching assignment. Tier ${row.tier.replace("_", " ")}, score ${
          row.benchmarkScore
        }, completion ${row.completionRate}%, overdue ${row.overdue}. Recommendation: ${
          row.recommendation
        }`,
        userId: row.ownerId || null,
        dueAt,
      }));

    if (!createPayloads.length) {
      setCoachingActivationError("");
      setCoachingActivationNotice("All coaching candidates already have open coaching assignments.");
      return;
    }

    try {
      setActivatingCoaching(true);
      setCoachingActivationError("");
      setCoachingActivationNotice("");
      await Promise.all(createPayloads.map((payload) => crmApi.createActivity(payload)));
      setCoachingActivationCount(createPayloads.length);
      setCoachingActivationAt(new Date().toISOString());
      setCoachingActivationNotice(
        `Created ${createPayloads.length} coaching assignment${
          createPayloads.length > 1 ? "s" : ""
        }.`
      );
      await dispatch(fetchDashboardData());
    } catch (error) {
      setCoachingActivationError(error.message || "Unable to activate coaching assignments");
    } finally {
      setActivatingCoaching(false);
    }
  };

  const toggleApprovalOwnerSelection = (ownerName) => {
    setSelectedApprovalOwners((current) => {
      const key = String(ownerName);
      return current.includes(key)
        ? current.filter((value) => value !== key)
        : [...current, key];
    });
  };

  const approveSelectedCoachingAssignments = async () => {
    if (!approvalCandidates.length) {
      setApprovalError("");
      setApprovalNotice("No pending coaching candidates available for manager approval.");
      return;
    }

    if (!selectedApprovalCandidates.length) {
      setApprovalError("");
      setApprovalNotice("Select at least one pending coaching candidate to approve.");
      return;
    }

    const approverName =
      currentUser?.full_name || currentUser?.fullName || currentUser?.email || "Manager";
    const approverId = currentUser?.id || null;
    const dueAt = new Date(
      Date.now() + coachingAssignmentDueDays * 24 * 60 * 60 * 1000
    ).toISOString();
    const approvedAt = new Date().toISOString();

    const createPayloads = selectedApprovalCandidates.map((row) => ({
      type: "task",
      subject: `Coaching assignment: ${row.ownerName}`,
      notes: `Step 11 manager approval. approved_by=${approverName}; approved_at=${approvedAt}; approved_by_id=${approverId || ""}; tier=${row.tier}; score=${row.benchmarkScore}; recommendation=${row.recommendation}`,
      userId: row.ownerId || null,
      dueAt,
    }));

    try {
      setApprovingCoaching(true);
      setApprovalError("");
      setApprovalNotice("");
      await Promise.all(createPayloads.map((payload) => crmApi.createActivity(payload)));
      setApprovalCount(createPayloads.length);
      setApprovalAt(new Date().toISOString());
      setApprovalNotice(
        `Approved ${createPayloads.length} coaching assignment${
          createPayloads.length > 1 ? "s" : ""
        } as ${approverName}.`
      );
      setSelectedApprovalOwners([]);
      await dispatch(fetchDashboardData());
    } catch (error) {
      setApprovalError(error.message || "Unable to approve selected coaching assignments");
    } finally {
      setApprovingCoaching(false);
    }
  };

  const activateCoachingEscalations = async () => {
    if (!coachingEscalationQueue.length) {
      setEscalationError("");
      setEscalationNotice("No SLA or overdue coaching assignment escalations are required right now.");
      return;
    }

    const dueAt = new Date(Date.now() + escalationDueHours * 60 * 60 * 1000).toISOString();
    const escalationOwnerId = currentUser?.id || null;
    const escalationOwnerLabel =
      currentUser?.full_name || currentUser?.fullName || currentUser?.email || "Manager";

    const createPayloads = coachingEscalationQueue
      .filter((row) => !row.alreadyEscalated)
      .map((row) => ({
        type: "task",
        subject: `Coaching escalation: ${row.ownerName}`,
        notes: `Step 12 escalation route. Triggered by ${row.escalationReasons.join(", "
        )}. Source assignment ${row.id}. Routed to ${escalationOwnerLabel}.`,
        userId: escalationOwnerId,
        dueAt,
      }));

    if (!createPayloads.length) {
      setEscalationError("");
      setEscalationNotice("All coaching SLA breaches are already escalated.");
      return;
    }

    try {
      setEscalatingCoaching(true);
      setEscalationError("");
      setEscalationNotice("");
      await Promise.all(createPayloads.map((payload) => crmApi.createActivity(payload)));
      setEscalationCount(createPayloads.length);
      setEscalationAt(new Date().toISOString());
      setEscalationNotice(
        `Created ${createPayloads.length} escalation task${
          createPayloads.length > 1 ? "s" : ""
        }.`
      );
      await dispatch(fetchDashboardData());
    } catch (error) {
      setEscalationError(error.message || "Unable to create coaching escalation tasks");
    } finally {
      setEscalatingCoaching(false);
    }
  };

  const acknowledgeEscalation = async (row) => {
    if (!row || row.closed || row.acknowledged) {
      return;
    }

    const actorName =
      currentUser?.full_name || currentUser?.fullName || currentUser?.email || "Manager";
    const actorId = currentUser?.id || null;
    const acknowledgedAt = new Date().toISOString();

    try {
      setAcknowledgingEscalationId(row.id);
      setEscalationResolutionError("");
      setEscalationResolutionNotice("");
      await crmApi.createActivity({
        type: "task",
        subject: `Escalation acknowledgement: ${row.ownerName}`,
        notes: `Step 13 escalation acknowledgement. source_escalation_id=${row.id}; acknowledged_by=${actorName}; acknowledged_at=${acknowledgedAt}`,
        userId: actorId,
        dueAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      });
      setEscalationResolutionCount(1);
      setEscalationResolutionAt(new Date().toISOString());
      setEscalationResolutionNotice(`Escalation for ${row.ownerName} acknowledged by ${actorName}.`);
      await dispatch(fetchDashboardData());
    } catch (error) {
      setEscalationResolutionError(error.message || "Unable to acknowledge escalation");
    } finally {
      setAcknowledgingEscalationId(null);
    }
  };

  const closeEscalation = async (row) => {
    if (!row || row.closed) {
      return;
    }

    try {
      setClosingEscalationId(row.id);
      setEscalationResolutionError("");
      setEscalationResolutionNotice("");
      await crmApi.completeActivity(row.id);
      setEscalationResolutionCount(1);
      setEscalationResolutionAt(new Date().toISOString());
      setEscalationResolutionNotice(`Escalation for ${row.ownerName} closed.`);
      await dispatch(fetchDashboardData());
    } catch (error) {
      setEscalationResolutionError(error.message || "Unable to close escalation");
    } finally {
      setClosingEscalationId(null);
    }
  };

  const activateEscalationPreventionPlans = async () => {
    if (!escalationPreventionLoop.candidateCount) {
      setPreventionError("");
      setPreventionNotice("No resolved escalation candidates require prevention plans right now.");
      return;
    }

    const userIdByName = new Map(users.map((user) => [String(user.full_name), user.id]));
    const createPayloads = escalationPreventionLoop.rows
      .filter((row) => row.planStatus === "pending")
      .map((row) => ({
        type: "task",
        subject: `Escalation prevention: ${row.ownerName}`,
        notes: `Step 14 prevention loop. source_escalation_id=${row.id}; source_aging_band=${row.agingBand}; source_hours_open=${row.hoursOpen}; action=${row.suggestedAction}`,
        userId: userIdByName.get(String(row.ownerName)) || currentUser?.id || null,
        dueAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      }));

    if (!createPayloads.length) {
      setPreventionError("");
      setPreventionNotice("All prevention candidates already have active or completed prevention plans.");
      return;
    }

    try {
      setActivatingPrevention(true);
      setPreventionError("");
      setPreventionNotice("");
      await Promise.all(createPayloads.map((payload) => crmApi.createActivity(payload)));
      setPreventionCount(createPayloads.length);
      setPreventionAt(new Date().toISOString());
      setPreventionNotice(
        `Created ${createPayloads.length} escalation prevention plan${
          createPayloads.length > 1 ? "s" : ""
        }.`
      );
      await dispatch(fetchDashboardData());
    } catch (error) {
      setPreventionError(error.message || "Unable to create escalation prevention plans");
    } finally {
      setActivatingPrevention(false);
    }
  };

  const activateControlTowerReview = async () => {
    if (!controlTowerWeekKey) {
      setControlTowerError("Unable to determine current operating week for control tower review.");
      return;
    }

    if (controlTowerOpenReviewCount > 0) {
      setControlTowerError("");
      setControlTowerNotice("This week already has an open governance control tower review task.");
      return;
    }

    const reviewerId = currentUser?.id || null;
    const reviewerName =
      currentUser?.full_name || currentUser?.fullName || currentUser?.email || "Manager";
    const dueAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();

    try {
      setActivatingControlTower(true);
      setControlTowerError("");
      setControlTowerNotice("");
      await crmApi.createActivity({
        type: "task",
        subject: `Operating review: Governance control tower (${controlTowerWeekKey})`,
        notes: `Step 15 unified control tower review. Health score ${controlTowerSummary.healthScore} (${controlTowerSummary.healthBand}). Actions: ${controlTowerSummary.actions.join(
          " | "
        )}`,
        userId: reviewerId,
        dueAt,
      });
      setControlTowerCount(1);
      setControlTowerAt(new Date().toISOString());
      setControlTowerNotice(`Created weekly control tower review task for ${reviewerName}.`);
      await dispatch(fetchDashboardData());
    } catch (error) {
      setControlTowerError(error.message || "Unable to create control tower review task");
    } finally {
      setActivatingControlTower(false);
    }
  };

  const reportErrorMessage =
    scenarioActivationError ||
    coachingActivationError ||
    approvalError ||
    escalationError ||
    escalationResolutionError ||
    preventionError ||
    controlTowerError;

  if (loading && !dashboard) {
    return (
      <AppShell title="Reports" subtitle="Loading reports center...">
        <LoadingState label="Loading reports..." />
      </AppShell>
    );
  }

  if (!leads.length && !deals.length && !customers.length) {
    return (
      <AppShell
        title="Reports"
        subtitle="Generate executive snapshots and export performance summaries across your workspace."
      >
        <Card>
          <EmptyState
            title="No report data yet"
            description="Reports populate automatically as leads, customers, and deals are created."
          />
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Reports"
      subtitle="Generate executive snapshots and export performance summaries across your workspace."
    >
      <ErrorBanner message={reportErrorMessage} />

      <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-6">
        <KpiCard
          label="Won revenue"
          value={formatCompactCurrency(kpis.wonRevenue)}
          detail="Closed-won revenue captured"
        />
        <KpiCard
          label="Open deals"
          value={kpis.openDeals}
          detail="Currently active opportunities"
        />
        <KpiCard label="Leads" value={kpis.totalLeads} detail="Total prospects in funnel" />
        <KpiCard
          label="Customers"
          value={kpis.totalCustomers}
          detail="Converted accounts in CRM"
        />
        <KpiCard
          label="Commit forecast"
          value={formatCompactCurrency(kpis.commitValue)}
          detail="High-confidence near-term pipeline"
        />
        <KpiCard
          label="Best case"
          value={formatCompactCurrency(kpis.bestCaseValue)}
          detail="Upside opportunities still in play"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <RevenueLineChart data={revenueSeries} />
        <StatusBarChart data={leadDistribution} />
      </div>

      <div className="mt-6">
        <Card>
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">Step 6: Scenario Planning</div>
              <h3 className="mt-2 text-lg font-semibold text-[var(--text-primary)]">Forecast what-if simulator</h3>
              <p className="text-sm text-[var(--text-secondary)]">
                Model outcome lift from win-rate improvement, risk recovery, and net-new qualified pipeline.
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={exportScenarioPlanner}>
              Export scenario CSV
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <div className="mb-1 text-xs uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                Close-rate lift (%)
              </div>
              <Input
                type="number"
                min="0"
                max="50"
                value={scenarioCloseLift}
                onChange={(event) => setScenarioCloseLift(event.target.value)}
              />
            </div>
            <div>
              <div className="mb-1 text-xs uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                Risk recovery (%)
              </div>
              <Input
                type="number"
                min="0"
                max="80"
                value={scenarioRiskRecovery}
                onChange={(event) => setScenarioRiskRecovery(event.target.value)}
              />
            </div>
            <div>
              <div className="mb-1 text-xs uppercase tracking-[0.14em] text-[var(--text-secondary)]">
                New qualified pipeline ($)
              </div>
              <Input
                type="number"
                min="0"
                step="1000"
                value={scenarioPipelineAdd}
                onChange={(event) => setScenarioPipelineAdd(event.target.value)}
              />
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-sm text-[var(--text-secondary)]">
              Weighted forecast: <span className="font-semibold text-[var(--text-primary)]">{formatCompactCurrency(scenarioPlanner.baselineWeighted)}</span>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-sm text-[var(--text-secondary)]">
              Projected weighted: <span className="font-semibold text-[var(--text-primary)]">{formatCompactCurrency(scenarioPlanner.projectedWeighted)}</span>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-sm text-[var(--text-secondary)]">
              Weighted upside: <span className="font-semibold text-[var(--text-primary)]">{formatCompactCurrency(scenarioPlanner.weightedDelta)}</span>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-sm text-[var(--text-secondary)]">
              At-risk exposure: <span className="font-semibold text-[var(--text-primary)]">{formatCompactCurrency(scenarioPlanner.atRiskExposure)}</span>
            </div>
          </div>

          {scenarioPlanner.topPlays.length ? (
            <div className="mt-4 grid gap-3">
              {scenarioPlanner.topPlays.map((entry) => (
                <div
                  key={`scenario-${entry.deal.id}`}
                  className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-semibold text-[var(--text-primary)]">{entry.deal.title}</div>
                      <Badge tone={entry.risk.tone}>{entry.risk.label} {entry.risk.score}</Badge>
                    </div>
                    <div className="mt-1 text-xs text-[var(--text-secondary)]">
                      Prob: {entry.probability}% {"->"} {Math.round(entry.projectedProbability)}% {"|"} Owner: {entry.deal.owner_name || "Unassigned"}
                    </div>
                  </div>

                  <div className="text-sm text-[var(--text-secondary)]">
                    Projected weighted lift: <span className="font-semibold text-[var(--text-primary)]">{formatCompactCurrency(entry.totalLiftWeighted)}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4">
              <EmptyState
                title="No open deals for scenario planning"
                description="Open opportunities will appear here with projected weighted upside actions."
              />
            </div>
          )}
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">Step 7: Scenario Activation Queue</div>
              <h3 className="mt-2 text-lg font-semibold text-[var(--text-primary)]">Push top plays to execution</h3>
              <p className="text-sm text-[var(--text-secondary)]">
                Create owner tasks for the highest-impact scenario opportunities so modeled upside turns into action.
              </p>
            </div>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={activateScenarioRecovery}
              disabled={activatingScenario || !scenarioTaskQueue.length}
            >
              {activatingScenario
                ? "Activating..."
                : `Create recovery tasks (${scenarioPendingQueueCount})`}
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-sm text-[var(--text-secondary)]">
              Candidate plays: <span className="font-semibold text-[var(--text-primary)]">{scenarioTaskQueue.length}</span>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-sm text-[var(--text-secondary)]">
              Pending tasks: <span className="font-semibold text-[var(--text-primary)]">{scenarioPendingQueueCount}</span>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-sm text-[var(--text-secondary)]">
              Due window: <span className="font-semibold text-[var(--text-primary)]">{scenarioTaskDueDays} days</span>
            </div>
          </div>

          {scenarioActivationNotice ? (
            <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-xs text-[var(--text-secondary)]">
              {scenarioActivationNotice}
              {scenarioActivationAt
                ? ` Last run ${formatDateTime(scenarioActivationAt)}${
                    scenarioActivationCount ? ` (${scenarioActivationCount} tasks).` : ""
                  }`
                : ""}
            </div>
          ) : null}

          {scenarioTaskQueue.length ? (
            <div className="mt-4 grid gap-3">
              {scenarioTaskQueue.map((entry) => (
                <div
                  key={`scenario-queue-${entry.deal.id}`}
                  className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm font-semibold text-[var(--text-primary)]">{entry.deal.title}</div>
                      <Badge tone={entry.risk.tone}>{entry.risk.label} {entry.risk.score}</Badge>
                      <Badge tone={entry.alreadyQueued ? "info" : "warning"}>
                        {entry.alreadyQueued ? "Queued" : "Pending"}
                      </Badge>
                    </div>
                    <div className="mt-1 text-xs text-[var(--text-secondary)]">
                      Owner: {entry.deal.owner_name || "Unassigned"} {"|"} Projected lift: {formatCompactCurrency(entry.totalLiftWeighted)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4">
              <EmptyState
                title="No scenario activation candidates"
                description="Top scenario plays will appear here once open opportunities are available."
              />
            </div>
          )}
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">Step 8: Outcome Attribution</div>
              <h3 className="mt-2 text-lg font-semibold text-[var(--text-primary)]">Scenario impact tracker</h3>
              <p className="text-sm text-[var(--text-secondary)]">
                Monitors whether scenario recovery tasks are getting completed and how much won revenue they influence.
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={exportScenarioOutcomes}>
              Export outcome CSV
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-sm text-[var(--text-secondary)]">
              Scenario tasks: <span className="font-semibold text-[var(--text-primary)]">{scenarioOutcome.totalTasks}</span>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-sm text-[var(--text-secondary)]">
              Completion rate: <span className="font-semibold text-[var(--text-primary)]">{scenarioOutcome.completionRate}%</span>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-sm text-[var(--text-secondary)]">
              Completed (7d): <span className="font-semibold text-[var(--text-primary)]">{scenarioOutcome.completedLast7d}</span>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-sm text-[var(--text-secondary)]">
              Influenced won deals: <span className="font-semibold text-[var(--text-primary)]">{scenarioOutcome.influencedWonCount}</span>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-sm text-[var(--text-secondary)]">
              Influenced won revenue: <span className="font-semibold text-[var(--text-primary)]">{formatCompactCurrency(scenarioOutcome.influencedWonRevenue)}</span>
            </div>
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-sm text-[var(--text-secondary)]">
              Open influenced deals: <span className="font-semibold text-[var(--text-primary)]">{scenarioOutcome.influencedOpenCount}</span>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-sm text-[var(--text-secondary)]">
              Lost influenced deals: <span className="font-semibold text-[var(--text-primary)]">{scenarioOutcome.influencedLostCount}</span>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-sm text-[var(--text-secondary)]">
              Overdue scenario tasks: <span className="font-semibold text-[var(--text-primary)]">{scenarioOutcome.overdueTasks}</span>
            </div>
          </div>

          {scenarioOutcome.ownerRows.length ? (
            <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--border)]">
              <div className="grid grid-cols-[1.2fr_0.7fr_0.8fr_0.9fr_0.9fr] bg-[var(--bg-base)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)]">
                <div>Owner</div>
                <div>Tasks</div>
                <div>Done</div>
                <div>Completion</div>
                <div>Won revenue</div>
              </div>
              <div className="divide-y divide-[var(--border)]">
                {scenarioOutcome.ownerRows.map((row) => (
                  <div
                    key={`scenario-owner-${row.ownerName}`}
                    className="grid grid-cols-[1.2fr_0.7fr_0.8fr_0.9fr_0.9fr] items-center px-4 py-3 text-sm"
                  >
                    <div className="font-semibold text-[var(--text-primary)]">{row.ownerName}</div>
                    <div className="text-[var(--text-secondary)]">{row.tasks}</div>
                    <div className="text-[var(--text-secondary)]">{row.completed}</div>
                    <div>
                      <Badge tone={row.completionRate >= 65 ? "success" : row.completionRate >= 35 ? "warning" : "danger"}>
                        {row.completionRate}%
                      </Badge>
                    </div>
                    <div className="font-semibold text-[var(--text-primary)]">{formatCompactCurrency(row.wonRevenue)}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <EmptyState
                title="No scenario outcome data yet"
                description="Create scenario recovery tasks and complete follow-ups to populate attribution metrics."
              />
            </div>
          )}

          {scenarioOutcome.recentRows.length ? (
            <div className="mt-4 grid gap-3">
              {scenarioOutcome.recentRows.map((row) => (
                <div
                  key={`scenario-outcome-${row.id}`}
                  className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="text-sm font-semibold text-[var(--text-primary)]">{row.subject}</div>
                    <div className="mt-1 text-xs text-[var(--text-secondary)]">
                      {row.dealTitle} {"|"} Owner: {row.ownerName}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
                    <Badge tone={toneByDealStatus[row.dealStatus] || "neutral"}>{row.dealStatus}</Badge>
                    <Badge tone={row.completedAt ? "success" : row.overdue ? "danger" : "warning"}>
                      {row.completedAt ? "Completed" : row.overdue ? "Overdue" : "Open"}
                    </Badge>
                    <span>
                      {row.completedAt
                        ? `Done ${formatDateTime(row.completedAt)}`
                        : row.dueAt
                        ? `Due ${formatDateTime(row.dueAt)}`
                        : "No due date"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">Step 9: Team Benchmarking</div>
              <h3 className="mt-2 text-lg font-semibold text-[var(--text-primary)]">Execution coaching board</h3>
              <p className="text-sm text-[var(--text-secondary)]">
                Benchmarks each owner on scenario execution and surfaces targeted coaching actions.
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={exportScenarioBenchmarks}>
              Export benchmark CSV
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-sm text-[var(--text-secondary)]">
              Team avg completion: <span className="font-semibold text-[var(--text-primary)]">{scenarioBenchmark.teamAvgCompletion}%</span>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-sm text-[var(--text-secondary)]">
              Team avg won revenue: <span className="font-semibold text-[var(--text-primary)]">{formatCompactCurrency(scenarioBenchmark.teamAvgWonRevenue)}</span>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-sm text-[var(--text-secondary)]">
              Benchmark leader: <span className="font-semibold text-[var(--text-primary)]">{scenarioBenchmark.topOwnerName}</span>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-sm text-[var(--text-secondary)]">
              Needs support: <span className="font-semibold text-[var(--text-primary)]">{scenarioBenchmark.needsSupportCount}</span>
            </div>
          </div>

          {scenarioBenchmark.leagueRows.length ? (
            <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--border)]">
              <div className="grid grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr_0.9fr_0.9fr] bg-[var(--bg-base)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)]">
                <div>Owner</div>
                <div>Tier</div>
                <div>Score</div>
                <div>Completion</div>
                <div>Overdue</div>
                <div>Won revenue</div>
              </div>
              <div className="divide-y divide-[var(--border)]">
                {scenarioBenchmark.leagueRows.map((row) => (
                  <div
                    key={`benchmark-${row.ownerName}`}
                    className="grid grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr_0.9fr_0.9fr] items-center px-4 py-3 text-sm"
                  >
                    <div className="font-semibold text-[var(--text-primary)]">{row.ownerName}</div>
                    <div>
                      <Badge tone={toneByBenchmarkTier[row.tier] || "neutral"}>{row.tier.replace("_", " ")}</Badge>
                    </div>
                    <div className="font-semibold text-[var(--text-primary)]">{row.benchmarkScore}</div>
                    <div className="text-[var(--text-secondary)]">{row.completionRate}%</div>
                    <div className="text-[var(--text-secondary)]">{row.overdue}</div>
                    <div className="font-semibold text-[var(--text-primary)]">{formatCompactCurrency(row.wonRevenue)}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-4">
              <EmptyState
                title="No benchmark data yet"
                description="Owner benchmarking appears after scenario recovery tasks are created."
              />
            </div>
          )}

          {scenarioBenchmark.coachingRows.length ? (
            <div className="mt-4 grid gap-3">
              {scenarioBenchmark.coachingRows.map((row) => (
                <div
                  key={`coaching-${row.ownerName}`}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-semibold text-[var(--text-primary)]">{row.ownerName}</div>
                    <Badge tone={toneByBenchmarkTier[row.tier] || "neutral"}>{row.tier.replace("_", " ")}</Badge>
                    <span className="text-xs text-[var(--text-secondary)]">Score {row.benchmarkScore}</span>
                  </div>
                  <div className="mt-2 text-sm text-[var(--text-secondary)]">{row.recommendation}</div>
                </div>
              ))}
            </div>
          ) : null}
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">Step 10: Coaching Automation</div>
              <h3 className="mt-2 text-lg font-semibold text-[var(--text-primary)]">Automated coaching assignments</h3>
              <p className="text-sm text-[var(--text-secondary)]">
                Converts benchmark gaps into weekly coaching tasks and digest-ready summaries.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={exportWeeklyBenchmarkDigest}>
                Export weekly digest CSV
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={activateCoachingAssignments}
                disabled={activatingCoaching || !coachingAssignmentQueue.length}
              >
                {activatingCoaching
                  ? "Assigning..."
                  : `Create coaching assignments (${pendingCoachingAssignments})`}
              </Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-sm text-[var(--text-secondary)]">
              Coaching candidates: <span className="font-semibold text-[var(--text-primary)]">{coachingAssignmentQueue.length}</span>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-sm text-[var(--text-secondary)]">
              Pending assignments: <span className="font-semibold text-[var(--text-primary)]">{pendingCoachingAssignments}</span>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-sm text-[var(--text-secondary)]">
              Coaching due window: <span className="font-semibold text-[var(--text-primary)]">{coachingAssignmentDueDays} days</span>
            </div>
          </div>

          {coachingActivationNotice ? (
            <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-xs text-[var(--text-secondary)]">
              {coachingActivationNotice}
              {coachingActivationAt
                ? ` Last run ${formatDateTime(coachingActivationAt)}${
                    coachingActivationCount ? ` (${coachingActivationCount} assignments).` : ""
                  }`
                : ""}
            </div>
          ) : null}

          {coachingAssignmentQueue.length ? (
            <div className="mt-4 grid gap-3">
              {coachingAssignmentQueue.map((row) => (
                <div
                  key={`coaching-queue-${row.ownerName}`}
                  className="rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] p-4"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="text-sm font-semibold text-[var(--text-primary)]">{row.ownerName}</div>
                    <Badge tone={toneByBenchmarkTier[row.tier] || "neutral"}>{row.tier.replace("_", " ")}</Badge>
                    <Badge tone={row.alreadyAssigned ? "info" : "warning"}>
                      {row.alreadyAssigned ? "Assigned" : "Pending"}
                    </Badge>
                    <span className="text-xs text-[var(--text-secondary)]">
                      Score {row.benchmarkScore} | Completion {row.completionRate}%
                    </span>
                  </div>
                  <div className="mt-2 text-sm text-[var(--text-secondary)]">{row.recommendation}</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4">
              <EmptyState
                title="No coaching automation candidates"
                description="Candidates appear when owner benchmarks drop or overdue task load increases."
              />
            </div>
          )}
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">Step 11: Manager Approval Workflow</div>
              <h3 className="mt-2 text-lg font-semibold text-[var(--text-primary)]">Approve coaching assignments and audit completion</h3>
              <p className="text-sm text-[var(--text-secondary)]">
                Lets managers approve selected coaching assignments and track completion with an audit trail.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={exportCoachingApprovalAudit}>
                Export approval audit CSV
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={approveSelectedCoachingAssignments}
                disabled={approvingCoaching || !approvalCandidates.length}
              >
                {approvingCoaching
                  ? "Approving..."
                  : `Approve selected (${selectedApprovalCandidates.length})`}
              </Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-sm text-[var(--text-secondary)]">
              Total assignments: <span className="font-semibold text-[var(--text-primary)]">{coachingAssignmentAudit.totalAssignments}</span>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-sm text-[var(--text-secondary)]">
              Approval rate: <span className="font-semibold text-[var(--text-primary)]">{coachingAssignmentAudit.approvalRate}%</span>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-sm text-[var(--text-secondary)]">
              Pending approval: <span className="font-semibold text-[var(--text-primary)]">{coachingAssignmentAudit.pendingApproval}</span>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-sm text-[var(--text-secondary)]">
              Completion rate: <span className="font-semibold text-[var(--text-primary)]">{coachingAssignmentAudit.completionRate}%</span>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-sm text-[var(--text-secondary)]">
              Overdue assignments: <span className="font-semibold text-[var(--text-primary)]">{coachingAssignmentAudit.overdueCount}</span>
            </div>
          </div>

          {approvalNotice ? (
            <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-xs text-[var(--text-secondary)]">
              {approvalNotice}
              {approvalAt
                ? ` Last run ${formatDateTime(approvalAt)}${
                    approvalCount ? ` (${approvalCount} approvals).` : ""
                  }`
                : ""}
            </div>
          ) : null}

          {approvalCandidates.length ? (
            <div className="mt-4 grid gap-3">
              {approvalCandidates.map((row) => {
                const checked = selectedApprovalOwners.includes(String(row.ownerName));
                return (
                  <label
                    key={`approval-candidate-${row.ownerName}`}
                    className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] p-4"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleApprovalOwnerSelection(row.ownerName)}
                      className="mt-1 h-4 w-4 accent-[var(--accent)]"
                    />
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-sm font-semibold text-[var(--text-primary)]">{row.ownerName}</div>
                        <Badge tone={toneByBenchmarkTier[row.tier] || "neutral"}>{row.tier.replace("_", " ")}</Badge>
                        <span className="text-xs text-[var(--text-secondary)]">
                          Score {row.benchmarkScore} | Overdue {row.overdue}
                        </span>
                      </div>
                      <div className="mt-1 text-sm text-[var(--text-secondary)]">{row.recommendation}</div>
                    </div>
                  </label>
                );
              })}
            </div>
          ) : (
            <div className="mt-4">
              <EmptyState
                title="No approval candidates"
                description="Pending coaching candidates will appear here for manager approval."
              />
            </div>
          )}

          {coachingAssignmentAudit.recentRows.length ? (
            <div className="mt-4 grid gap-3">
              {coachingAssignmentAudit.recentRows.map((row) => (
                <div
                  key={`approval-audit-${row.id}`}
                  className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="text-sm font-semibold text-[var(--text-primary)]">{row.ownerName}</div>
                    <div className="mt-1 text-xs text-[var(--text-secondary)]">
                      Assignee: {row.assigneeName} {"|"} Approved by: {row.approvedBy || "Unapproved"}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--text-secondary)]">
                    <Badge tone={toneByApprovalStatus[row.approvalStatus] || "neutral"}>{row.approvalStatus}</Badge>
                    <Badge tone={row.completedAt ? "success" : row.overdue ? "danger" : "warning"}>
                      {row.completedAt ? "Completed" : row.overdue ? "Overdue" : "Open"}
                    </Badge>
                    <span>
                      {row.approvedAt
                        ? `Approved ${formatDateTime(row.approvedAt)}`
                        : row.dueAt
                        ? `Due ${formatDateTime(row.dueAt)}`
                        : "No due date"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : null}
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">Step 12: Approval SLA and Escalation Routing</div>
              <h3 className="mt-2 text-lg font-semibold text-[var(--text-primary)]">Escalate unapproved or overdue coaching assignments</h3>
              <p className="text-sm text-[var(--text-secondary)]">
                Flags approval SLA breaches and routes escalation tasks for governance follow-through.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={exportCoachingSlaEscalations}>
                Export SLA escalation CSV
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={activateCoachingEscalations}
                disabled={escalatingCoaching || !coachingEscalationQueue.length}
              >
                {escalatingCoaching
                  ? "Escalating..."
                  : `Create escalations (${pendingEscalationCount})`}
              </Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-sm text-[var(--text-secondary)]">
              Approval SLA: <span className="font-semibold text-[var(--text-primary)]">{approvalSlaHours}h</span>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-sm text-[var(--text-secondary)]">
              SLA breaches: <span className="font-semibold text-[var(--text-primary)]">{approvalSlaBreachCount}</span>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-sm text-[var(--text-secondary)]">
              Overdue for escalation: <span className="font-semibold text-[var(--text-primary)]">{overdueEscalationCount}</span>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-sm text-[var(--text-secondary)]">
              Escalation queue: <span className="font-semibold text-[var(--text-primary)]">{coachingEscalationQueue.length}</span>
            </div>
          </div>

          {escalationNotice ? (
            <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-xs text-[var(--text-secondary)]">
              {escalationNotice}
              {escalationAt
                ? ` Last run ${formatDateTime(escalationAt)}${
                    escalationCount ? ` (${escalationCount} escalations).` : ""
                  }`
                : ""}
            </div>
          ) : null}

          {coachingEscalationQueue.length ? (
            <div className="mt-4 grid gap-3">
              {coachingEscalationQueue.map((row) => (
                <div
                  key={`sla-escalation-${row.id}`}
                  className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-semibold text-[var(--text-primary)]">{row.ownerName}</div>
                      <Badge tone={toneByApprovalStatus[row.approvalStatus] || "neutral"}>{row.approvalStatus}</Badge>
                      <Badge tone={row.alreadyEscalated ? "info" : "warning"}>
                        {row.alreadyEscalated ? "Escalated" : "Pending escalation"}
                      </Badge>
                    </div>
                    <div className="mt-1 text-xs text-[var(--text-secondary)]">
                      {(row.escalationReasons || []).join(" | ") || "Escalation trigger identified"}
                    </div>
                  </div>

                  <div className="text-xs text-[var(--text-secondary)]">
                    Open: {row.hoursOpen}h {"|"} Past due: {row.hoursPastDue}h
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4">
              <EmptyState
                title="No SLA escalations required"
                description="Approval flow is currently within SLA and overdue assignments are already routed."
              />
            </div>
          )}
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">Step 13: Escalation Resolution and SLA Trend</div>
              <h3 className="mt-2 text-lg font-semibold text-[var(--text-primary)]">Resolve escalations with acknowledgement and closure states</h3>
              <p className="text-sm text-[var(--text-secondary)]">
                Tracks escalation aging bands, allows acknowledgment and closure, and reports 4-week manager SLA compliance.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={exportEscalationResolutionAudit}>
                Export escalation resolution CSV
              </Button>
              <Button variant="secondary" size="sm" onClick={exportManagerSlaComplianceTrend}>
                Export SLA trend CSV
              </Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-sm text-[var(--text-secondary)]">
              Open escalations: <span className="font-semibold text-[var(--text-primary)]">{escalationResolution.openRows.length}</span>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-sm text-[var(--text-secondary)]">
              New: <span className="font-semibold text-[var(--text-primary)]">{escalationResolution.newCount}</span>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-sm text-[var(--text-secondary)]">
              Acknowledged: <span className="font-semibold text-[var(--text-primary)]">{escalationResolution.acknowledgedCount}</span>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-sm text-[var(--text-secondary)]">
              Closed: <span className="font-semibold text-[var(--text-primary)]">{escalationResolution.closedCount}</span>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-sm text-[var(--text-secondary)]">
              Critical aging: <span className="font-semibold text-[var(--text-primary)]">{escalationResolution.criticalCount}</span>
            </div>
          </div>

          <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-sm text-[var(--text-secondary)]">
            Manager SLA compliance (4 weeks): <span className="font-semibold text-[var(--text-primary)]">{managerSlaTrend.overallCompliance}%</span>
          </div>

          {managerSlaTrend.rows.length ? (
            <div className="mt-4 overflow-hidden rounded-2xl border border-[var(--border)]">
              <div className="grid grid-cols-[0.8fr_0.8fr_0.8fr_0.9fr_0.9fr] bg-[var(--bg-base)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)]">
                <div>Week</div>
                <div>Total</div>
                <div>Within SLA</div>
                <div>Approved</div>
                <div>Compliance</div>
              </div>
              <div className="divide-y divide-[var(--border)]">
                {managerSlaTrend.rows.map((row) => (
                  <div
                    key={`sla-trend-${weekKey(row.weekStart)}`}
                    className="grid grid-cols-[0.8fr_0.8fr_0.8fr_0.9fr_0.9fr] items-center px-4 py-3 text-sm"
                  >
                    <div className="font-semibold text-[var(--text-primary)]">{row.label}</div>
                    <div className="text-[var(--text-secondary)]">{row.totalAssignments}</div>
                    <div className="text-[var(--text-secondary)]">{row.approvedWithinSla}</div>
                    <div className="text-[var(--text-secondary)]">{row.approvedEventually}</div>
                    <div>
                      <Badge tone={row.complianceRate >= 75 ? "success" : row.complianceRate >= 50 ? "warning" : "danger"}>
                        {row.complianceRate}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {escalationResolutionNotice ? (
            <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-xs text-[var(--text-secondary)]">
              {escalationResolutionNotice}
              {escalationResolutionAt
                ? ` Last update ${formatDateTime(escalationResolutionAt)}${
                    escalationResolutionCount ? ` (${escalationResolutionCount} action).` : ""
                  }`
                : ""}
            </div>
          ) : null}

          {escalationResolution.openRows.length ? (
            <div className="mt-4 grid gap-3">
              {escalationResolution.openRows.map((row) => (
                <div
                  key={`escalation-resolution-${row.id}`}
                  className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-semibold text-[var(--text-primary)]">{row.ownerName}</div>
                      <Badge tone={toneByEscalationStatus[row.status] || "neutral"}>{row.status}</Badge>
                      <Badge tone={toneByAgingBand[row.agingBand] || "neutral"}>{row.agingBand}</Badge>
                    </div>
                    <div className="mt-1 text-xs text-[var(--text-secondary)]">
                      Open {row.hoursOpen}h {"|"} Due: {row.dueAt ? formatDateTime(row.dueAt) : "No due date"}
                      {row.acknowledgedBy ? ` | Acknowledged by ${row.acknowledgedBy}` : ""}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => acknowledgeEscalation(row)}
                      disabled={row.acknowledged || acknowledgingEscalationId === row.id}
                    >
                      {acknowledgingEscalationId === row.id ? "Acknowledging..." : row.acknowledged ? "Acknowledged" : "Acknowledge"}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => closeEscalation(row)}
                      disabled={closingEscalationId === row.id}
                    >
                      {closingEscalationId === row.id ? "Closing..." : "Close"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4">
              <EmptyState
                title="No open escalations"
                description="All escalations are either resolved or currently not required."
              />
            </div>
          )}
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">Step 14: Escalation Prevention Loop</div>
              <h3 className="mt-2 text-lg font-semibold text-[var(--text-primary)]">Turn resolved escalations into prevention plans</h3>
              <p className="text-sm text-[var(--text-secondary)]">
                Creates follow-up prevention plans for high-risk resolved escalations to reduce repeat incidents.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={exportEscalationPreventionLoop}>
                Export prevention loop CSV
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={activateEscalationPreventionPlans}
                disabled={activatingPrevention || !escalationPreventionLoop.candidateCount}
              >
                {activatingPrevention
                  ? "Creating plans..."
                  : `Create prevention plans (${escalationPreventionLoop.pendingCount})`}
              </Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-sm text-[var(--text-secondary)]">
              Candidates: <span className="font-semibold text-[var(--text-primary)]">{escalationPreventionLoop.candidateCount}</span>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-sm text-[var(--text-secondary)]">
              Coverage: <span className="font-semibold text-[var(--text-primary)]">{escalationPreventionLoop.coverageRate}%</span>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-sm text-[var(--text-secondary)]">
              Pending: <span className="font-semibold text-[var(--text-primary)]">{escalationPreventionLoop.pendingCount}</span>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-sm text-[var(--text-secondary)]">
              Active plans: <span className="font-semibold text-[var(--text-primary)]">{escalationPreventionLoop.openPlanCount}</span>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-sm text-[var(--text-secondary)]">
              Completed plans: <span className="font-semibold text-[var(--text-primary)]">{escalationPreventionLoop.completedPlanCount}</span>
            </div>
          </div>

          {preventionNotice ? (
            <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-xs text-[var(--text-secondary)]">
              {preventionNotice}
              {preventionAt
                ? ` Last run ${formatDateTime(preventionAt)}${
                    preventionCount ? ` (${preventionCount} plans).` : ""
                  }`
                : ""}
            </div>
          ) : null}

          {escalationPreventionLoop.rows.length ? (
            <div className="mt-4 grid gap-3">
              {escalationPreventionLoop.rows.map((row) => (
                <div
                  key={`prevention-loop-${row.id}`}
                  className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] p-4 md:flex-row md:items-center md:justify-between"
                >
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-sm font-semibold text-[var(--text-primary)]">{row.ownerName}</div>
                      <Badge tone={toneByAgingBand[row.agingBand] || "neutral"}>{row.agingBand}</Badge>
                      <Badge tone={toneByPreventionStatus[row.planStatus] || "neutral"}>{row.planStatus}</Badge>
                    </div>
                    <div className="mt-1 text-xs text-[var(--text-secondary)]">
                      Escalation {row.id} closed {row.completedAt ? formatDateTime(row.completedAt) : "recently"}
                    </div>
                    <div className="mt-2 text-sm text-[var(--text-secondary)]">{row.suggestedAction}</div>
                  </div>

                  <div className="text-xs text-[var(--text-secondary)]">Open duration: {row.hoursOpen}h</div>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4">
              <EmptyState
                title="No prevention loop candidates"
                description="Resolved high-risk escalations will appear here for prevention planning."
              />
            </div>
          )}
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">Step 15: Unified Control Tower</div>
              <h3 className="mt-2 text-lg font-semibold text-[var(--text-primary)]">Weekly governance health review</h3>
              <p className="text-sm text-[var(--text-secondary)]">
                Consolidates execution, approval, escalation, and prevention into a single operational health score.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={exportControlTowerSummary}>
                Export control tower CSV
              </Button>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={activateControlTowerReview}
                disabled={activatingControlTower}
              >
                {activatingControlTower
                  ? "Scheduling review..."
                  : `Create weekly review (${controlTowerOpenReviewCount})`}
              </Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-sm text-[var(--text-secondary)]">
              Health score: <span className="font-semibold text-[var(--text-primary)]">{controlTowerSummary.healthScore}</span>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-sm text-[var(--text-secondary)]">
              Scenario execution: <span className="font-semibold text-[var(--text-primary)]">{controlTowerSummary.scenarioExecution}%</span>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-sm text-[var(--text-secondary)]">
              Approval compliance: <span className="font-semibold text-[var(--text-primary)]">{controlTowerSummary.approvalCompliance}%</span>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-sm text-[var(--text-secondary)]">
              Escalation resolution: <span className="font-semibold text-[var(--text-primary)]">{controlTowerSummary.escalationResolutionRate}%</span>
            </div>
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-sm text-[var(--text-secondary)]">
              Prevention coverage: <span className="font-semibold text-[var(--text-primary)]">{controlTowerSummary.preventionCoverage}%</span>
            </div>
          </div>

          <div className="mt-4">
            <Badge
              tone={
                controlTowerSummary.healthBand === "strong"
                  ? "success"
                  : controlTowerSummary.healthBand === "watch"
                  ? "warning"
                  : "danger"
              }
            >
              Health band: {controlTowerSummary.healthBand}
            </Badge>
          </div>

          {controlTowerNotice ? (
            <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-xs text-[var(--text-secondary)]">
              {controlTowerNotice}
              {controlTowerAt
                ? ` Last run ${formatDateTime(controlTowerAt)}${
                    controlTowerCount ? ` (${controlTowerCount} review).` : ""
                  }`
                : ""}
            </div>
          ) : null}

          <div className="mt-4 grid gap-3">
            {controlTowerSummary.actions.map((action, index) => (
              <div
                key={`control-tower-action-${index + 1}`}
                className="rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] p-4 text-sm text-[var(--text-secondary)]"
              >
                {action}
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">Stage performance</h3>
              <p className="text-sm text-[var(--text-secondary)]">
                Volume, value, and probability profile across pipeline stages.
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={exportStagePerformance}>
              Export CSV
            </Button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[var(--border)]">
            <div className="grid grid-cols-[1fr_0.7fr_0.9fr_0.8fr] bg-[var(--bg-base)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)]">
              <div>Stage</div>
              <div>Deals</div>
              <div>Total value</div>
              <div>Avg probability</div>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {stageRows.map((row) => (
                <div
                  key={row.stage}
                  className="grid grid-cols-[1fr_0.7fr_0.9fr_0.8fr] items-center px-4 py-3 text-sm"
                >
                  <div>
                    <Badge tone={toneByStage[row.stage] || "info"}>
                      {stageLabels[row.stage] || row.stage}
                    </Badge>
                  </div>
                  <div className="text-[var(--text-secondary)]">{row.count}</div>
                  <div className="font-semibold text-[var(--text-primary)]">
                    {formatCompactCurrency(row.totalValue)}
                  </div>
                  <div className="text-[var(--text-secondary)]">{row.avgProbability}%</div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        <Card>
          <div className="mb-4">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">Export center</h3>
            <p className="text-sm text-[var(--text-secondary)]">
              Download report-ready snapshots for leadership and operations review.
            </p>
          </div>

          <div className="space-y-3">
            <Button className="w-full" onClick={exportExecutiveSummary}>
              Export executive summary
            </Button>
            <Button className="w-full" variant="secondary" onClick={exportTeamPerformance}>
              Export team performance
            </Button>
            <Button className="w-full" variant="secondary" onClick={exportStagePerformance}>
              Export stage performance
            </Button>
            <Button className="w-full" variant="secondary" onClick={exportForecastRollup}>
              Export forecast rollup
            </Button>
            <Button className="w-full" variant="secondary" onClick={exportManagerWeeklyDigest}>
              Export manager weekly digest
            </Button>
          </div>

          <div className="mt-4 rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-xs text-[var(--text-secondary)]">
            Last export: {lastExportAt ? formatDateTime(lastExportAt) : "Not generated yet"}
          </div>
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">Step 3: Revenue Cadence</div>
              <h3 className="mt-2 text-lg font-semibold text-[var(--text-primary)]">Manager weekly digest</h3>
              <p className="text-sm text-[var(--text-secondary)]">
                Weekly owner-level summary for open pipeline, forecast quality, and recent wins.
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={exportManagerWeeklyDigest}>
              Export CSV
            </Button>
          </div>

          <div className="mb-3 rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-xs text-[var(--text-secondary)]">
            Manager digest mode: <span className="font-semibold text-[var(--text-primary)]">{managerWeeklyDigest ? "Enabled" : "Disabled"}</span>
          </div>

          {managerDigestRows.length ? (
            <div className="overflow-hidden rounded-2xl border border-[var(--border)]">
              <div className="grid grid-cols-[1.2fr_0.7fr_0.9fr_0.7fr_0.9fr_0.7fr_0.9fr] bg-[var(--bg-base)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)]">
                <div>Owner</div>
                <div>Open</div>
                <div>Open value</div>
                <div>Commit</div>
                <div>Best case</div>
                <div>Won 7d</div>
                <div>Won rev 7d</div>
              </div>
              <div className="divide-y divide-[var(--border)]">
                {managerDigestRows.slice(0, 12).map((row) => (
                  <div
                    key={row.ownerId}
                    className="grid grid-cols-[1.2fr_0.7fr_0.9fr_0.7fr_0.9fr_0.7fr_0.9fr] items-center px-4 py-3 text-sm"
                  >
                    <div className="font-semibold text-[var(--text-primary)]">{row.ownerName}</div>
                    <div className="text-[var(--text-secondary)]">{row.openDeals}</div>
                    <div className="font-semibold text-[var(--text-primary)]">{formatCompactCurrency(row.openValue)}</div>
                    <div className="text-[var(--text-secondary)]">{row.commitDeals}</div>
                    <div className="text-[var(--text-secondary)]">{row.bestCaseDeals}</div>
                    <div className="text-[var(--text-secondary)]">{row.wonThisWeek}</div>
                    <div className="font-semibold text-[var(--text-primary)]">{formatCompactCurrency(row.wonRevenueThisWeek)}</div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState
              title="No manager digest data yet"
              description="Assign open deals to owners and move opportunities to won to generate digest rows."
            />
          )}
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-xs uppercase tracking-[0.16em] text-[var(--text-muted)]">Step 1: Forecasting</div>
              <h3 className="mt-2 text-lg font-semibold text-[var(--text-primary)]">Forecast rollup</h3>
              <p className="text-sm text-[var(--text-secondary)]">
                Commit, best-case, and pipeline segmentation for executive call prep.
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={exportForecastRollup}>
              Export CSV
            </Button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[var(--border)]">
            <div className="grid grid-cols-[1fr_0.7fr_0.9fr_0.9fr] bg-[var(--bg-base)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)]">
              <div>Bucket</div>
              <div>Count</div>
              <div>Value</div>
              <div>Weighted</div>
            </div>
            <div className="divide-y divide-[var(--border)]">
              {forecastRows.map((row) => (
                <div
                  key={row.bucket}
                  className="grid grid-cols-[1fr_0.7fr_0.9fr_0.9fr] items-center px-4 py-3 text-sm"
                >
                  <div className="font-semibold text-[var(--text-primary)]">{row.label}</div>
                  <div className="text-[var(--text-secondary)]">{row.count}</div>
                  <div className="font-semibold text-[var(--text-primary)]">{formatCompactCurrency(row.value)}</div>
                  <div className="text-[var(--text-secondary)]">{formatCompactCurrency(row.weightedValue)}</div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-6">
        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">Team performance</h3>
              <p className="text-sm text-[var(--text-secondary)]">
                Revenue and win-rate by owner from current deal records.
              </p>
            </div>
            <Button variant="secondary" size="sm" onClick={exportTeamPerformance}>
              Export CSV
            </Button>
          </div>

          {ownerRows.length ? (
            <div className="overflow-hidden rounded-2xl border border-[var(--border)]">
              <div className="grid grid-cols-[1.3fr_0.7fr_0.7fr_0.8fr_0.9fr] bg-[var(--bg-base)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--text-secondary)]">
                <div>Owner</div>
                <div>Deals</div>
                <div>Won</div>
                <div>Win rate</div>
                <div>Revenue</div>
              </div>
              <div className="divide-y divide-[var(--border)]">
                {ownerRows.map((row) => (
                  <div
                    key={row.ownerId}
                    className="grid grid-cols-[1.3fr_0.7fr_0.7fr_0.8fr_0.9fr] items-center px-4 py-3 text-sm"
                  >
                    <div className="font-semibold text-[var(--text-primary)]">{row.ownerName}</div>
                    <div className="text-[var(--text-secondary)]">{row.deals}</div>
                    <div className="text-[var(--text-secondary)]">{row.wonDeals}</div>
                    <div>
                      <Badge tone={row.winRate >= 35 ? "success" : row.winRate >= 20 ? "warning" : "danger"}>
                        {row.winRate}%
                      </Badge>
                    </div>
                    <div className="font-semibold text-[var(--text-primary)]">
                      {formatCompactCurrency(row.revenue)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState
              title="No team performance yet"
              description="Assign deals to owners to generate team-level performance data."
            />
          )}
        </Card>
      </div>
    </AppShell>
  );
}
