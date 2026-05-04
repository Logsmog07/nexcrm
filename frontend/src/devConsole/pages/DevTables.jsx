import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  getDevCompanies,
  getDevRelations,
  getDevTable,
  getDevTables,
  runDevQuery,
} from "../api/devApi";
import { useDevConsoleContext } from "../useDevConsoleContext";
import { escapeSqlLiteral, valueToDisplay } from "../utils";

const SAFE_IDENTIFIER = /^[a-z_][a-z0-9_]*$/i;

const resolveReferenceLabel = (record) => {
  if (!record || typeof record !== "object") {
    return "record not found";
  }

  const preferredKeys = ["name", "full_name", "title", "email"];
  for (const key of preferredKeys) {
    if (record[key]) {
      return String(record[key]);
    }
  }

  const entries = Object.entries(record);
  if (!entries.length) {
    return "record not found";
  }

  return String(entries[0][1]);
};

export default function DevTables() {
  const { selectedCompanyId, setSelectedCompanyId } = useDevConsoleContext();
  const [searchParams, setSearchParams] = useSearchParams();

  const [loadingMeta, setLoadingMeta] = useState(true);
  const [metaError, setMetaError] = useState("");
  const [tables, setTables] = useState([]);
  const [relations, setRelations] = useState([]);
  const [companies, setCompanies] = useState([]);

  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState("");
  const [tableData, setTableData] = useState(null);

  const [searchInput, setSearchInput] = useState(searchParams.get("search") || "");
  const [sortBy, setSortBy] = useState("");
  const [sortDir, setSortDir] = useState("asc");
  const [fkTooltip, setFkTooltip] = useState({ key: "", loading: false, text: "" });

  const selectedTable = searchParams.get("table") || "";
  const page = Number.parseInt(searchParams.get("page") || "1", 10);
  const activeSearch = searchParams.get("search") || "";

  useEffect(() => {
    let active = true;

    Promise.all([getDevTables(), getDevRelations(), getDevCompanies()])
      .then(([tablesPayload, relationsPayload, companiesPayload]) => {
        if (!active) {
          return;
        }

        const loadedTables = tablesPayload.data || [];
        setTables(loadedTables);
        setRelations(relationsPayload.data || []);
        setCompanies(companiesPayload.data || []);

        if (!selectedTable && loadedTables.length) {
          const params = new URLSearchParams(searchParams);
          params.set("table", loadedTables[0].tableName);
          params.set("page", "1");
          setSearchParams(params, { replace: true });
        }
      })
      .catch((requestError) => {
        if (active) {
          setMetaError(requestError?.response?.data?.message || requestError.message || "Unable to load tables");
        }
      })
      .finally(() => {
        if (active) {
          setLoadingMeta(false);
        }
      });

    return () => {
      active = false;
    };
  }, [searchParams, selectedTable, setSearchParams]);

  useEffect(() => {
    if (!selectedTable) {
      return;
    }

    let active = true;
    const loadRows = async () => {
      setLoadingData(true);
      setDataError("");

      try {
        const payload = await getDevTable(selectedTable, {
          page,
          limit: 25,
          search: activeSearch || undefined,
          companyId: selectedCompanyId || undefined,
        });

        if (!active) {
          return;
        }

        setTableData(payload);
        setSortBy(payload.columns?.[0]?.name || "");
      } catch (requestError) {
        if (active) {
          setDataError(
            requestError?.response?.data?.message ||
              requestError.message ||
              "Unable to load table rows"
          );
        }
      } finally {
        if (active) {
          setLoadingData(false);
        }
      }
    };

    queueMicrotask(loadRows);

    return () => {
      active = false;
    };
  }, [selectedTable, page, activeSearch, selectedCompanyId]);

  const relationMap = useMemo(() => {
    const map = new Map();
    for (const relation of relations) {
      const key = `${relation.table_name}.${relation.column_name}`;
      map.set(key, relation);
    }
    return map;
  }, [relations]);

  const sortedRows = useMemo(() => {
    const rows = [...(tableData?.rows || [])];
    if (!sortBy) {
      return rows;
    }

    rows.sort((left, right) => {
      const a = left[sortBy];
      const b = right[sortBy];

      if (a == null && b == null) return 0;
      if (a == null) return 1;
      if (b == null) return -1;

      const aText = String(a).toLowerCase();
      const bText = String(b).toLowerCase();
      if (aText < bText) return sortDir === "asc" ? -1 : 1;
      if (aText > bText) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return rows;
  }, [tableData, sortBy, sortDir]);

  const hasCompanyColumn = useMemo(
    () => (tableData?.columns || []).some((column) => column.name === "company_id"),
    [tableData]
  );

  const total = tableData?.total || 0;
  const from = total ? (page - 1) * (tableData?.limit || 25) + 1 : 0;
  const to = total ? Math.min(total, page * (tableData?.limit || 25)) : 0;

  const handleTableSelect = (tableName) => {
    const params = new URLSearchParams(searchParams);
    params.set("table", tableName);
    params.set("page", "1");
    params.delete("search");
    setSearchInput("");
    setSearchParams(params);
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    const params = new URLSearchParams(searchParams);
    if (searchInput.trim()) {
      params.set("search", searchInput.trim());
    } else {
      params.delete("search");
    }
    params.set("page", "1");
    setSearchParams(params);
  };

  const changePage = (nextPage) => {
    const params = new URLSearchParams(searchParams);
    params.set("page", String(nextPage));
    setSearchParams(params);
  };

  const toggleSort = (columnName) => {
    if (sortBy === columnName) {
      setSortDir((value) => (value === "asc" ? "desc" : "asc"));
      return;
    }

    setSortBy(columnName);
    setSortDir("asc");
  };

  const resolveForeignLabel = async ({ relation, value, key }) => {
    if (!relation || value === null || value === undefined) {
      return;
    }

    if (!SAFE_IDENTIFIER.test(relation.foreign_table) || !SAFE_IDENTIFIER.test(relation.foreign_column)) {
      return;
    }

    const numeric = Number(value);
    const valueSql = Number.isFinite(numeric) && String(value).trim() !== ""
      ? String(numeric)
      : `'${escapeSqlLiteral(value)}'`;

    setFkTooltip({ key, loading: true, text: "Loading..." });

    try {
      const response = await runDevQuery(
        `SELECT * FROM ${relation.foreign_table} WHERE ${relation.foreign_column} = ${valueSql} LIMIT 1`
      );
      const record = response.rows?.[0] || null;
      setFkTooltip({ key, loading: false, text: resolveReferenceLabel(record) });
    } catch (requestError) {
      setFkTooltip({
        key,
        loading: false,
        text: requestError?.response?.data?.message || requestError.message || "Lookup failed",
      });
    }
  };

  if (loadingMeta) {
    return <div className="dev-card">Loading table browser...</div>;
  }

  if (metaError) {
    return <div className="dev-card dev-error">{metaError}</div>;
  }

  return (
    <div className="dev-page-stack">
      <section className="dev-card dev-table-browser">
        <aside className="dev-table-list">
          {tables.map((table) => (
            <button
              key={table.tableName}
              type="button"
              className={`dev-table-list-item ${selectedTable === table.tableName ? "is-active" : ""}`}
              onClick={() => handleTableSelect(table.tableName)}
            >
              <span>{table.tableName}</span>
              <em>{Number(table.rowCount || 0).toLocaleString()}</em>
            </button>
          ))}
        </aside>

        <div className="dev-table-main">
          <div className="dev-card-head">
            <h2 className="dev-heading">
              {selectedTable || "Select a table"}
              {tableData ? ` (${tableData.total} rows total)` : ""}
            </h2>

            {hasCompanyColumn ? (
              <select
                className="dev-select"
                value={selectedCompanyId || ""}
                onChange={(event) => setSelectedCompanyId(event.target.value)}
              >
                <option value="">All companies</option>
                {companies.map((company) => (
                  <option key={company.id} value={company.id}>{company.name}</option>
                ))}
              </select>
            ) : null}
          </div>

          <div className="dev-pill-row">
            {(tableData?.columns || []).map((column) => {
              const isFk = relationMap.has(`${selectedTable}.${column.name}`);
              return (
                <span key={column.name} className={`dev-pill ${isFk ? "is-fk" : ""}`}>
                  {column.name}: {column.dataType}
                </span>
              );
            })}
          </div>

          <form className="dev-inline-actions" onSubmit={handleSearchSubmit}>
            <input
              className="dev-inline-input"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search text columns"
            />
            <button type="submit" className="dev-run-btn">Search</button>
            <button
              type="button"
              className="dev-ghost-btn"
              onClick={() => {
                setSearchInput("");
                const params = new URLSearchParams(searchParams);
                params.delete("search");
                params.set("page", "1");
                setSearchParams(params);
              }}
            >
              Clear
            </button>
          </form>

          {loadingData ? <p className="dev-muted">Loading rows...</p> : null}
          {dataError ? <div className="dev-error-box">{dataError}</div> : null}

          {tableData ? (
            <>
              <div className="dev-table-wrap">
                <table className="dev-table">
                  <thead>
                    <tr>
                      {(tableData.columns || []).map((column) => (
                        <th key={column.name}>
                          <button
                            type="button"
                            className="dev-sort-btn"
                            onClick={() => toggleSort(column.name)}
                          >
                            {column.name}
                            {sortBy === column.name ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                          </button>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortedRows.map((row, rowIndex) => (
                      <tr key={`row-${rowIndex}`}>
                        {(tableData.columns || []).map((column) => {
                          const raw = row[column.name];
                          const display = valueToDisplay(column.name, raw);
                          const relation = relationMap.get(`${selectedTable}.${column.name}`);
                          const cellKey = `${rowIndex}-${column.name}`;

                          return (
                            <td key={cellKey} title={display.title || display.text}>
                              {display.isNull ? (
                                <em className="dev-null">null</em>
                              ) : relation && raw !== null && raw !== undefined ? (
                                <div className="dev-fk-cell">
                                  <button
                                    type="button"
                                    className="dev-link-btn"
                                    onClick={() => resolveForeignLabel({ relation, value: raw, key: cellKey })}
                                  >
                                    {display.text}
                                  </button>
                                  {fkTooltip.key === cellKey ? (
                                    <div className="dev-fk-tooltip">
                                      {fkTooltip.loading ? "Loading..." : fkTooltip.text}
                                    </div>
                                  ) : null}
                                </div>
                              ) : (
                                display.text
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="dev-pagination">
                <span>
                  Showing {from}-{to} of {total} rows
                </span>
                <div className="dev-inline-actions">
                  <button
                    type="button"
                    className="dev-ghost-btn"
                    disabled={page <= 1}
                    onClick={() => changePage(page - 1)}
                  >
                    Prev
                  </button>
                  <button
                    type="button"
                    className="dev-ghost-btn"
                    disabled={page >= (tableData.totalPages || 1)}
                    onClick={() => changePage(page + 1)}
                  >
                    Next
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </section>
    </div>
  );
}
