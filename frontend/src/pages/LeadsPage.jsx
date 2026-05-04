import { useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import crmApi from "../api/crmApi";
import { AppShell } from "../components/layout/AppShell";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Badge } from "../components/ui/Badge";
import { Modal } from "../components/ui/Modal";
import { LeadForm } from "../components/forms/LeadForm";
import { fetchDashboardData } from "../store";
import { formatCompactCurrency, formatDateTime } from "../lib/formatters";
import { canDeleteLeads } from "../lib/roles";
import { ErrorBanner } from "../components/common/ErrorBanner";
import { loadAppSettings, saveAppSettings } from "../lib/settings";
import { scoreLeadConversion } from "../lib/predictive";

const PAGE_SIZE = 20;

const emptyLeadForm = {
  name: "",
  email: "",
  phone: "",
  company: "",
  source: "",
  status: "new",
  assignedTo: "",
  estimatedValue: "",
  notes: "",
};

const emptyDrawerForm = {
  status: "new",
  assignedTo: "",
  notes: "",
};

const statusToneMap = {
  new: "info",
  contacted: "warning",
  qualified: "success",
  lost: "danger",
  converted: "success",
};

const dateRangeDays = {
  all: null,
  "7d": 7,
  "30d": 30,
  "90d": 90,
};

const tabKeys = {
  all: "all",
  mine: "mine",
  unassigned: "unassigned",
};

const activeLeadStatuses = new Set(["new", "contacted", "qualified"]);

const responseActivityTypes = new Set(["call", "email", "meeting", "task"]);

const slaToneMap = {
  met: "success",
  late: "warning",
  on_track: "info",
  due_soon: "warning",
  breach: "danger",
  escalated: "danger",
};

function matchesDateRange(lead, rangeKey) {
  const days = dateRangeDays[rangeKey];
  if (!days) return true;

  const baseline = lead.updated_at || lead.created_at;
  if (!baseline) return false;

  const ageMs = Date.now() - new Date(baseline).getTime();
  return ageMs <= days * 24 * 60 * 60 * 1000;
}

