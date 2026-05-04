import { Card } from "../ui/Card";

export function StatCard({ label, value, detail, accent = "var(--accent)" }) {
  return (
    <Card className="ux-page-enter overflow-hidden" style={{ background: "var(--card-gradient-bg)" }}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--text-muted)]">
            {label}
          </div>
          <div className="mt-3 text-3xl font-semibold text-[var(--text-primary)]">{value}</div>
          <div className="mt-2 text-sm text-[var(--text-secondary)]">{detail}</div>
        </div>
        <div
          className="h-12 w-12 rounded-2xl opacity-90"
          style={{
            background: `linear-gradient(135deg, ${accent}, rgba(255,255,255,0.05))`,
            boxShadow: `0 16px 30px ${accent}33`,
          }}
        />
      </div>
    </Card>
  );
}
