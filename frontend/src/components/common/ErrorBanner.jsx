export function ErrorBanner({ message }) {
  if (!message) return null;

  return (
    <div
      className="ux-page-enter rounded-[24px] border px-4 py-3 text-sm shadow-[0_12px_24px_rgba(127,29,29,0.14)]"
      style={{
        borderColor: "var(--error-banner-border)",
        background: "var(--error-banner-bg)",
        color: "var(--error-banner-text)",
      }}
    >
      {message}
    </div>
  );
}