function getInitials(name = "Lead") {
  return String(name)
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function toTimestamp(value) {
  const parsed = new Date(value || 0).getTime();
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function diffHours(laterTs, earlierTs) {
  if (!laterTs || !earlierTs) return 0;
  return Math.max(0, (laterTs - earlierTs) / (1000 * 60 * 60));
}

function diffDays(laterTs, earlierTs) {
  if (!laterTs || !earlierTs) return 0;
  return Math.max(0, (laterTs - earlierTs) / (1000 * 60 * 60 * 24));
}

function buildLeadPayload(lead, overrides = {}) {
  return {
    name: overrides.name ?? lead.name ?? "",
    email: overrides.email ?? lead.email ?? "",
    phone: overrides.phone ?? lead.phone ?? "",
    company: overrides.company ?? lead.company ?? "",
    source: overrides.source ?? lead.source ?? "",
    status: overrides.status ?? lead.status ?? "new",
    assignedTo: overrides.assignedTo ?? lead.assigned_to ?? "",
    estimatedValue: Number(overrides.estimatedValue ?? lead.estimated_value ?? 0),
    notes: overrides.notes ?? lead.notes ?? "",
  };
}

function sortLeads(rows, sortBy) {
  const sorted = [...rows];

  sorted.sort((left, right) => {
    if (sortBy === "value_desc") {
      return Number(right.estimated_value || 0) - Number(left.estimated_value || 0);
    }

    if (sortBy === "name_asc") {
      return String(left.name || "").localeCompare(String(right.name || ""));
    }

    return (
      new Date(right.updated_at || right.created_at || 0).getTime() -
      new Date(left.updated_at || left.created_at || 0).getTime()
    );
  });

  return sorted;
}

export function LeadsPage() {
  const dispatch = useDispatch();
  const { leads, users, activities } = useSelector((state) => state.crm);
  const currentUser = useSelector((state) => state.auth.user);
  const appSettings = loadAppSettings();
  const leadResponseSlaHours = Number(appSettings.leadResponseSlaHours || 24);
  const leadEscalationHours = Number(appSettings.leadEscalationHours || 48);
  const followUpSlaDays = Number(appSettings.followUpSlaDays || 14);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [assignedFilter, setAssignedFilter] = useState("all");
  const [dateFilter, setDateFilter] = useState("all");
  const [sortBy, setSortBy] = useState(() => loadAppSettings().leadsSort || "updated_desc");
  const [activeTab, setActiveTab] = useState(tabKeys.all);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedLeadIds, setSelectedLeadIds] = useState([]);
  const [actionMenuLeadId, setActionMenuLeadId] = useState(null);

  const [drawerLead, setDrawerLead] = useState(null);
  const [drawerForm, setDrawerForm] = useState(emptyDrawerForm);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingLead, setEditingLead] = useState(null);
  const [form, setForm] = useState(emptyLeadForm);

  const [actionError, setActionError] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyLeadId, setBusyLeadId] = useState(null);

  const tabCounts = useMemo(() => {
    const mine = leads.filter((lead) => String(lead.assigned_to || "") === String(currentUser?.id || "")).length;
    const unassigned = leads.filter((lead) => !lead.assigned_to).length;

    return {
      all: leads.length,
      mine,
      unassigned,
    };
  }, [leads, currentUser?.id]);

  const governance = useMemo(() => {
    const nowTs = Date.now();
    const activitiesByLeadId = new Map();

    for (const activity of activities) {
      const leadId = activity.related_lead_id;
      if (!leadId) {
        continue;
      }

      const key = String(leadId);
      const current = activitiesByLeadId.get(key) || [];
      current.push(activity);
      activitiesByLeadId.set(key, current);
    }

    const rows = leads
      .filter((lead) => activeLeadStatuses.has(String(lead.status || "").toLowerCase()))
      .map((lead) => {
        const leadKey = String(lead.id);
        const leadActivities = activitiesByLeadId.get(leadKey) || [];

        const createdTs = toTimestamp(lead.created_at) || toTimestamp(lead.updated_at) || nowTs;
        const updatedTs = toTimestamp(lead.updated_at) || createdTs;

        let firstResponseTs = null;
        let overdueTasks = 0;

        for (const activity of leadActivities) {
          const type = String(activity.type || "").toLowerCase();
          const activityCreatedTs = toTimestamp(activity.created_at) || toTimestamp(activity.updated_at);

          if (responseActivityTypes.has(type) && activityCreatedTs) {
            if (!firstResponseTs || activityCreatedTs < firstResponseTs) {
              firstResponseTs = activityCreatedTs;
            }
          }

          const dueTs = toTimestamp(activity.due_at);
          if (type === "task" && !activity.completed_at && dueTs && dueTs < nowTs) {
            overdueTasks += 1;
          }
        }

        const ageHours = diffHours(nowTs, createdTs);
        const responseHours = firstResponseTs ? diffHours(firstResponseTs, createdTs) : null;

        let slaState = "on_track";
        if (firstResponseTs) {
          slaState = responseHours > leadResponseSlaHours ? "late" : "met";
        } else if (ageHours >= leadEscalationHours) {
          slaState = "escalated";
        } else if (ageHours >= leadResponseSlaHours) {
          slaState = "breach";
        } else if (ageHours >= leadResponseSlaHours * 0.75) {
          slaState = "due_soon";
        }

        const staleOwnershipDays = lead.assigned_to ? diffDays(nowTs, updatedTs) : 0;
        const missingContactMethod = !lead.email && !lead.phone;
        const unassigned = !lead.assigned_to;
        const staleOwnership = Boolean(lead.assigned_to) && staleOwnershipDays >= followUpSlaDays;
        const noResponse = !firstResponseTs;
        const slaBreached = slaState === "breach" || slaState === "escalated";
        const escalated = slaState === "escalated" || overdueTasks > 0;

        const blockers = [];
        if (missingContactMethod) {
          blockers.push("Missing contact method");
        }
        if (unassigned) {
          blockers.push("Unassigned owner");
        }
        if (staleOwnership) {
          blockers.push(`Stale ownership (${Math.floor(staleOwnershipDays)}d)`);
        }
        if (overdueTasks > 0) {
          blockers.push(`${overdueTasks} overdue task${overdueTasks > 1 ? "s" : ""}`);
        }
        if (noResponse && ageHours >= leadResponseSlaHours) {
          blockers.push("No response within SLA");
        }

        const slaLabel =
          slaState === "met"
            ? `Met (${Math.round(responseHours || 0)}h)`
            : slaState === "late"
            ? `Late (${Math.round(responseHours || 0)}h)`
            : slaState === "escalated"
            ? `Escalated (${Math.round(ageHours)}h)`
            : slaState === "breach"
            ? `Overdue (${Math.round(ageHours)}h)`
            : slaState === "due_soon"
            ? `Due soon (${Math.round(ageHours)}h)`
            : `In SLA (${Math.round(ageHours)}h)`;

        return {
          lead,
          slaState,
          slaTone: slaToneMap[slaState] || "info",
          slaLabel,
          noResponse,
          ageHours,
          responseHours,
          overdueTasks,
          blockers,
          blockerCount: blockers.length,
          staleOwnership,
          unassigned,
          missingContactMethod,
          slaBreached,
          escalated,
        };
      });

    const leadGovernanceById = new Map(rows.map((row) => [String(row.lead.id), row]));

    const escalationQueue = rows
      .filter((row) => row.escalated || row.slaBreached)
      .sort((left, right) => {
        if (left.slaState === "escalated" && right.slaState !== "escalated") return -1;
        if (left.slaState !== "escalated" && right.slaState === "escalated") return 1;
        return right.blockerCount - left.blockerCount || right.ageHours - left.ageHours;
      });

    const conversionBlockers = rows
      .filter((row) => row.blockerCount > 0)
      .sort((left, right) => right.blockerCount - left.blockerCount || right.ageHours - left.ageHours);

    return {
      leadGovernanceById,
      escalationQueue,
      conversionBlockers,
      metrics: {
        slaBreachedCount: rows.filter((row) => row.slaBreached).length,
        escalatedCount: escalationQueue.length,
        blockersCount: conversionBlockers.length,
        overdueTasks: rows.reduce((sum, row) => sum + row.overdueTasks, 0),
      },
    };
  }, [activities, followUpSlaDays, leadEscalationHours, leadResponseSlaHours, leads]);

  const leadPredictions = useMemo(() => {
    const nowTs = Date.now();
    const activityMap = new Map();

    for (const activity of activities) {
      const leadId = activity.related_lead_id;
      if (!leadId) {
        continue;
      }

      const key = String(leadId);
      const current = activityMap.get(key) || [];
      current.push(activity);
      activityMap.set(key, current);
    }

    const rows = leads
      .filter((lead) => activeLeadStatuses.has(String(lead.status || "").toLowerCase()))
      .map((lead) => {
        const prediction = scoreLeadConversion(lead, {
          activities: activityMap.get(String(lead.id)) || [],
          responseSlaHours: leadResponseSlaHours,
          escalationHours: leadEscalationHours,
          nowTs,
        });

        return {
          lead,
          ...prediction,
        };
      })
      .sort((left, right) => right.score - left.score);

    return {
      byId: new Map(rows.map((row) => [String(row.lead.id), row])),
      priorityQueue: rows.slice(0, 6),
      highIntentCount: rows.filter((row) => row.band === "high").length,
      mediumIntentCount: rows.filter((row) => row.band === "medium").length,
      lowIntentCount: rows.filter((row) => row.band === "low").length,
    };
  }, [activities, leadEscalationHours, leadResponseSlaHours, leads]);

  const filteredLeads = useMemo(() => {
    const rows = leads.filter((lead) => {
      const matchesTab =
        activeTab === tabKeys.all ||
        (activeTab === tabKeys.mine && String(lead.assigned_to || "") === String(currentUser?.id || "")) ||
        (activeTab === tabKeys.unassigned && !lead.assigned_to);

      const matchesSearch =
        !query ||
        [lead.name, lead.company, lead.email].some((value) =>
          String(value || "").toLowerCase().includes(query.toLowerCase())
        );

      const matchesStatus = statusFilter === "all" || String(lead.status || "") === statusFilter;
      const matchesAssigned =
        assignedFilter === "all" ||
        String(lead.assigned_to || "") === String(assignedFilter);

      const matchesDate = matchesDateRange(lead, dateFilter);

      return matchesTab && matchesSearch && matchesStatus && matchesAssigned && matchesDate;
    });

    return sortLeads(rows, sortBy);
  }, [leads, activeTab, currentUser?.id, query, statusFilter, assignedFilter, dateFilter, sortBy]);

  const handleLeadsSortChange = async (nextSort) => {
    setSortBy(nextSort);

    const localSettings = loadAppSettings();
    const mergedSettings = saveAppSettings({
      ...localSettings,
      leadsSort: nextSort,
    });

    try {
      const response = await crmApi.updateMySettings(mergedSettings);
      if (response?.data) {
        saveAppSettings(response.data);
      }
    } catch {
      // Keep local sort preference even if remote sync is temporarily unavailable.
    }
  };

  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredLeads.slice(start, start + PAGE_SIZE);
  }, [filteredLeads, currentPage]);

  const paginationMeta = useMemo(() => {
    const total = filteredLeads.length;
    const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const start = total ? (currentPage - 1) * PAGE_SIZE + 1 : 0;
    const end = Math.min(currentPage * PAGE_SIZE, total);

    return { total, pageCount, start, end };
  }, [filteredLeads.length, currentPage]);

  const relatedActivityTimeline = useMemo(() => {
    if (!drawerLead) return [];
    return activities
      .filter((activity) => String(activity.related_lead_id || "") === String(drawerLead.id))
      .slice(0, 10);
  }, [activities, drawerLead]);

  const resetModal = () => {
    setModalOpen(false);
    setEditingLead(null);
    setForm(emptyLeadForm);
  };

  const refreshWorkspace = async () => {
    await dispatch(fetchDashboardData());
  };

  const openAddLeadModal = () => {
    setEditingLead(null);
    setForm(emptyLeadForm);
    setModalOpen(true);
  };

  const openEditLeadModal = (lead) => {
    setEditingLead(lead);
    setForm({
      name: lead.name || "",
      email: lead.email || "",
      phone: lead.phone || "",
      company: lead.company || "",
      source: lead.source || "",
      status: lead.status || "new",
      assignedTo: lead.assigned_to || "",
      estimatedValue: lead.estimated_value || "",
      notes: lead.notes || "",
    });
    setModalOpen(true);
  };

  const openLeadDrawer = (lead) => {
    setDrawerLead(lead);
    setDrawerForm({
      status: lead.status || "new",
      assignedTo: lead.assigned_to || "",
      notes: lead.notes || "",
    });
    setActionMenuLeadId(null);
  };

  const handleSubmit = async () => {
    try {
      setSaving(true);
      setActionError("");
      const payload = {
        ...form,
        assignedTo: form.assignedTo || null,
        estimatedValue: Number(form.estimatedValue || 0),
      };

      if (editingLead) {
        await crmApi.updateLead(editingLead.id, payload);
      } else {
        await crmApi.createLead(payload);
      }

      await refreshWorkspace();
      resetModal();
    } catch (error) {
      setActionError(error.message || "Unable to save lead");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (lead) => {
    try {
      setBusyLeadId(lead.id);
      setActionError("");
      await crmApi.deleteLead(lead.id);
      await refreshWorkspace();
      if (drawerLead?.id === lead.id) {
        setDrawerLead(null);
      }
    } catch (error) {
      setActionError(error.message || "Unable to delete lead");
    } finally {
      setBusyLeadId(null);
    }
  };

  const handleConvert = async (lead) => {
    try {
      setBusyLeadId(lead.id);
      setActionError("");
      await crmApi.convertLead(lead.id);
      await refreshWorkspace();
    } catch (error) {
      setActionError(error.message || "Unable to convert lead");
    } finally {
      setBusyLeadId(null);
    }
  };

  const handleDrawerSave = async () => {
    if (!drawerLead) return;

    try {
      setBusyLeadId(drawerLead.id);
      setActionError("");

      const payload = buildLeadPayload(drawerLead, {
        status: drawerForm.status,
        assignedTo: drawerForm.assignedTo,
        notes: drawerForm.notes,
      });

      await crmApi.updateLead(drawerLead.id, payload);
      await refreshWorkspace();

      const refreshed = leads.find((lead) => lead.id === drawerLead.id);
      if (refreshed) {
        setDrawerLead(refreshed);
      }
    } catch (error) {
      setActionError(error.message || "Unable to update lead");
    } finally {
      setBusyLeadId(null);
    }
  };

  const toggleLeadSelection = (leadId) => {
    setSelectedLeadIds((current) =>
      current.includes(leadId)
        ? current.filter((id) => id !== leadId)
        : [...current, leadId]
    );
  };

  const toggleSelectAllVisible = () => {
    const visibleIds = paginatedLeads.map((lead) => lead.id);
    const allSelected = visibleIds.every((id) => selectedLeadIds.includes(id));

    if (allSelected) {
      setSelectedLeadIds((current) => current.filter((id) => !visibleIds.includes(id)));
      return;
    }

    setSelectedLeadIds((current) => Array.from(new Set([...current, ...visibleIds])));
  };

  const renderStatusBadge = (status) => (
    <Badge tone={statusToneMap[status] || "neutral"}>{String(status || "new")}</Badge>
  );

  const isRowSelected = (leadId) => selectedLeadIds.includes(leadId);

  return (
    <>
      <AppShell
        title="Leads"
        subtitle="Track qualification velocity, assignment, and conversion readiness in one workspace."
      >
        <ErrorBanner message={actionError} />

        <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-[var(--text-primary)]">Leads</h2>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">Qualify and convert your highest intent prospects.</p>
          </div>
          <Button onClick={openAddLeadModal}>+ Add Lead</Button>
        </div>

        <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">SLA breached</div>
            <div className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{governance.metrics.slaBreachedCount}</div>
            <div className="mt-1 text-xs text-[var(--text-secondary)]">Response SLA: {leadResponseSlaHours}h</div>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">Escalation queue</div>
            <div className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{governance.metrics.escalatedCount}</div>
            <div className="mt-1 text-xs text-[var(--text-secondary)]">Escalation threshold: {leadEscalationHours}h</div>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">Conversion blockers</div>
            <div className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{governance.metrics.blockersCount}</div>
            <div className="mt-1 text-xs text-[var(--text-secondary)]">Leads with at least one blocker</div>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-sm">
            <div className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">Overdue tasks</div>
            <div className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{governance.metrics.overdueTasks}</div>
            <div className="mt-1 text-xs text-[var(--text-secondary)]">Open tasks past due linked to active leads</div>
          </div>
        </div>

        <div className="mb-6 grid gap-4 xl:grid-cols-2">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">Step 4: SLA governance</div>
                <h3 className="mt-1 text-lg font-semibold text-[var(--text-primary)]">Lead escalation queue</h3>
              </div>
              <span className="rounded-full border border-[var(--border)] bg-[var(--bg-base)] px-2.5 py-1 text-xs text-[var(--text-secondary)]">
                {governance.escalationQueue.length}
              </span>
            </div>

            {governance.escalationQueue.length ? (
              <div className="mt-3 grid gap-2">
                {governance.escalationQueue.slice(0, 5).map((row) => (
                  <button
                    key={row.lead.id}
                    type="button"
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-left"
                    onClick={() => openLeadDrawer(row.lead)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-semibold text-[var(--text-primary)]">{row.lead.name}</div>
                      <Badge tone={row.slaTone}>{row.slaLabel}</Badge>
                    </div>
                    <div className="mt-1 text-xs text-[var(--text-secondary)]">
                      Owner: {row.lead.assigned_user_name || "Unassigned"} · {row.blockers.slice(0, 2).join(" | ") || "SLA breach"}
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-3 text-sm text-[var(--text-secondary)]">No leads currently in escalation queue.</div>
            )}
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">Step 4: Conversion blockers</div>
                <h3 className="mt-1 text-lg font-semibold text-[var(--text-primary)]">Blocker dashboard</h3>
              </div>
              <span className="rounded-full border border-[var(--border)] bg-[var(--bg-base)] px-2.5 py-1 text-xs text-[var(--text-secondary)]">
                {governance.conversionBlockers.length}
              </span>
            </div>

            {governance.conversionBlockers.length ? (
              <div className="mt-3 grid gap-2">
                {governance.conversionBlockers.slice(0, 5).map((row) => (
                  <button
                    key={`blocker-${row.lead.id}`}
                    type="button"
                    className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-left"
                    onClick={() => openLeadDrawer(row.lead)}
                  >
                    <div className="text-sm font-semibold text-[var(--text-primary)]">{row.lead.name}</div>
                    <div className="mt-1 text-xs text-[var(--text-secondary)]">{row.blockers.join(" | ")}</div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-3 text-sm text-[var(--text-secondary)]">No conversion blockers detected right now.</div>
            )}
          </div>
        </div>

        <div className="mb-6 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-4 shadow-sm">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <div className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">Step 5: Predictive prioritization</div>
              <h3 className="mt-1 text-lg font-semibold text-[var(--text-primary)]">Conversion likelihood scoring</h3>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 text-emerald-300">
                High: {leadPredictions.highIntentCount}
              </span>
              <span className="rounded-full border border-amber-500/40 bg-amber-500/15 px-2.5 py-1 text-amber-300">
                Medium: {leadPredictions.mediumIntentCount}
              </span>
              <span className="rounded-full border border-rose-500/40 bg-rose-500/15 px-2.5 py-1 text-rose-300">
                Low: {leadPredictions.lowIntentCount}
              </span>
            </div>
          </div>

          {leadPredictions.priorityQueue.length ? (
            <div className="mt-3 grid gap-2 lg:grid-cols-2">
              {leadPredictions.priorityQueue.map((row) => (
                <button
                  key={`predictive-${row.lead.id}`}
                  type="button"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-3 text-left"
                  onClick={() => openLeadDrawer(row.lead)}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-[var(--text-primary)]">{row.lead.name}</div>
                    <Badge tone={row.tone}>{row.label} ({row.score})</Badge>
                  </div>
                  <div className="mt-1 text-xs text-[var(--text-secondary)]">{row.reasons.join(" | ") || "Good conversion fit"}</div>
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-3 text-sm text-[var(--text-secondary)]">No active leads available for predictive scoring yet.</div>
          )}
        </div>

        <div className="mb-6 grid gap-4 rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-sm md:grid-cols-2 xl:grid-cols-5">
          <Input
            placeholder="Search name, company, or email"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setCurrentPage(1);
            }}
          />

          <Select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="all">All Statuses</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="qualified">Qualified</option>
            <option value="lost">Lost</option>
            <option value="converted">Converted</option>
          </Select>

          <Select
            value={assignedFilter}
            onChange={(event) => {
              setAssignedFilter(event.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="all">Assigned To (All)</option>
            {users.map((member) => (
              <option key={member.id} value={member.id}>
                {member.full_name}
              </option>
            ))}
          </Select>

          <Select
            value={dateFilter}
            onChange={(event) => {
              setDateFilter(event.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="all">All Time</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </Select>

          <Select
            value={sortBy}
            onChange={(event) => {
              setCurrentPage(1);
              handleLeadsSortChange(event.target.value);
            }}
          >
            <option value="updated_desc">Recently updated</option>
            <option value="value_desc">Highest value</option>
            <option value="name_asc">Name A-Z</option>
          </Select>
        </div>

        <div className="mb-6 flex flex-wrap items-center gap-2">
          {[
            { key: tabKeys.all, label: "All Leads", count: tabCounts.all },
            { key: tabKeys.mine, label: "My Leads", count: tabCounts.mine },
            { key: tabKeys.unassigned, label: "Unassigned", count: tabCounts.unassigned },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => {
                setActiveTab(tab.key);
                setCurrentPage(1);
              }}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${
                activeTab === tab.key
                  ? "bg-[var(--sidebar-active)] font-medium text-[var(--text-primary)]"
                  : "text-[var(--text-secondary)] hover:bg-gray-100 dark:hover:bg-slate-700"
              }`}
            >
              <span>{tab.label}</span>
              <span className="rounded-full bg-[var(--bg-base)] px-2 py-0.5 text-xs">{tab.count}</span>
            </button>
          ))}
        </div>

        <div className="hidden overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--bg-card)] shadow-sm md:block">
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="border-b border-[var(--border)] bg-[var(--bg-base)]">
                <tr>
                  <th className="px-4 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={
                        paginatedLeads.length > 0 &&
                        paginatedLeads.every((lead) => selectedLeadIds.includes(lead.id))
                      }
                      onChange={toggleSelectAllVisible}
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-[var(--text-secondary)]">Name</th>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-[var(--text-secondary)]">Company</th>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-[var(--text-secondary)]">Status</th>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-[var(--text-secondary)]">Source</th>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-[var(--text-secondary)]">Assigned To</th>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-[var(--text-secondary)]">Last Activity</th>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-[var(--text-secondary)]">SLA</th>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-[var(--text-secondary)]">Score</th>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-[var(--text-secondary)]">Value</th>
                  <th className="px-4 py-3 text-left text-xs uppercase tracking-wide text-[var(--text-secondary)]">Actions</th>
                </tr>
              </thead>

              <tbody>
                {paginatedLeads.length ? (
                  paginatedLeads.map((lead) => (
                    (() => {
                      const governanceRow = governance.leadGovernanceById.get(String(lead.id));
                      const predictionRow = leadPredictions.byId.get(String(lead.id));
                      return (
                    <tr
                      key={lead.id}
                      onClick={() => openLeadDrawer(lead)}
                      className="group border-b border-[var(--border)] transition hover:bg-gray-50 dark:hover:bg-slate-800/40"
                    >
                      <td className="px-4 py-3" onClick={(event) => event.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={isRowSelected(lead.id)}
                          onChange={() => toggleLeadSelection(lead.id)}
                        />
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--primary)]/15 text-xs font-semibold text-[var(--primary)]">
                            {getInitials(lead.name)}
                          </span>
                          <div>
                            <div className="text-sm font-medium text-[var(--text-primary)]">{lead.name}</div>
                            <div className="text-xs text-[var(--text-secondary)]">{lead.email}</div>
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-sm text-[var(--text-primary)]">{lead.company || "—"}</td>
                      <td className="px-4 py-3">{renderStatusBadge(lead.status)}</td>
                      <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{lead.source || "Unknown"}</td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-gray-200 text-xs font-medium text-gray-700 dark:bg-slate-700 dark:text-slate-200">
                            {getInitials(lead.assigned_user_name || "Unassigned")}
                          </span>
                          <span className="text-sm text-[var(--text-primary)]">{lead.assigned_user_name || "Unassigned"}</span>
                        </div>
                      </td>

                      <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">{formatDateTime(lead.updated_at)}</td>
                      <td className="px-4 py-3">
                        <Badge tone={governanceRow?.slaTone || "info"}>{governanceRow?.slaLabel || "In SLA"}</Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge tone={predictionRow?.tone || "info"}>
                          {predictionRow ? `${predictionRow.label} ${predictionRow.score}` : "N/A"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-[var(--text-primary)]">{formatCompactCurrency(lead.estimated_value)}</td>

                      <td className="relative px-4 py-3" onClick={(event) => event.stopPropagation()}>
                        <button
                          type="button"
                          className="rounded-lg px-2 py-1 text-lg leading-none text-[var(--text-secondary)] opacity-0 transition group-hover:opacity-100 hover:bg-gray-100 dark:hover:bg-slate-700"
                          onClick={() => setActionMenuLeadId((current) => (current === lead.id ? null : lead.id))}
                        >
                          ⋯
                        </button>

                        {actionMenuLeadId === lead.id ? (
                          <div className="absolute right-4 top-10 z-10 w-40 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-1 shadow-sm">
                            <button
                              type="button"
                              className="w-full rounded-md px-3 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-gray-100 dark:hover:bg-slate-700"
                              onClick={() => {
                                openEditLeadModal(lead);
                                setActionMenuLeadId(null);
                              }}
                            >
                              Edit Lead
                            </button>
                            {lead.status !== "converted" ? (
                              <button
                                type="button"
                                className="w-full rounded-md px-3 py-2 text-left text-sm text-[var(--text-primary)] hover:bg-gray-100 dark:hover:bg-slate-700"
                                onClick={async () => {
                                  setActionMenuLeadId(null);
                                  await handleConvert(lead);
                                }}
                              >
                                Convert
                              </button>
                            ) : null}
                            {canDeleteLeads(currentUser) ? (
                              <button
                                type="button"
                                className="w-full rounded-md px-3 py-2 text-left text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/20"
                                onClick={async () => {
                                  setActionMenuLeadId(null);
                                  await handleDelete(lead);
                                }}
                              >
                                Delete
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </td>
                    </tr>
                      );
                    })()
                  ))
                ) : (
                  <tr>
                    <td colSpan={11} className="px-6 py-10">
                      <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg-base)] p-10 text-center">
                        <svg viewBox="0 0 240 140" className="mx-auto h-24 w-40 text-indigo-300" fill="none">
                          <rect x="20" y="24" width="200" height="92" rx="14" stroke="currentColor" strokeWidth="2" />
                          <circle cx="70" cy="60" r="10" stroke="currentColor" strokeWidth="2" />
                          <path d="M95 56h78" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          <path d="M95 74h62" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                          <path d="M44 96h152" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        </svg>
                        <h3 className="mt-4 text-lg font-semibold text-[var(--text-primary)]">No leads yet</h3>
                        <p className="mt-2 text-sm text-[var(--text-secondary)]">Your filtered view is empty. Add your first lead to start qualification.</p>
                        <div className="mt-4">
                          <Button onClick={openAddLeadModal}>Add your first lead →</Button>
                        </div>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-3 md:hidden">
          {paginatedLeads.length ? (
            paginatedLeads.map((lead) => (
              (() => {
                const governanceRow = governance.leadGovernanceById.get(String(lead.id));
                const predictionRow = leadPredictions.byId.get(String(lead.id));
                return (
              <button
                key={lead.id}
                type="button"
                onClick={() => openLeadDrawer(lead)}
                className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-4 text-left shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-[var(--text-primary)]">{lead.name}</div>
                    <div className="text-xs text-[var(--text-secondary)]">{lead.company || "No company"}</div>
                  </div>
                  {renderStatusBadge(lead.status)}
                </div>
                <div className="mt-3 text-xs text-[var(--text-secondary)]">
                  {lead.assigned_user_name || "Unassigned"} · {formatCompactCurrency(lead.estimated_value)}
                </div>
                <div className="mt-2">
                  <Badge tone={governanceRow?.slaTone || "info"}>{governanceRow?.slaLabel || "In SLA"}</Badge>
                </div>
                <div className="mt-2">
                  <Badge tone={predictionRow?.tone || "info"}>
                    {predictionRow ? `${predictionRow.label} ${predictionRow.score}` : "Score N/A"}
                  </Badge>
                </div>
              </button>
                );
              })()
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--bg-card)] p-6 text-center">
              <div className="text-sm font-semibold text-[var(--text-primary)]">No leads yet</div>
              <div className="mt-1 text-xs text-[var(--text-secondary)]">Try broadening filters or adding a new lead.</div>
              <div className="mt-3">
                <Button onClick={openAddLeadModal}>Add Lead</Button>
              </div>
            </div>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--text-secondary)]">
          <div>
            Showing {paginationMeta.start}-{paginationMeta.end} of {paginationMeta.total} leads
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage <= 1}
            >
              Prev
            </Button>
            <span className="px-2">Page {currentPage}</span>
            <Button
              variant="secondary"
              onClick={() => setCurrentPage((page) => Math.min(paginationMeta.pageCount, page + 1))}
              disabled={currentPage >= paginationMeta.pageCount}
            >
              Next
            </Button>
          </div>
        </div>
      </AppShell>

      {drawerLead ? (
        <div className="fixed inset-0 z-40 flex justify-end bg-black/35 backdrop-blur-sm">
          <button type="button" className="flex-1" onClick={() => setDrawerLead(null)} aria-label="Close drawer" />
          <aside className="h-full w-full max-w-xl overflow-y-auto border-l border-[var(--border)] bg-[var(--bg-card)] p-6 shadow-sm">
            <div className="mb-6 flex items-start justify-between gap-3">
              <div>
                <div className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">Lead Detail</div>
                <h3 className="mt-2 text-2xl font-semibold text-[var(--text-primary)]">{drawerLead.name}</h3>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">{drawerLead.email || "No email"}</p>
              </div>
              <button
                type="button"
                onClick={() => setDrawerLead(null)}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-sm text-[var(--text-secondary)] hover:bg-gray-100 dark:hover:bg-slate-700"
              >
                Close
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-4">
                <div className="mb-3 text-xs uppercase tracking-wide text-[var(--text-secondary)]">Lead Info</div>
                <div className="mb-3">
                  <Badge tone={governance.leadGovernanceById.get(String(drawerLead.id))?.slaTone || "info"}>
                    {governance.leadGovernanceById.get(String(drawerLead.id))?.slaLabel || "In SLA"}
                  </Badge>
                </div>
                <div className="mb-3">
                  <Badge tone={leadPredictions.byId.get(String(drawerLead.id))?.tone || "info"}>
                    {leadPredictions.byId.get(String(drawerLead.id))
                      ? `${leadPredictions.byId.get(String(drawerLead.id)).label} ${leadPredictions.byId.get(String(drawerLead.id)).score}`
                      : "Score N/A"}
                  </Badge>
                </div>
                <div className="grid gap-2 text-sm text-[var(--text-primary)]">
                  <div>Company: {drawerLead.company || "—"}</div>
                  <div>Phone: {drawerLead.phone || "—"}</div>
                  <div>Source: {drawerLead.source || "Unknown"}</div>
                  <div>Estimated Value: {formatCompactCurrency(drawerLead.estimated_value)}</div>
                </div>

                {leadPredictions.byId.get(String(drawerLead.id))?.reasons?.length ? (
                  <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-3">
                    <div className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">Predictive signals</div>
                    <div className="mt-2 text-sm text-[var(--text-primary)]">
                      {leadPredictions.byId.get(String(drawerLead.id)).reasons.join(" | ")}
                    </div>
                  </div>
                ) : null}

                {governance.leadGovernanceById.get(String(drawerLead.id))?.blockerCount ? (
                  <div className="mt-3 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] p-3">
                    <div className="text-xs uppercase tracking-wide text-[var(--text-secondary)]">Conversion blockers</div>
                    <div className="mt-2 text-sm text-[var(--text-primary)]">
                      {governance.leadGovernanceById
                        .get(String(drawerLead.id))
                        ?.blockers.join(" | ")}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-4">
                <div className="mb-3 text-xs uppercase tracking-wide text-[var(--text-secondary)]">Update Lead</div>
                <div className="grid gap-3">
                  <div>
                    <div className="mb-1 text-xs text-[var(--text-secondary)]">Status</div>
                    <Select
                      value={drawerForm.status}
                      onChange={(event) => setDrawerForm((current) => ({ ...current, status: event.target.value }))}
                    >
                      <option value="new">New</option>
                      <option value="contacted">Contacted</option>
                      <option value="qualified">Qualified</option>
                      <option value="lost">Lost</option>
                      <option value="converted">Converted</option>
                    </Select>
                  </div>

                  <div>
                    <div className="mb-1 text-xs text-[var(--text-secondary)]">Assigned User</div>
                    <Select
                      value={String(drawerForm.assignedTo || "")}
                      onChange={(event) => setDrawerForm((current) => ({ ...current, assignedTo: event.target.value }))}
                    >
                      <option value="">Unassigned</option>
                      {users.map((member) => (
                        <option key={member.id} value={member.id}>
                          {member.full_name}
                        </option>
                      ))}
                    </Select>
                  </div>

                  <div>
                    <div className="mb-1 text-xs text-[var(--text-secondary)]">Notes</div>
                    <textarea
                      rows={4}
                      value={drawerForm.notes}
                      onChange={(event) => setDrawerForm((current) => ({ ...current, notes: event.target.value }))}
                      className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-3 py-2 text-sm text-[var(--text-primary)] outline-none focus:border-[var(--primary)]"
                    />
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    onClick={handleDrawerSave}
                    disabled={busyLeadId === drawerLead.id}
                  >
                    {busyLeadId === drawerLead.id ? "Saving..." : "Save changes"}
                  </Button>
                  {drawerLead.status !== "converted" ? (
                    <Button
                      onClick={() => handleConvert(drawerLead)}
                      disabled={busyLeadId === drawerLead.id}
                    >
                      Convert to Customer
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-base)] p-4">
                <div className="mb-3 text-xs uppercase tracking-wide text-[var(--text-secondary)]">Activity Timeline</div>
                {relatedActivityTimeline.length ? (
                  <div className="space-y-3">
                    {relatedActivityTimeline.map((activity) => (
                      <div key={activity.id} className="relative pl-5">
                        <span className="absolute left-0 top-1.5 h-2.5 w-2.5 rounded-full bg-[var(--primary)]" />
                        <div className="text-sm font-medium text-[var(--text-primary)]">{activity.subject}</div>
                        <div className="text-xs text-[var(--text-secondary)]">
                          {activity.type} · {formatDateTime(activity.created_at)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-[var(--text-secondary)]">No activity logged for this lead yet.</div>
                )}
              </div>
            </div>
          </aside>
        </div>
      ) : null}

      <Modal open={modalOpen} title={editingLead ? "Edit lead" : "Add lead"} onClose={resetModal}>
        <LeadForm
          form={form}
          setForm={setForm}
          users={users}
          onSubmit={handleSubmit}
          submitLabel={saving ? "Saving..." : editingLead ? "Update lead" : "Create lead"}
        />
      </Modal>
    </>
  );
}
