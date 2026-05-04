import { useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import crmApi from "../api/crmApi";
import { AppShell } from "../components/layout/AppShell";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Modal } from "../components/ui/Modal";
import { ActivityForm } from "../components/forms/ActivityForm";
import { Badge } from "../components/ui/Badge";
import { fetchDashboardData } from "../store";
import { formatDateTime } from "../lib/formatters";
import { isSalesRep } from "../lib/roles";
import { ErrorBanner } from "../components/common/ErrorBanner";
import { getBranding } from "../lib/branding";
import { StatCard } from "../components/common/StatCard";

const emptyActivityForm = {
  type: "call",
  subject: "",
  notes: "",
  dueAt: "",
  relatedLeadId: "",
  relatedCustomerId: "",
  relatedDealId: "",
  userId: "",
};

export function ActivitiesPage() {
  const dispatch = useDispatch();
  const { activities, deals, leads, customers, users } = useSelector((state) => state.crm);
  const user = useSelector((state) => state.auth.user);
  const branding = getBranding(user);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState(emptyActivityForm);
  const [actionError, setActionError] = useState("");
  const [saving, setSaving] = useState(false);
  const [busyActivityId, setBusyActivityId] = useState(null);

  const refreshWorkspace = async () => {
    await dispatch(fetchDashboardData());
  };

  const activityMetrics = useMemo(() => {
    const pending = activities.filter((activity) => !activity.completed_at);
    const completed = activities.filter((activity) => Boolean(activity.completed_at));
    const meetings = activities.filter((activity) => activity.type === "meeting");
    const dueSoon = pending.filter((activity) => {
      if (!activity.due_at) return false;
      const due = new Date(activity.due_at).getTime();
      return due <= Date.now() + 1000 * 60 * 60 * 24 * 3;
    });

    return {
      total: activities.length,
      pending: pending.length,
      completed: completed.length,
      meetings: meetings.length,
      dueSoon: dueSoon.length,
    };
  }, [activities]);

  return (
    <AppShell
      title="Activities"
      subtitle={
        isSalesRep(user)
          ? "Your calls, emails, meetings, tasks, and reminders"
          : user?.email === "autosales@crm.local"
          ? `Imported ${branding.appName.toLowerCase()} order events, notes, and reminders in one activity stream`
          : "Centralize calls, emails, meetings, notes, and reminders across the revenue team"
      }
    >
      <ErrorBanner message={actionError} />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Activity stream"
          value={activityMetrics.total}
          detail={`${activityMetrics.pending} still open`}
          accent="#ff6a3d"
        />
        <StatCard
          label="Due soon"
          value={activityMetrics.dueSoon}
          detail="Tasks and follow-ups due within the next 3 days"
          accent="#f59e0b"
        />
        <StatCard
          label="Completed"
          value={activityMetrics.completed}
          detail="Logged items already closed out"
          accent="#22c55e"
        />
        <StatCard
          label="Meetings"
          value={activityMetrics.meetings}
          detail="Meeting records currently in the activity stream"
          accent="#38bdf8"
        />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <Card>
          <div className="flex items-center justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">
                Execution timeline
              </div>
              <h3 className="mt-2 text-xl font-semibold text-[var(--text-primary)]">Activity workspace</h3>
              <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                Keep calls, meetings, emails, and tasks in one operating stream so follow-up never gets lost between leads, customers, and deals.
              </p>
            </div>
            <Button onClick={() => setModalOpen(true)}>Log activity</Button>
          </div>

          <div className="mt-6 grid gap-3">
            {[
              ["Queue", "See pending work, upcoming due dates, and recently completed touchpoints."],
              ["Link", "Tie every activity back to the right lead, customer, or opportunity."],
              ["Close the loop", "Mark work complete from the same feed instead of jumping screens."],
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

        <Card>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-[22px] border border-[var(--border-soft)] bg-[var(--surface)] p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
                Pending work
              </div>
              <div className="mt-3 text-xl font-semibold text-[var(--text-primary)]">{activityMetrics.pending}</div>
              <div className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                Open follow-ups still waiting for action across your workspace.
              </div>
            </div>
            <div className="rounded-[22px] border border-[var(--border-soft)] bg-[var(--surface)] p-5">
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--text-muted)]">
                Completion rhythm
              </div>
              <div className="mt-3 text-xl font-semibold text-[var(--text-primary)]">
                {activityMetrics.total ? Math.round((activityMetrics.completed / activityMetrics.total) * 100) : 0}%
              </div>
              <div className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">
                Share of logged activities already completed and closed out.
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-6 space-y-4">
        {activities.map((activity) => (
          <Card key={activity.id} className="bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))]">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-semibold text-[var(--text-primary)]">{activity.subject}</h3>
                  <Badge tone={activity.completed_at ? "success" : "info"}>{activity.type}</Badge>
                </div>
                <p className="mt-2 text-sm text-[var(--text-secondary)]">{activity.notes || "No notes added."}</p>
                <div className="mt-4 flex flex-wrap gap-3">
                  {[
                    activity.user_name || "No owner",
                    activity.customer_name || activity.lead_name || activity.deal_title || "General activity",
                    `Due ${formatDateTime(activity.due_at)}`,
                  ].map((item) => (
                    <span
                      key={item}
                      className="rounded-full border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-2 text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]"
                    >
                      {item}
                    </span>
                  ))}
                </div>
                <div className="mt-4 text-xs uppercase tracking-[0.2em] text-[var(--text-muted)]">
                  Created {formatDateTime(activity.created_at)}
                </div>
              </div>
              {!activity.completed_at ? (
                <Button
                  variant="secondary"
                  onClick={async () => {
                    try {
                      setBusyActivityId(activity.id);
                      setActionError("");
                      await crmApi.completeActivity(activity.id);
                      await refreshWorkspace();
                    } catch (error) {
                      setActionError(error.message || "Unable to complete activity");
                    } finally {
                      setBusyActivityId(null);
                    }
                  }}
                  disabled={busyActivityId === activity.id}
                >
                  {busyActivityId === activity.id ? "Working..." : "Mark complete"}
                </Button>
              ) : (
                <Badge tone="success">Completed</Badge>
              )}
            </div>
          </Card>
        ))}
      </div>

      <Modal open={modalOpen} title="Log activity" onClose={() => setModalOpen(false)}>
        <ActivityForm
          form={form}
          setForm={setForm}
          leads={leads}
          customers={customers}
          deals={deals}
          users={users}
          onSubmit={async () => {
            try {
              setSaving(true);
              setActionError("");
              await crmApi.createActivity({
                ...form,
                userId: form.userId || null,
                relatedLeadId: form.relatedLeadId || null,
                relatedCustomerId: form.relatedCustomerId || null,
                relatedDealId: form.relatedDealId || null,
              });
              await refreshWorkspace();
              setForm(emptyActivityForm);
              setModalOpen(false);
            } catch (error) {
              setActionError(error.message || "Unable to create activity");
            } finally {
              setSaving(false);
            }
          }}
          submitLabel={saving ? "Saving..." : "Log activity"}
        />
      </Modal>
    </AppShell>
  );
}
