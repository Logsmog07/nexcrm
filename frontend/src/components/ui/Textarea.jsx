export function Textarea({ className = "", ...props }) {
  return (
    <textarea
      className={`min-h-[120px] w-full rounded-2xl border border-[var(--border-soft)] bg-[var(--panel-elevated)] px-4 py-3 text-sm text-[var(--text-primary)] outline-none transition placeholder:text-[var(--text-muted)] focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--ring)] ${className}`}
      {...props}
    />
  );
}
