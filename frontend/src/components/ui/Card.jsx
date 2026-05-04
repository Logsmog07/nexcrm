export function Card({ children, className = "" }) {
  return (
    <div
      className={`rounded-[var(--radius-panel)] border border-[var(--border-soft)] bg-[var(--panel)] p-5 shadow-[var(--shadow-panel)] backdrop-blur-xl transition duration-200 ${className}`}
    >
      {children}
    </div>
  );
}
