export const DEV_TOKEN_KEY = "devToken";

export const formatDateTime = (value) => {
  if (!value) {
    return "-";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(parsed);
};

export const isLikelyDateField = (key, value) => {
  if (!value || typeof value !== "string") {
    return false;
  }

  const normalizedKey = String(key || "").toLowerCase();
  if (
    normalizedKey.endsWith("_at") ||
    normalizedKey.includes("date") ||
    normalizedKey.includes("time")
  ) {
    return !Number.isNaN(new Date(value).getTime());
  }

  return false;
};

export const truncateText = (value, maxLength = 54) => {
  const text = String(value || "");
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength)}...`;
};

export const valueToDisplay = (key, value) => {
  if (value === null || value === undefined) {
    return { text: "null", isNull: true };
  }

  if (typeof value === "object") {
    const serialized = JSON.stringify(value);
    return { text: truncateText(serialized), title: serialized, isNull: false };
  }

  if (isLikelyDateField(key, value)) {
    return { text: formatDateTime(value), title: String(value), isNull: false };
  }

  const text = String(value);
  return {
    text: truncateText(text),
    title: text,
    isNull: false,
  };
};

export const escapeSqlLiteral = (value) => String(value || "").replaceAll("'", "''");

export const toCsv = (rows, columns) => {
  const escapeCell = (cell) => {
    const text = String(cell ?? "");
    if (text.includes(",") || text.includes("\n") || text.includes("\"")) {
      return `"${text.replaceAll('"', '""')}"`;
    }
    return text;
  };

  const header = columns.map(escapeCell).join(",");
  const body = rows
    .map((row) => columns.map((column) => escapeCell(row[column])).join(","))
    .join("\n");

  return `${header}\n${body}`;
};

export const downloadBlob = (filename, blob) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
};

export const downloadCsv = (filename, csvText) => {
  const blob = new Blob([csvText], { type: "text/csv;charset=utf-8" });
  downloadBlob(filename, blob);
};

export const downloadJson = (filename, value) => {
  const text = JSON.stringify(value, null, 2);
  const blob = new Blob([text], { type: "application/json;charset=utf-8" });
  downloadBlob(filename, blob);
};
