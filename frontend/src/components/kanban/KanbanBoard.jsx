import { useMemo, useState } from "react";
import { Card } from "../ui/Card";
import { formatCompactCurrency, formatDate } from "../../lib/formatters";
import { getForecastBucket, getForecastBucketMeta } from "../../lib/forecasting";

const STAGES = [
  { key: "discovery", label: "Discovery", accent: "#ff8b5e" },
  { key: "proposal", label: "Proposal", accent: "#38bdf8" },
  { key: "negotiation", label: "Negotiation", accent: "#a78bfa" },
  { key: "won", label: "Won", accent: "#22c55e" },
  { key: "lost", label: "Lost", accent: "#f87171" },
];

export function KanbanBoard({
  deals,
  onMove,
  onCardClick,
  onDealSelect,
  movingDealId,
  selectedDealId,
  visibleStages,
}) {
  const [dragDeal, setDragDeal] = useState(null);

  const resolvedStages = useMemo(() => {
    if (!visibleStages?.length) {
      return STAGES;
    }

    const visibleSet = new Set(visibleStages);
    return STAGES.filter((stage) => visibleSet.has(stage.key));
  }, [visibleStages]);

  const columns = useMemo(() => {
    return resolvedStages.map((stage) => {
      const stageDeals = deals
        .filter((deal) => String(deal.stage || "") === stage.key)
        .sort((left, right) => Number(right.value || 0) - Number(left.value || 0));

      const stageValue = stageDeals.reduce((sum, deal) => sum + Number(deal.value || 0), 0);

      return {
        ...stage,
        deals: stageDeals,
        stageValue,
      };
    });
  }, [deals, resolvedStages]);

  const handleDrop = (targetStage) => {
    if (!dragDeal || String(dragDeal.stage || "") === String(targetStage)) {
      setDragDeal(null);
      return;
    }

    onMove?.(dragDeal.id, targetStage);
    setDragDeal(null);
  };

  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max gap-4 pr-2">
        {columns.map((column) => (
          <Card
            key={column.key}
            className="min-h-[460px] w-[310px] shrink-0 border-[var(--border)] bg-[var(--bg-card)]"
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => handleDrop(column.key)}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{
                  backgroundColor: column.accent,
                  boxShadow: `0 0 0 6px ${column.accent}1f`,
                }}
              />
              <div>
                <h3 className="text-sm font-semibold uppercase tracking-[0.14em] text-[var(--text-primary)]">
                  {column.label}
                </h3>
                <div className="mt-1 text-xs text-[var(--text-secondary)]">
                  {formatCompactCurrency(column.stageValue)} in stage
                </div>
              </div>
            </div>

            <span className="rounded-full border border-[var(--border)] bg-[var(--bg-base)] px-2.5 py-1 text-xs font-semibold text-[var(--text-primary)]">
              {column.deals.length}
            </span>
            </div>

            <div className="space-y-3">
              {column.deals.map((deal) => (
                <button
                  key={deal.id}
                  type="button"
                  draggable={!movingDealId}
                  onDragStart={() => setDragDeal(deal)}
                  onDragEnd={() => setDragDeal(null)}
                  onClick={() => {
                    onDealSelect?.(deal);
                    onCardClick?.(deal);
                  }}
                  className={`w-full cursor-grab rounded-2xl border p-4 text-left transition ${
                    String(selectedDealId || "") === String(deal.id)
                      ? "border-[var(--primary)] bg-[var(--primary)]/10 shadow-sm"
                      : "border-[var(--border)] bg-[var(--bg-base)] hover:border-[var(--primary)]/35"
                  }`}
                >
                  {(() => {
                    const forecastMeta = getForecastBucketMeta(getForecastBucket(deal));
                    return (
                      <span
                        className="inline-flex rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
                        style={{
                          background: `${forecastMeta.accent}22`,
                          color: forecastMeta.accent,
                        }}
                      >
                        {forecastMeta.label}
                      </span>
                    );
                  })()}

                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-[var(--text-primary)]">{deal.title}</div>
                      <div className="mt-1 text-xs text-[var(--text-secondary)]">
                        {deal.customer_name || deal.lead_name || "Unassigned account"}
                      </div>
                    </div>
                    <span
                      className="rounded-full px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.14em]"
                      style={{
                        background: `${column.accent}22`,
                        color: column.accent,
                      }}
                    >
                      {Number(deal.probability || 0)}%
                    </span>
                  </div>

                  <div className="mt-3 grid gap-1 text-xs text-[var(--text-secondary)]">
                    <div className="text-sm font-semibold text-[var(--text-primary)]">
                      {formatCompactCurrency(deal.value)}
                    </div>
                    <div>Owner: {deal.owner_name || "Unassigned"}</div>
                    <div>Close: {formatDate(deal.expected_close_date)}</div>
                  </div>
                </button>
              ))}

              {!column.deals.length ? (
                <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--bg-base)] p-4 text-xs text-[var(--text-secondary)]">
                  Drop a deal here to move it into {column.label.toLowerCase()}.
                </div>
              ) : null}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
