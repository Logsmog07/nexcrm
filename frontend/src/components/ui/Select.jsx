export function Select({ className = "", children, ...props }) {
  return (
    <select
      className={`h-11 w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--panel-elevated)] px-4 text-sm text-[var(--text-primary)] outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--ring)] ${className}`}
      {...props}
    >
      {children}
    </select>
  );
}
