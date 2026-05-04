import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import crmApi from "../api/crmApi";
import { AppShell } from "../components/layout/AppShell";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { ErrorBanner } from "../components/common/ErrorBanner";
import { LoadingState } from "../components/common/LoadingState";
import { formatCompactCurrency, formatDateTime } from "../lib/formatters";
import { useNavigate } from "../hooks/useNavigate";

const toneMap = {
  new: "info",
  contacted: "warning",
  qualified: "success",
  lost: "danger",
  converted: "success",
};

export function LeadDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [lead, setLead] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadLead = async () => {
      try {
        setLoading(true);
        setError("");
        const response = await crmApi.getLead(id);
        if (active) {
          setLead(response.data);
        }
      } catch (apiError) {
        if (active) {
          setError(apiError.message || "Unable to load lead details");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadLead();
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <AppShell title="Lead Detail" subtitle="Loading lead context">
        <LoadingState label="Loading lead details..." />
      </AppShell>
    );
  }

  return (
    <AppShell
      title={lead?.name || "Lead detail"}
      subtitle="Lead profile, qualification context, and related timeline"
    >
      <ErrorBanner message={error} />
      {lead ? (
        <>
          <div className="mb-6 flex justify-end">
            <Button variant="secondary" onClick={() => navigate("/leads")}>
              Back to leads
            </Button>
          </div>
          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <Card>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">
                    Lead profile
                  </div>
                  <h3 className="mt-2 text-xl font-semibold text-[var(--text-primary)]">{lead.name}</h3>
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">
                    {lead.email} {lead.phone ? `· ${lead.phone}` : ""}
                  </p>
                </div>
                <Badge tone={toneMap[lead.status] || "neutral"}>{lead.status}</Badge>
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-[20px] border border-[var(--border-soft)] bg-[var(--surface)] p-4">
                  <div className="text-sm text-[var(--text-secondary)]">Company</div>
                  <div className="mt-2 text-lg font-semibold text-[var(--text-primary)]">
                    {lead.company || "Independent"}
                  </div>
                </div>
                <div className="rounded-[20px] border border-[var(--border-soft)] bg-[var(--surface)] p-4">
                  <div className="text-sm text-[var(--text-secondary)]">Estimated value</div>
                  <div className="mt-2 text-lg font-semibold text-[var(--text-primary)]">
                    {formatCompactCurrency(lead.estimated_value)}
                  </div>
                </div>
                <div className="rounded-[20px] border border-[var(--border-soft)] bg-[var(--surface)] p-4">
                  <div className="text-sm text-[var(--text-secondary)]">Owner</div>
                  <div className="mt-2 text-lg font-semibold text-[var(--text-primary)]">
                    {lead.assigned_user_name || "Unassigned"}
                  </div>
                </div>
                <div className="rounded-[20px] border border-[var(--border-soft)] bg-[var(--surface)] p-4">
                  <div className="text-sm text-[var(--text-secondary)]">Last update</div>
                  <div className="mt-2 text-lg font-semibold text-[var(--text-primary)]">
                    {formatDateTime(lead.updated_at)}
                  </div>
                </div>
              </div>
              <div className="mt-6 rounded-[20px] border border-[var(--border-soft)] bg-[var(--surface)] p-4">
                <div className="text-sm text-[var(--text-secondary)]">Notes</div>
                <div className="mt-2 text-sm leading-6 text-[var(--text-primary)]">
                  {lead.notes || "No qualification notes added yet."}
                </div>
              </div>
            </Card>

            <Card>
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">
                Conversion insight
              </div>
              <h3 className="mt-2 text-xl font-semibold text-[var(--text-primary)]">
                {lead.insight?.label || "No insight available"}
              </h3>
              <div className="mt-2 text-sm text-[var(--text-secondary)]">
                {lead.insight?.probability || 0}% conversion probability
              </div>
              <div className="mt-6 space-y-3">
                {(lead.insight?.reasons || []).map((reason) => (
                  <div
                    key={reason}
                    className="rounded-[18px] border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-secondary)]"
                  >
                    {reason}
                  </div>
                ))}
              </div>
              <div className="mt-6">
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]">
                  Related activity
                </div>
                <div className="mt-4 space-y-3">
                  {(lead.activities || []).length ? (
                    lead.activities.map((activity) => (
                      <div
                        key={activity.id}
                        className="rounded-[18px] border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-3"
                      >
                        <div className="text-sm font-semibold text-[var(--text-primary)]">{activity.subject}</div>
                        <div className="mt-1 text-xs uppercase tracking-[0.18em] text-[var(--text-muted)]">
                          {activity.type} · {formatDateTime(activity.created_at)}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-[18px] border border-dashed border-[var(--border-soft)] bg-[var(--surface)] px-4 py-5 text-sm text-[var(--text-secondary)]">
                      No activities linked to this lead yet.
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>
        </>
      ) : null}
    </AppShell>
  );
}
