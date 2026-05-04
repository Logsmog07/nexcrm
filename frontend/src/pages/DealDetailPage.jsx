import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import crmApi from "../api/crmApi";
import { AppShell } from "../components/layout/AppShell";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Button } from "../components/ui/Button";
import { ErrorBanner } from "../components/common/ErrorBanner";
import { LoadingState } from "../components/common/LoadingState";
import { formatCompactCurrency, formatDate, formatDateTime } from "../lib/formatters";
import { useNavigate } from "../hooks/useNavigate";

const toneMap = {
  discovery: "info",
  proposal: "warning",
  negotiation: "warning",
  won: "success",
  lost: "danger",
};

export function DealDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [deal, setDeal] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    const loadDeal = async () => {
      try {
        setLoading(true);
        setError("");
        const response = await crmApi.getDeal(id);
        if (active) {
          setDeal(response.data);
        }
      } catch (apiError) {
        if (active) {
          setError(apiError.message || "Unable to load deal details");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadDeal();
    return () => {
      active = false;
    };
  }, [id]);

  if (loading) {
    return (
      <AppShell title="Deal Detail" subtitle="Loading opportunity context">
        <LoadingState label="Loading deal details..." />
      </AppShell>
    );
  }

  return (
    <AppShell
      title={deal?.title || "Deal detail"}
      subtitle="Opportunity status, forecast context, and ownership"
    >
      <ErrorBanner message={error} />
      {deal ? (
        <>
          <div className="mb-6 flex justify-end">
            <Button variant="secondary" onClick={() => navigate("/pipeline")}>
              Back to pipeline
            </Button>
          </div>
          <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
            <Card>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">
                    Opportunity profile
                  </div>
                  <h3 className="mt-2 text-xl font-semibold text-[var(--text-primary)]">{deal.title}</h3>
                  <p className="mt-2 text-sm text-[var(--text-secondary)]">
                    {deal.customer_name || deal.lead_name || "No linked account"}
                  </p>
                </div>
                <Badge tone={toneMap[deal.stage] || "neutral"}>{deal.stage}</Badge>
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="rounded-[20px] border border-[var(--border-soft)] bg-[var(--surface)] p-4">
                  <div className="text-sm text-[var(--text-secondary)]">Deal value</div>
                  <div className="mt-2 text-lg font-semibold text-[var(--text-primary)]">
                    {formatCompactCurrency(deal.value)}
                  </div>
                </div>
                <div className="rounded-[20px] border border-[var(--border-soft)] bg-[var(--surface)] p-4">
                  <div className="text-sm text-[var(--text-secondary)]">Probability</div>
                  <div className="mt-2 text-lg font-semibold text-[var(--text-primary)]">
                    {deal.probability || 0}%
                  </div>
                </div>
                <div className="rounded-[20px] border border-[var(--border-soft)] bg-[var(--surface)] p-4">
                  <div className="text-sm text-[var(--text-secondary)]">Owner</div>
                  <div className="mt-2 text-lg font-semibold text-[var(--text-primary)]">
                    {deal.owner_name || "Unassigned"}
                  </div>
                </div>
                <div className="rounded-[20px] border border-[var(--border-soft)] bg-[var(--surface)] p-4">
                  <div className="text-sm text-[var(--text-secondary)]">Expected close</div>
                  <div className="mt-2 text-lg font-semibold text-[var(--text-primary)]">
                    {formatDate(deal.expected_close_date)}
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">
                Deal summary
              </div>
              <h3 className="mt-2 text-xl font-semibold text-[var(--text-primary)]">
                Stage updated {formatDateTime(deal.updated_at)}
              </h3>
              <div className="mt-2 text-sm text-[var(--text-secondary)]">
                This view is focused on the opportunity record itself so pipeline clicks always open a detail surface instead of feeling dead.
              </div>
              <div className="mt-6 grid gap-3">
                <div className="rounded-[18px] border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-secondary)]">
                  Linked customer: {deal.customer_name || "None"}
                </div>
                <div className="rounded-[18px] border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-secondary)]">
                  Linked lead: {deal.lead_name || "None"}
                </div>
                <div className="rounded-[18px] border border-[var(--border-soft)] bg-[var(--surface)] px-4 py-3 text-sm text-[var(--text-secondary)]">
                  Current stage: {deal.stage}
                </div>
              </div>
            </Card>
          </div>
        </>
      ) : null}
    </AppShell>
  );
}
