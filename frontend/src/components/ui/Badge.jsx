const palette = {
  success:
    "bg-[var(--badge-success-bg)] text-[var(--badge-success-text)] ring-1 ring-[var(--badge-success-ring)]",
  warning:
    "bg-[var(--badge-warning-bg)] text-[var(--badge-warning-text)] ring-1 ring-[var(--badge-warning-ring)]",
  danger:
    "bg-[var(--badge-danger-bg)] text-[var(--badge-danger-text)] ring-1 ring-[var(--badge-danger-ring)]",
  info:
    "bg-[var(--badge-info-bg)] text-[var(--badge-info-text)] ring-1 ring-[var(--badge-info-ring)]",
  neutral: "bg-[var(--surface)] text-[var(--text-secondary)] ring-1 ring-[var(--border-soft)]",
};

export function Badge({ children, tone = "neutral" }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${palette[tone]}`}>
      {children}
    </span>
  );
}
