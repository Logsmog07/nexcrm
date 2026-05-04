export function EmptyState({ title, description }) {
  return (
    <div
      className="ux-page-enter rounded-[26px] border border-dashed p-10 text-center"
      style={{ borderColor: "var(--empty-border)", background: "var(--empty-bg)" }}
    >
      <h3 className="text-lg font-semibold tracking-tight text-[var(--text-primary)]">{title}</h3>
      <p className="mt-2 text-sm text-[var(--text-secondary)]">{description}</p>
    </div>
  );
}
