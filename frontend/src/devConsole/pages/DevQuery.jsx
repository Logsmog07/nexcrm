import { useMemo, useState } from "react";
import { runDevQuery } from "../api/devApi";
import { downloadCsv, toCsv, valueToDisplay } from "../utils";

const HISTORY_KEY = "devConsole_query_history";
const DEFAULT_QUERY = "-- Enter a SELECT query...\nSELECT * FROM leads LIMIT 10;";

const loadHistory = () => {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(HISTORY_KEY) || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export default function DevQuery() {
  const [query, setQuery] = useState(DEFAULT_QUERY);
  const [history, setHistory] = useState(loadHistory);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const lineNumbers = useMemo(() => {
    const count = query.split("\n").length;
    return Array.from({ length: count }, (_, index) => index + 1).join("\n");
  }, [query]);

  const saveHistory = (entry) => {
    const next = [entry, ...history.filter((item) => item !== entry)].slice(0, 5);
    setHistory(next);
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(next));
  };

  const handleRun = async () => {
    setRunning(true);
    setError("");

    try {
      const payload = await runDevQuery(query);
      setResult(payload);
      saveHistory(payload.query || query.trim());
    } catch (requestError) {
      setError(requestError?.response?.data?.message || requestError.message || "Query failed");
      setResult(null);
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="dev-page-stack">
      <section className="dev-card">
        <div className="dev-card-head">
          <h2 className="dev-heading">Query Runner</h2>
        </div>

        <div className="dev-warning">Read-only mode. Only SELECT statements are permitted.</div>

        {history.length ? (
          <div className="dev-chip-list">
            {history.map((entry) => (
              <button
                key={entry}
                type="button"
                className="dev-chip"
                onClick={() => setQuery(entry)}
                title={entry}
              >
                {entry}
              </button>
            ))}
          </div>
        ) : null}

        <div className="dev-editor-wrap">
          <pre className="dev-editor-lines">{lineNumbers}</pre>
          <textarea
            className="dev-editor"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            spellCheck={false}
            placeholder={DEFAULT_QUERY}
          />
        </div>

        <div className="dev-inline-actions">
          <button type="button" className="dev-run-btn" onClick={handleRun} disabled={running}>
            {running ? "RUNNING..." : "RUN QUERY"}
          </button>
          <button type="button" className="dev-ghost-btn" onClick={() => setQuery("")}>CLEAR</button>
          <button
            type="button"
            className="dev-ghost-btn"
            disabled={!result?.rows?.length}
            onClick={() => {
              if (!result?.rows?.length) {
                return;
              }
              const csv = toCsv(result.rows, result.columns || []);
              downloadCsv("dev-query-results.csv", csv);
            }}
          >
            Export CSV
          </button>
        </div>

        {error ? <div className="dev-error-box">{error}</div> : null}

        {result ? (
          <div className="dev-query-result">
            <p>
              Query executed in {result.durationMs}ms - {result.rowCount} rows returned
            </p>
            <div className="dev-table-wrap">
              <table className="dev-table">
                <thead>
                  <tr>
                    {(result.columns || []).map((column) => (
                      <th key={column}>{column}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(result.rows || []).map((row, index) => (
                    <tr key={`query-row-${index}`}>
                      {(result.columns || []).map((column) => {
                        const display = valueToDisplay(column, row[column]);
                        return (
                          <td key={`${index}-${column}`} title={display.title || display.text}>
                            {display.isNull ? <em className="dev-null">null</em> : display.text}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
