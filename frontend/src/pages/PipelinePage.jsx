import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import crmApi from "../api/crmApi";
import { AppShell } from "../components/layout/AppShell";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Badge } from "../components/ui/Badge";
import { Modal } from "../components/ui/Modal";
import { DealForm } from "../components/forms/DealForm";
import { KanbanBoard } from "../components/kanban/KanbanBoard";
import { DataTable } from "../components/tables/DataTable";
import { EmptyState } from "../components/common/EmptyState";
import { ErrorBanner } from "../components/common/ErrorBanner";
import { fetchDashboardData } from "../store";
import { formatCompactCurrency, formatDate, formatDateTime } from "../lib/formatters";
import {
  buildForecastSummary,
  getForecastBucket,
  getForecastBucketMeta,
} from "../lib/forecasting";
import { loadAppSettings, saveAppSettings } from "../lib/settings";
import { getDealRiskMeta, scoreDealSlipRisk } from "../lib/predictive";
import { useNavigate } from "../hooks/useNavigate";

const emptyDealForm = {
  title: "",
  customerId: "",
  leadId: "",
  ownerId: "",
  stage: "discovery",
  value: "",
  probability: "",
  expectedCloseDate: "",
};

const stageKeys = ["discovery", "proposal", "negotiation", "won", "lost"];

const stageLabels = {
  discovery: "Discovery",
  proposal: "Proposal",
  negotiation: "Negotiation",
  won: "Won",
  lost: "Lost",
};

const stageTones = {
  discovery: "info",
  proposal: "warning",
  negotiation: "warning",
  won: "success",
  lost: "danger",
};

const REVIEW_CADENCE_META = {
  weekly: { label: "Weekly", days: 7 },
  biweekly: { label: "Bi-weekly", days: 14 },
  monthly: { label: "Monthly", days: 30 },
};

function dealAgeDays(deal) {
  const baseline = deal.updated_at || deal.created_at;
  if (!baseline) return 0;
  const elapsedMs = Date.now() - new Date(baseline).getTime();
  return Math.floor(elapsedMs / (24 * 60 * 60 * 1000));
}

function isClosingSoon(deal, days = 21) {
  if (!deal.expected_close_date || deal.status !== "open") return false;
  const diffMs = new Date(deal.expected_close_date).getTime() - Date.now();
  return diffMs >= 0 && diffMs <= days * 24 * 60 * 60 * 1000;
}

function sortDeals(rows, sortBy) {
  const sorted = [...rows];

  sorted.sort((left, right) => {
    if (sortBy === "value_desc") {
      return Number(right.value || 0) - Number(left.value || 0);
    }

    if (sortBy === "probability_desc") {
      return Number(right.probability || 0) - Number(left.probability || 0);
    }

    if (sortBy === "close_asc") {
      return (
        new Date(left.expected_close_date || "9999-12-31").getTime() -
        new Date(right.expected_close_date || "9999-12-31").getTime()
      );
    }

    return new Date(right.updated_at || 0).getTime() - new Date(left.updated_at || 0).getTime();
  });

  return sorted;
}

function getNextStage(stage) {
  const index = stageKeys.indexOf(stage);
  if (index < 0 || index >= stageKeys.length - 1) return null;
  return stageKeys[index + 1];
}

