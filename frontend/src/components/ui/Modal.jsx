import { Card } from "./Card";

export function Modal({ open, title, children, onClose }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{
        background: "var(--overlay-bg)",
        backdropFilter: "var(--overlay-blur)",
      }}
    >
      <Card className="w-full max-w-2xl border-[var(--border-strong)] bg-[var(--panel-solid)]">
        <div className="mb-6 flex items-center justify-between border-b border-[var(--border-soft)] pb-4">
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-[var(--text-muted)]">
              Workspace action
            </div>
            <h3 className="mt-2 text-xl font-semibold text-[var(--text-primary)]">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-[var(--border-soft)] bg-[var(--surface)] px-3 py-1 text-sm text-[var(--text-secondary)] transition hover:border-[var(--border-strong)] hover:text-[var(--text-primary)]"
          >
            Close
          </button>
        </div>
        {children}
      </Card>
    </div>
  );
}
