export function LoadingState({ label = "Loading workspace..." }) {
  return (
    <div className="flex min-h-[220px] items-center justify-center">
      <div
        className="ux-page-enter flex items-center gap-3 rounded-full border px-4 py-3"
        style={{ borderColor: "var(--empty-border)", background: "var(--empty-bg)" }}
      >
        <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-[var(--accent)]" />
        <span className="text-sm text-[var(--text-secondary)]">{label}</span>
      </div>
    </div>
  );
}