export function PipelinePage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { deals, customers, leads, users, activities } = useSelector((state) => state.crm);
  const user = useSelector((state) => state.auth.user);
  const appSettings = loadAppSettings();
  const followUpSlaDays = Number(appSettings.followUpSlaDays || 14);
  const cadenceKey = String(appSettings.forecastReviewCadence || "weekly");
  const cadenceMeta = REVIEW_CADENCE_META[cadenceKey] || REVIEW_CADENCE_META.weekly;
  const managerDigestEnabled = Boolean(appSettings.managerWeeklyDigest);

  const [query, setQuery] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("all");
  const [focusFilter, setFocusFilter] = useState("all");
  const [stageFilter, setStageFilter] = useState("all");
  const [forecastFilter, setForecastFilter] = useState("all");
  const [sortBy, setSortBy] = useState("updated_desc");
  const [viewMode, setViewMode] = useState(() => loadAppSettings().pipelineView || "list");

  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyDealForm);
  const [actionError, setActionError] = useState("");
  const [saving, setSaving] = useState(false);
  const [movingDealId, setMovingDealId] = useState(null);
  const [creatingTaskDealId, setCreatingTaskDealId] = useState(null);
  const [schedulingReviews, setSchedulingReviews] = useState(false);
  const [scheduledReviewCount, setScheduledReviewCount] = useState(0);
  const [selectedDealId, setSelectedDealId] = useState(null);

  const refreshWorkspace = async () => {
    await dispatch(fetchDashboardData());
  };

  const pipelineMetrics = useMemo(() => {
    const openDeals = deals.filter((deal) => deal.status === "open");
    const wonDeals = deals.filter((deal) => deal.status === "won");
    const lostDeals = deals.filter((deal) => deal.status === "lost");
    const pipelineValue = openDeals.reduce((sum, deal) => sum + Number(deal.value || 0), 0);
    const weightedForecast = openDeals.reduce(
      (sum, deal) => sum + Number(deal.value || 0) * (Number(deal.probability || 0) / 100),
      0
    );
    const nextClose = [...openDeals]
      .filter((deal) => deal.expected_close_date)
      .sort(
        (left, right) => new Date(left.expected_close_date).getTime() - new Date(right.expected_close_date).getTime()
      )[0];

    return {
      pipelineValue,
      weightedForecast,
      openCount: openDeals.length,
      wonCount: wonDeals.length,
      lostCount: lostDeals.length,
      nextClose,
      stalledCount: openDeals.filter((deal) => dealAgeDays(deal) >= followUpSlaDays).length,
    };
  }, [deals, followUpSlaDays]);

  const stageCounts = useMemo(() => {
    return stageKeys.reduce((result, stage) => {
      result[stage] = deals.filter((deal) => deal.stage === stage).length;
      return result;
    }, {});
  }, [deals]);

  const forecastSummary = useMemo(() => buildForecastSummary(deals), [deals]);

  const dealRiskById = useMemo(() => {
    const rows = deals
      .filter((deal) => String(deal.status || "") === "open")
      .map((deal) => [
        String(deal.id),
        scoreDealSlipRisk(deal, {
          followUpSlaDays,
        }),
      ]);

    return new Map(rows);
  }, [deals, followUpSlaDays]);

  const filteredDeals = useMemo(() => {
    const rows = deals.filter((deal) => {
      const matchesSearch =
        !query ||
        [deal.title, deal.customer_name, deal.lead_name, deal.owner_name].some((value) =>
          String(value || "").toLowerCase().includes(query.toLowerCase())
        );

      const matchesOwner =
        ownerFilter === "all" || String(deal.owner_id || "") === String(ownerFilter);

      const matchesFocus =
        focusFilter === "all" ||
        (focusFilter === "mine" && String(deal.owner_id || "") === String(user?.id || "")) ||
        (focusFilter === "stalled" && deal.status === "open" && dealAgeDays(deal) >= followUpSlaDays) ||
        (focusFilter === "at_risk" && (dealRiskById.get(String(deal.id))?.score || 0) >= 55) ||
        (focusFilter === "high_value" && Number(deal.value || 0) >= 100000) ||
        (focusFilter === "closing_soon" && isClosingSoon(deal));

      const matchesStage = stageFilter === "all" || String(deal.stage || "") === stageFilter;
      const matchesForecast =
        forecastFilter === "all" || getForecastBucket(deal) === forecastFilter;

      return matchesSearch && matchesOwner && matchesFocus && matchesStage && matchesForecast;
    });

    return sortDeals(rows, sortBy);
  }, [
    deals,
    focusFilter,
    followUpSlaDays,
    forecastFilter,
    dealRiskById,
    ownerFilter,
    query,
    sortBy,
    stageFilter,
    user?.id,
  ]);

  const selectedDeal = useMemo(() => {
    if (!selectedDealId) return null;
    return filteredDeals.find((deal) => String(deal.id) === String(selectedDealId)) || null;
  }, [filteredDeals, selectedDealId]);

  useEffect(() => {
    if (!filteredDeals.length) {
      if (selectedDealId !== null) {
        setSelectedDealId(null);
      }
      return;
    }

    const isSelectedVisible = filteredDeals.some(
      (deal) => String(deal.id) === String(selectedDealId)
    );

    if (!isSelectedVisible) {
      setSelectedDealId(filteredDeals[0].id);
    }
  }, [filteredDeals, selectedDealId]);

  const visibleStages = useMemo(() => {
    if (stageFilter === "all") return stageKeys;
    return [stageFilter];
  }, [stageFilter]);

  const activeFilterCount =
    (query ? 1 : 0) +
    (ownerFilter !== "all" ? 1 : 0) +
    (focusFilter !== "all" ? 1 : 0) +
    (stageFilter !== "all" ? 1 : 0) +
    (forecastFilter !== "all" ? 1 : 0);

  const followUpDeals = useMemo(() => {
    return filteredDeals
      .filter((deal) => deal.status === "open" && dealAgeDays(deal) >= followUpSlaDays)
      .sort((left, right) => dealAgeDays(right) - dealAgeDays(left))
      .slice(0, 5);
  }, [filteredDeals, followUpSlaDays]);

  const riskAlerts = useMemo(() => {
    return filteredDeals
      .map((deal) => ({
        deal,
        risk: dealRiskById.get(String(deal.id)) || getDealRiskMeta(0),
      }))
      .filter((entry) => ["critical", "high"].includes(entry.risk.band))
      .sort((left, right) => right.risk.score - left.risk.score)
      .slice(0, 6);
  }, [dealRiskById, filteredDeals]);

  const handleMoveDeal = async (dealId, stage) => {
    try {
      setMovingDealId(dealId);
      setActionError("");
      await crmApi.moveDeal(dealId, stage);
      await refreshWorkspace();
    } catch (error) {
      setActionError(error.message || "Unable to move deal");
    } finally {
      setMovingDealId(null);
    }
  };

  const handleOpenCreateModal = () => {
    setForm(emptyDealForm);
    setModalOpen(true);
  };

  const handleViewModeChange = async (nextViewMode) => {
    setViewMode(nextViewMode);

    const localSettings = loadAppSettings();
    const mergedSettings = saveAppSettings({
      ...localSettings,
      pipelineView: nextViewMode,
    });

    try {
      const response = await crmApi.updateMySettings(mergedSettings);
      if (response?.data) {
        saveAppSettings(response.data);
      }
    } catch {
      // Keep local preference even if remote sync is temporarily unavailable.
    }
  };

  const handleResetFilters = () => {
    setQuery("");
    setOwnerFilter("all");
    setFocusFilter("all");
    setStageFilter("all");
    setForecastFilter("all");
    setSortBy("updated_desc");
  };

  const handleCreateFollowUpTask = async (deal) => {
    if (!deal?.id) {
      return;
    }

    try {
      setCreatingTaskDealId(deal.id);
      setActionError("");

      const dueAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();

      await crmApi.createActivity({
        type: "task",
        subject: `Follow up: ${deal.title}`,
        notes: "Auto-generated follow-up from Pipeline execution queue.",
        relatedDealId: deal.id,
        userId: deal.owner_id || null,
        dueAt,
      });

      await refreshWorkspace();
    } catch (error) {
      setActionError(error.message || "Unable to create follow-up task");
    } finally {
      setCreatingTaskDealId(null);
    }
  };

  const handleScheduleForecastReviews = async () => {
    const openDeals = deals.filter((deal) => deal.status === "open");
    if (!openDeals.length) {
      setActionError("No open deals available for forecast review scheduling");
      return;
    }

    const dueAt = new Date(Date.now() + cadenceMeta.days * 24 * 60 * 60 * 1000).toISOString();
    const dueDateKey = new Date(dueAt).toDateString();
    const existingReminderKeys = new Set(
      activities
        .filter(
          (activity) =>
            !activity.completed_at &&
            String(activity.type || "") === "task" &&
            String(activity.subject || "").startsWith("Forecast review") &&
            new Date(activity.due_at || 0).toDateString() === dueDateKey
        )
        .map((activity) => `${String(activity.user_id || "")}-${String(activity.subject || "")}`)
    );

    const ownerMap = new Map();
    for (const deal of openDeals) {
      const resolvedOwnerId = deal.owner_id || user?.id || null;
      if (!resolvedOwnerId) {
        continue;
      }

      const key = String(resolvedOwnerId);
      const current = ownerMap.get(key) || {
        ownerId: resolvedOwnerId,
        deals: [],
      };
      current.deals.push(deal);
      ownerMap.set(key, current);
    }

    const createPayloads = [...ownerMap.values()]
      .map((entry) => {
        const subject = `Forecast review (${cadenceMeta.label})`;
        const dedupeKey = `${String(entry.ownerId)}-${subject}`;
        if (existingReminderKeys.has(dedupeKey)) {
          return null;
        }

        const commitCount = entry.deals.filter((deal) => getForecastBucket(deal) === "commit").length;
        const bestCaseCount = entry.deals.filter((deal) => getForecastBucket(deal) === "best_case").length;
        const pipelineCount = entry.deals.filter((deal) => getForecastBucket(deal) === "pipeline").length;
        const openValue = entry.deals.reduce((sum, deal) => sum + Number(deal.value || 0), 0);

        return {
          type: "task",
          subject,
          userId: entry.ownerId,
          dueAt,
          notes: `Auto-scheduled ${cadenceMeta.label.toLowerCase()} review. Open deals: ${entry.deals.length}. Commit: ${commitCount}, Best Case: ${bestCaseCount}, Pipeline: ${pipelineCount}. Open value: ${formatCompactCurrency(openValue)}.`,
        };
      })
      .filter(Boolean);

    if (!createPayloads.length) {
      setActionError("Forecast review reminders are already scheduled for the next cadence");
      return;
    }

    try {
      setSchedulingReviews(true);
      setActionError("");
      await Promise.all(createPayloads.map((payload) => crmApi.createActivity(payload)));
      setScheduledReviewCount(createPayloads.length);
      await refreshWorkspace();
    } catch (error) {
      setActionError(error.message || "Unable to schedule forecast review reminders");
    } finally {
      setSchedulingReviews(false);
    }
  };

  const inspectorSubtitle =
    selectedDeal?.customer_name || selectedDeal?.lead_name || "Unassigned account";

  return (
    <AppShell
      title="Pipeline"
      subtitle="Run opportunity flow with stage control, risk focus, and fast movement across your board."
    >
      <ErrorBanner message={actionError} />

      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-[var(--text-primary)]">Pipeline</h2>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">
            Move deals faster with stage-level visibility and a focused execution board.
          </p>
        </div>
        <Button onClick={handleOpenCreateModal}>+ Add Deal</Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">Open Pipeline</div>
          <div className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
            {formatCompactCurrency(pipelineMetrics.pipelineValue)}
          </div>
          <div className="mt-1 text-xs text-[var(--text-secondary)]">{pipelineMetrics.openCount} active deals</div>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">Weighted Forecast</div>
          <div className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
            {formatCompactCurrency(pipelineMetrics.weightedForecast)}
          </div>
          <div className="mt-1 text-xs text-[var(--text-secondary)]">Probability-adjusted projection</div>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">Win / Loss</div>
          <div className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
            {pipelineMetrics.wonCount} / {pipelineMetrics.lostCount}
          </div>
          <div className="mt-1 text-xs text-[var(--text-secondary)]">
            {pipelineMetrics.stalledCount} stalled deals need action
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-sm">
          <div className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">Next Expected Close</div>
          <div className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">
            {pipelineMetrics.nextClose ? formatDate(pipelineMetrics.nextClose.expected_close_date) : "No date"}
          </div>
          <div className="mt-1 truncate text-xs text-[var(--text-secondary)]">
            {pipelineMetrics.nextClose?.title || "No open deal has a close date"}
          </div>
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-5 shadow-sm">
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
          <Input
            placeholder="Search deal, account, or owner"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="xl:col-span-2"
          />

          <Select value={ownerFilter} onChange={(event) => setOwnerFilter(event.target.value)}>
            <option value="all">Owner (All)</option>
            {users.map((member) => (
              <option key={member.id} value={member.id}>
                {member.full_name}
              </option>
            ))}
          </Select>

          <Select value={focusFilter} onChange={(event) => setFocusFilter(event.target.value)}>
            <option value="all">Focus (All)</option>
            <option value="mine">My deals</option>
            <option value="stalled">Stalled {followUpSlaDays}+ days</option>
            <option value="at_risk">At risk (likely slip)</option>
            <option value="high_value">High value</option>
            <option value="closing_soon">Closing soon</option>
          </Select>

          <Select value={stageFilter} onChange={(event) => setStageFilter(event.target.value)}>
            <option value="all">All stages</option>
            <option value="discovery">Discovery</option>
            <option value="proposal">Proposal</option>
            <option value="negotiation">Negotiation</option>
            <option value="won">Won</option>
            <option value="lost">Lost</option>
          </Select>

          <Select value={forecastFilter} onChange={(event) => setForecastFilter(event.target.value)}>
            <option value="all">Forecast (All)</option>
            {forecastSummary.map((item) => (
              <option key={item.bucket} value={item.bucket}>
                {item.label}
              </option>
            ))}
          </Select>

          <div className="grid grid-cols-2 gap-3">
            <Select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
              <option value="updated_desc">Recently updated</option>
              <option value="value_desc">Value high-low</option>
              <option value="probability_desc">Probability high-low</option>
              <option value="close_asc">Earliest close date</option>
            </Select>
            <Select value={viewMode} onChange={(event) => handleViewModeChange(event.target.value)}>
              <option value="list">List view</option>
              <option value="board">Board view</option>
            </Select>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="text-sm text-[var(--text-secondary)]">
            Showing <span className="font-semibold text-[var(--text-primary)]">{filteredDeals.length}</span> deals
            {activeFilterCount
              ? ` with ${activeFilterCount} active filter${activeFilterCount > 1 ? "s" : ""}`
              : ""}
            .
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={activeFilterCount === 0 && sortBy === "updated_desc"}
            onClick={handleResetFilters}
          >
            Reset filters
          </Button>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-2">
        {stageKeys.map((stage) => (
          <button
            key={stage}
            type="button"
            onClick={() => setStageFilter((current) => (current === stage ? "all" : stage))}
            className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
              stageFilter === stage
                ? "bg-[var(--sidebar-active)] font-medium text-[var(--text-primary)]"
                : "text-[var(--text-secondary)] hover:bg-gray-100 dark:hover:bg-slate-700"
            }`}
          >
            <span className="capitalize">{stage}</span>
            <span className="rounded-full bg-[var(--bg-base)] px-2 py-0.5 text-xs">
              {stageCounts[stage] || 0}
            </span>
          </button>
        ))}
      </div>

      <div className="mt-6">
        {filteredDeals.length ? (
          viewMode === "board" ? (
            <KanbanBoard
              deals={filteredDeals}
              visibleStages={visibleStages}
              movingDealId={movingDealId}
              selectedDealId={selectedDealId}
              onDealSelect={(deal) => setSelectedDealId(deal.id)}
              onMove={handleMoveDeal}
              onCardClick={() => {}}
            />
          ) : (
            <Card>
              <DataTable
                rowKey="id"
                rows={filteredDeals}
                onRowClick={(deal) => setSelectedDealId(deal.id)}
                columns={[
                  {
                    key: "title",
                    label: "Deal",
                    render: (deal) => (
                      <div>
                        <div className="font-semibold text-[var(--text-primary)]">{deal.title}</div>
                        <div className="mt-1 text-xs text-[var(--text-secondary)]">
                          {deal.customer_name || deal.lead_name || "Unassigned account"}
                        </div>
                      </div>
                    ),
                  },
                  {
                    key: "stage",
                    label: "Stage",
                    render: (deal) => (
                      <Badge tone={stageTones[deal.stage] || "neutral"}>
                        {stageLabels[deal.stage] || deal.stage}
                      </Badge>
                    ),
                  },
                  {
                    key: "forecast",
                    label: "Forecast",
                    render: (deal) => {
                      const meta = getForecastBucketMeta(getForecastBucket(deal));
                      return <Badge tone={meta.tone}>{meta.label}</Badge>;
                    },
                  },
                  {
                    key: "value",
                    label: "Value",
                    render: (deal) => formatCompactCurrency(deal.value),
                  },
                  {
                    key: "probability",
                    label: "Probability",
                    render: (deal) => `${Number(deal.probability || 0)}%`,
                  },
                  {
                    key: "risk",
                    label: "Risk",
                    render: (deal) => {
                      const risk = dealRiskById.get(String(deal.id));
                      if (!risk) {
                        return <Badge tone="success">Low 0</Badge>;
                      }

                      return <Badge tone={risk.tone}>{risk.label} {risk.score}</Badge>;
                    },
                  },
                  {
                    key: "owner_name",
                    label: "Owner",
                    render: (deal) => deal.owner_name || "Unassigned",
                  },
                  {
                    key: "expected_close_date",
                    label: "Close",
                    render: (deal) => formatDate(deal.expected_close_date),
                  },
                ]}
              />
            </Card>
          )
        ) : (
          <Card>
            <EmptyState
              title="No deals in this view"
              description="Adjust filters or create a new deal to populate this board."
            />
          </Card>
        )}
      </div>

      <Card className="mt-6">
        <div className="text-xs uppercase tracking-[0.2em] text-[var(--text-secondary)]">
          Deal Inspector
        </div>

        {selectedDeal ? (
          <>
            <h3 className="mt-3 text-xl font-semibold text-[var(--text-primary)]">{selectedDeal.title}</h3>
            <div className="mt-2 text-sm text-[var(--text-secondary)]">{inspectorSubtitle}</div>

            <div className="mt-4 flex items-center gap-2">
              <Badge tone={stageTones[selectedDeal.stage] || "neutral"}>
                {stageLabels[selectedDeal.stage] || selectedDeal.stage}
              </Badge>
              <Badge tone={getForecastBucketMeta(getForecastBucket(selectedDeal)).tone}>
                {getForecastBucketMeta(getForecastBucket(selectedDeal)).label}
              </Badge>
              <Badge tone={dealRiskById.get(String(selectedDeal.id))?.tone || "success"}>
                {(dealRiskById.get(String(selectedDeal.id))?.label || "Low")} {(dealRiskById.get(String(selectedDeal.id))?.score || 0)}
              </Badge>
              <span className="rounded-full border border-[var(--border)] bg-[var(--bg-base)] px-2.5 py-1 text-xs text-[var(--text-secondary)]">
                {Number(selectedDeal.probability || 0)}%
              </span>
            </div>

            <div className="mt-5 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-[var(--text-secondary)]">
                Value: <span className="font-semibold text-[var(--text-primary)]">{formatCompactCurrency(selectedDeal.value)}</span>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-[var(--text-secondary)]">
                Owner: <span className="font-semibold text-[var(--text-primary)]">{selectedDeal.owner_name || "Unassigned"}</span>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-[var(--text-secondary)]">
                Expected close: <span className="font-semibold text-[var(--text-primary)]">{formatDate(selectedDeal.expected_close_date)}</span>
              </div>
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-[var(--text-secondary)]">
                Updated: <span className="font-semibold text-[var(--text-primary)]">{formatDateTime(selectedDeal.updated_at)}</span>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => navigate(`/pipeline/${selectedDeal.id}`)}>
                Open detail page
              </Button>

              {getNextStage(selectedDeal.stage) ? (
                <Button
                  onClick={() => handleMoveDeal(selectedDeal.id, getNextStage(selectedDeal.stage))}
                  disabled={movingDealId === selectedDeal.id}
                >
                  {movingDealId === selectedDeal.id
                    ? "Updating..."
                    : `Move to ${stageLabels[getNextStage(selectedDeal.stage)] || getNextStage(selectedDeal.stage)}`}
                </Button>
              ) : null}
            </div>
          </>
        ) : (
          <div className="mt-4">
            <EmptyState
              title="No deal selected"
              description="Pick a deal from the board or list to inspect value, owner, close date, and quick actions."
            />
          </div>
        )}
      </Card>

      <Card className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-[var(--text-secondary)]">
              Step 2: Execution Queue
            </div>
            <h3 className="mt-2 text-lg font-semibold text-[var(--text-primary)]">Stalled follow-up tasks</h3>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Create immediate follow-up activities for deals stalled {followUpSlaDays}+ days.
            </p>
          </div>
          <div className="rounded-full border border-[var(--border)] bg-[var(--bg-base)] px-3 py-1 text-xs text-[var(--text-secondary)]">
            {followUpDeals.length} in queue
          </div>
        </div>

        {followUpDeals.length ? (
          <div className="mt-4 grid gap-3">
            {followUpDeals.map((deal) => (
              <div
                key={deal.id}
                className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <div className="text-sm font-semibold text-[var(--text-primary)]">{deal.title}</div>
                  <div className="mt-1 text-xs text-[var(--text-secondary)]">
                    {deal.customer_name || deal.lead_name || "Unassigned account"} · {dealAgeDays(deal)} days since last update
                  </div>
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  disabled={creatingTaskDealId === deal.id}
                  onClick={() => handleCreateFollowUpTask(deal)}
                >
                  {creatingTaskDealId === deal.id ? "Creating..." : "Create follow-up task"}
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4">
            <EmptyState
              title="No stalled deals in this view"
              description={`Your filtered pipeline currently has no open deals older than ${followUpSlaDays} days.`}
            />
          </div>
        )}
      </Card>

      <Card className="mt-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-[var(--text-secondary)]">
              Step 3: Revenue Cadence
            </div>
            <h3 className="mt-2 text-lg font-semibold text-[var(--text-primary)]">Recurring forecast-review reminders</h3>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Generate {cadenceMeta.label.toLowerCase()} reminder tasks by owner/team using your saved cadence.
            </p>
          </div>

          <Button type="button" onClick={handleScheduleForecastReviews} disabled={schedulingReviews}>
            {schedulingReviews ? "Scheduling..." : `Schedule ${cadenceMeta.label} reminders`}
          </Button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-sm text-[var(--text-secondary)]">
            Cadence: <span className="font-semibold text-[var(--text-primary)]">{cadenceMeta.label}</span>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-sm text-[var(--text-secondary)]">
            Follow-up SLA: <span className="font-semibold text-[var(--text-primary)]">{followUpSlaDays} days</span>
          </div>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-sm text-[var(--text-secondary)]">
            Manager digest: <span className="font-semibold text-[var(--text-primary)]">{managerDigestEnabled ? "Enabled" : "Disabled"}</span>
          </div>
        </div>

        {scheduledReviewCount ? (
          <div className="mt-4 text-xs text-[var(--text-secondary)]">
            Scheduled {scheduledReviewCount} reminder{scheduledReviewCount > 1 ? "s" : ""} for the next cadence.
          </div>
        ) : null}
      </Card>

      <Card className="mt-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-[var(--text-secondary)]">Step 5: Predictive Prioritization</div>
            <h3 className="mt-2 text-lg font-semibold text-[var(--text-primary)]">Deal slip risk alerts</h3>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Highlights deals likely to slip based on stage/probability fit, stale age, and close-date pressure.
            </p>
          </div>
          <div className="rounded-full border border-[var(--border)] bg-[var(--bg-base)] px-3 py-1 text-xs text-[var(--text-secondary)]">
            {riskAlerts.length} high-risk deals
          </div>
        </div>

        {riskAlerts.length ? (
          <div className="mt-4 grid gap-3">
            {riskAlerts.map((entry) => (
              <div
                key={`risk-${entry.deal.id}`}
                className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--bg-base)] p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <div className="text-sm font-semibold text-[var(--text-primary)]">{entry.deal.title}</div>
                    <Badge tone={entry.risk.tone}>{entry.risk.label} {entry.risk.score}</Badge>
                  </div>
                  <div className="mt-1 text-xs text-[var(--text-secondary)]">
                    {(entry.risk.reasons || []).join(" | ") || "Risk signals detected"}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="secondary" onClick={() => setSelectedDealId(entry.deal.id)}>
                    Inspect
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={creatingTaskDealId === entry.deal.id}
                    onClick={() => handleCreateFollowUpTask(entry.deal)}
                  >
                    {creatingTaskDealId === entry.deal.id ? "Creating..." : "Create follow-up task"}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-4">
            <EmptyState
              title="No high-risk deals in this view"
              description="Current filters do not show deals with high or critical slip risk."
            />
          </div>
        )}
      </Card>

      <Modal open={modalOpen} title="Create deal" onClose={() => setModalOpen(false)}>
        <DealForm
          form={form}
          setForm={setForm}
          customers={customers}
          leads={leads}
          users={users}
          onSubmit={async () => {
            try {
              setSaving(true);
              setActionError("");
              await crmApi.createDeal({
                ...form,
                customerId: form.customerId || null,
                leadId: form.leadId || null,
                ownerId: form.ownerId || null,
                value: Number(form.value || 0),
                probability: Number(form.probability || 0),
              });
              await refreshWorkspace();
              setForm(emptyDealForm);
              setModalOpen(false);
            } catch (error) {
              setActionError(error.message || "Unable to create deal");
            } finally {
              setSaving(false);
            }
          }}
          submitLabel={saving ? "Saving..." : "Save deal"}
        />
      </Modal>
    </AppShell>
  );
}
