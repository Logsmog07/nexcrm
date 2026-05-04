export function Input({ className = "", ...props }) {
  return (
    <input
      className={`h-11 w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--panel-elevated)] px-4 text-sm text-[var(--text-primary)] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--ring)] ${className}`}
      {...props}
    />
  );
}
