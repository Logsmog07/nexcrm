export function DataTable({
  columns,
  rows,
  rowKey,
  onRowClick,
  emptyTitle = "Nothing to show",
  emptyDescription = "Try changing your filters or add a new record.",
}) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-[var(--border-soft)] bg-[var(--panel)] shadow-[var(--shadow-soft)]">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-[var(--border-soft)]">
          <thead className="bg-[var(--surface)]">
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  className="px-5 py-4 text-left text-[11px] font-semibold uppercase tracking-[0.22em] text-[var(--text-muted)]"
                >
                  {column.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--border-soft)]">
            {rows.length ? (
              rows.map((row) => (
                <tr
                  key={row[rowKey]}
                  className={`bg-transparent transition hover:bg-[var(--surface)] ${
                    onRowClick ? "cursor-pointer" : ""
                  }`}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className="px-5 py-4 text-sm text-[var(--text-primary)]"
                    >
                      {column.render ? column.render(row) : row[column.key]}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-5 py-12 text-center"
                >
                  <div className="text-sm font-semibold text-[var(--text-primary)]">{emptyTitle}</div>
                  <div className="mt-2 text-sm text-[var(--text-secondary)]">{emptyDescription}</div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
