export function Button({
  children,
  className = "",
  variant = "primary",
  size = "md",
  type = "button",
  ...props
}) {
  const variants = {
    primary:
      "border border-[var(--accent)] bg-[var(--accent)] text-white shadow-[0_14px_30px_rgba(244,93,45,0.22)] hover:-translate-y-0.5 hover:bg-[var(--accent-strong)] hover:shadow-[0_18px_34px_rgba(244,93,45,0.26)]",
    secondary:
      "border border-[var(--border-strong)] bg-[var(--panel-elevated)] text-[var(--text-primary)] shadow-[var(--shadow-soft)] hover:-translate-y-0.5 hover:border-[var(--accent)]/30 hover:bg-[var(--surface)]",
    ghost:
      "text-[var(--text-secondary)] hover:bg-[var(--surface)] hover:text-[var(--text-primary)]",
    danger:
      "border border-rose-500/30 bg-rose-500 text-white shadow-[0_14px_28px_rgba(244,63,94,0.18)] hover:-translate-y-0.5 hover:bg-rose-600",
  };

  const sizes = {
    md: "h-11 px-4 text-sm",
    sm: "h-9 px-3.5 text-xs",
    lg: "h-12 px-5 text-sm",
  };

  return (
    <button
      type={type}
      className={`relative z-10 inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl font-semibold transition duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
