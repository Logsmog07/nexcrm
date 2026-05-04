import { useEffect, useMemo, useRef, useState } from "react";
import { getDevRelations, getDevSchema } from "../api/devApi";
import { downloadBlob, downloadCsv, downloadJson, toCsv } from "../utils";

const NODE_WIDTH = 250;
const NODE_MIN_HEIGHT = 96;
const CANVAS_PADDING = 24;
const BASE_CANVAS_HEIGHT = 640;
const COL_GAP = 84;
const ROW_GAP = 56;
const MIN_ZOOM = 0.45;
const MAX_ZOOM = 2.25;

const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const groupByTable = (rows) => {
  const grouped = new Map();

  for (const row of rows) {
    if (!grouped.has(row.table_name)) {
      grouped.set(row.table_name, []);
    }
    grouped.get(row.table_name).push(row);
  }

  return grouped;
};

const toSvgPoint = (event, svgElement) => {
  const point = svgElement.createSVGPoint();
  point.x = event.clientX;
  point.y = event.clientY;
  const matrix = svgElement.getScreenCTM();
  if (!matrix) {
    return { x: 0, y: 0 };
  }
  const transformed = point.matrixTransform(matrix.inverse());
  return { x: transformed.x, y: transformed.y };
};

const toGraphPoint = (event, svgElement, viewport) => {
  const svgPoint = toSvgPoint(event, svgElement);
  return {
    x: (svgPoint.x - viewport.panX) / viewport.zoom,
    y: (svgPoint.y - viewport.panY) / viewport.zoom,
  };
};

const buildSchemaPayload = (grouped, relations) => {
  const relationCountByTable = new Map();

  for (const relation of relations) {
    const sourceTable = relation.table_name;
    const targetTable = relation.foreign_table;
    relationCountByTable.set(sourceTable, (relationCountByTable.get(sourceTable) || 0) + 1);
    relationCountByTable.set(targetTable, (relationCountByTable.get(targetTable) || 0) + 1);
  }

  const tables = Array.from(grouped.keys()).map((tableName) => {
    const columns = grouped.get(tableName) || [];
    return {
      tableName,
      columnCount: columns.length,
      relationCount: relationCountByTable.get(tableName) || 0,
      columns: columns.map((column) => ({
        name: column.column_name,
        type: column.data_type,
        nullable: column.is_nullable === "YES",
        defaultValue: column.column_default,
        isPrimaryKey: Boolean(column.is_primary_key),
        isForeignKey: Boolean(column.is_foreign_key),
      })),
    };
  });

  return {
    generatedAt: new Date().toISOString(),
    tableCount: tables.length,
    relationCount: relations.length,
    tables,
    relations: relations.map((relation) => ({
      sourceTable: relation.table_name,
      sourceColumn: relation.column_name,
      targetTable: relation.foreign_table,
      targetColumn: relation.foreign_column,
    })),
  };
};

const buildColumnsCsv = (schemaRows) =>
  toCsv(schemaRows, [
    "table_name",
    "column_name",
    "data_type",
    "is_nullable",
    "column_default",
    "is_primary_key",
    "is_foreign_key",
  ]);

const buildRelationsCsv = (relationRows) =>
  toCsv(relationRows, ["table_name", "column_name", "foreign_table", "foreign_column"]);

export default function DevSchema() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("columns");
  const [schema, setSchema] = useState([]);
  const [relations, setRelations] = useState([]);
  const [openTable, setOpenTable] = useState("");
  const [canvasWidth, setCanvasWidth] = useState(1080);
  const [nodeOverrides, setNodeOverrides] = useState({});
  const [viewport, setViewport] = useState({ zoom: 1, panX: 0, panY: 0 });
  const [tableSearch, setTableSearch] = useState("");
  const [isPackagingZip, setIsPackagingZip] = useState(false);
  const [zipError, setZipError] = useState("");

  const canvasWrapRef = useRef(null);
  const svgRef = useRef(null);
  const dragStateRef = useRef({ tableName: "", offsetX: 0, offsetY: 0 });
  const panStateRef = useRef({ active: false, pointerId: null, lastX: 0, lastY: 0 });

  useEffect(() => {
    let active = true;

    Promise.all([getDevSchema(), getDevRelations()])
      .then(([schemaPayload, relationPayload]) => {
        if (!active) {
          return;
        }

        const schemaRows = schemaPayload.data || [];
        setSchema(schemaRows);
        setRelations(relationPayload.data || []);

        if (schemaRows.length) {
          setOpenTable(schemaRows[0].table_name);
        }
      })
      .catch((requestError) => {
        if (active) {
          setError(requestError?.response?.data?.message || requestError.message || "Unable to load schema");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const grouped = useMemo(() => groupByTable(schema), [schema]);
  const tables = useMemo(() => Array.from(grouped.keys()), [grouped]);

  const tableMetrics = useMemo(() => {
    const metrics = new Map();

    for (const tableName of tables) {
      const columns = grouped.get(tableName) || [];
      const pkCount = columns.filter((column) => column.is_primary_key).length;
      const fkCount = columns.filter((column) => column.is_foreign_key).length;
      const previewCount = Math.min(8, columns.length);
      const height = NODE_MIN_HEIGHT + previewCount * 18;

      metrics.set(tableName, {
        pkCount,
        fkCount,
        previewCount,
        height,
      });
    }

    return metrics;
  }, [grouped, tables]);

  const graphSize = useMemo(() => {
    const tableCount = Math.max(tables.length, 1);
    const columns = Math.max(3, Math.ceil(Math.sqrt(tableCount)));
    const rows = Math.ceil(tableCount / columns);

    const minWidth = columns * (NODE_WIDTH + COL_GAP) + CANVAS_PADDING * 2;
    const width = Math.max(canvasWidth, minWidth);

    const tallestNode =
      Math.max(...Array.from(tableMetrics.values()).map((metric) => metric.height), NODE_MIN_HEIGHT) +
      ROW_GAP;
    const height = Math.max(BASE_CANVAS_HEIGHT, rows * tallestNode + CANVAS_PADDING * 2);

    return { width, height, columns };
  }, [canvasWidth, tableMetrics, tables.length]);

  const baseNodeMap = useMemo(() => {
    const next = {};
    const { width, columns } = graphSize;
    const xSpacing = NODE_WIDTH + COL_GAP;

    tables.forEach((tableName, index) => {
      const metric = tableMetrics.get(tableName) || { height: NODE_MIN_HEIGHT };
      const colIndex = index % columns;
      const rowIndex = Math.floor(index / columns);
      const x = CANVAS_PADDING + colIndex * xSpacing;
      const y = CANVAS_PADDING + rowIndex * (metric.height + ROW_GAP);

      next[tableName] = {
        x: clamp(x, CANVAS_PADDING, width - NODE_WIDTH - CANVAS_PADDING),
        y,
        height: metric.height,
      };
    });

    return next;
  }, [graphSize, tableMetrics, tables]);

  const nodeMap = useMemo(() => {
    const next = {};

    for (const tableName of tables) {
      const base = baseNodeMap[tableName];
      if (!base) {
        continue;
      }

      const override = nodeOverrides[tableName];
      const maxX = graphSize.width - NODE_WIDTH - CANVAS_PADDING;
      const maxY = graphSize.height - base.height - CANVAS_PADDING;

      if (!override) {
        next[tableName] = base;
        continue;
      }

      next[tableName] = {
        ...base,
        x: clamp(override.x, CANVAS_PADDING, maxX),
        y: clamp(override.y, CANVAS_PADDING, maxY),
      };
    }

    return next;
  }, [baseNodeMap, graphSize.height, graphSize.width, nodeOverrides, tables]);

  useEffect(() => {
    const element = canvasWrapRef.current;
    if (!element || typeof ResizeObserver === "undefined") {
      return undefined;
    }

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect?.width || 0;
      if (width > 0) {
        setCanvasWidth(Math.max(760, Math.floor(width)));
      }
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const schemaPayload = useMemo(() => buildSchemaPayload(grouped, relations), [grouped, relations]);
  const normalizedTableSearch = tableSearch.trim().toLowerCase();
  const hasSearch = Boolean(normalizedTableSearch);

  const matchedTableCount = useMemo(() => {
    if (!hasSearch) {
      return tables.length;
    }

    return tables.filter((tableName) => tableName.toLowerCase().includes(normalizedTableSearch)).length;
  }, [hasSearch, normalizedTableSearch, tables]);

  const getNodeSearchState = (tableName) => {
    if (!hasSearch) {
      return { isMatch: false, isDimmed: false };
    }

    const isMatch = tableName.toLowerCase().includes(normalizedTableSearch);
    return {
      isMatch,
      isDimmed: !isMatch,
    };
  };

  const isRelationMatch = (relation) => {
    if (!hasSearch) {
      return true;
    }

    return (
      relation.table_name.toLowerCase().includes(normalizedTableSearch) ||
      relation.foreign_table.toLowerCase().includes(normalizedTableSearch)
    );
  };

  const exportJson = () => {
    downloadJson("schema-docs.json", schemaPayload);
  };

  const exportColumnsCsv = () => {
    downloadCsv("schema-columns.csv", buildColumnsCsv(schema));
  };

  const exportRelationsCsv = () => {
    downloadCsv("schema-relations.csv", buildRelationsCsv(relations));
  };

  const exportZipBundle = async () => {
    setIsPackagingZip(true);
    setZipError("");

    try {
      const { default: JSZip } = await import("jszip");
      const zip = new JSZip();
      const generatedAt = new Date().toISOString();
      const safeStamp = generatedAt.replace(/[.:]/g, "-");

      zip.file("schema-docs.json", JSON.stringify(schemaPayload, null, 2));
      zip.file("schema-columns.csv", buildColumnsCsv(schema));
      zip.file("schema-relations.csv", buildRelationsCsv(relations));
      zip.file(
        "manifest.json",
        JSON.stringify(
          {
            generatedAt,
            tableCount: schemaPayload.tableCount,
            relationCount: schemaPayload.relationCount,
            files: ["schema-docs.json", "schema-columns.csv", "schema-relations.csv"],
          },
          null,
          2
        )
      );
      zip.file(
        "README.txt",
        [
          "Developer Portal Schema Export Bundle",
          "",
          "Files:",
          "- schema-docs.json: full schema and relationships in JSON.",
          "- schema-columns.csv: table/column metadata.",
          "- schema-relations.csv: foreign-key relations.",
          "- manifest.json: export metadata and file list.",
          "",
          `Generated at: ${generatedAt}`,
        ].join("\n")
      );

      const blob = await zip.generateAsync({ type: "blob" });
      downloadBlob(`schema-docs-bundle-${safeStamp}.zip`, blob);
    } catch (requestError) {
      setZipError(requestError?.message || "Unable to generate ZIP bundle");
    } finally {
      setIsPackagingZip(false);
    }
  };

  const zoomBy = (factor) => {
    setViewport((current) => ({
      ...current,
      zoom: clamp(Number((current.zoom * factor).toFixed(3)), MIN_ZOOM, MAX_ZOOM),
    }));
  };

  const resetViewport = () => {
    setViewport({ zoom: 1, panX: 0, panY: 0 });
  };

  const handleNodePointerDown = (event, tableName) => {
    if (event.button !== 0) {
      return;
    }

    const svgElement = svgRef.current;
    const node = nodeMap[tableName];

    if (!svgElement || !node) {
      return;
    }

    const pointer = toGraphPoint(event, svgElement, viewport);
    dragStateRef.current = {
      tableName,
      offsetX: pointer.x - node.x,
      offsetY: pointer.y - node.y,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
    event.stopPropagation();
  };

  const handleCanvasPointerDown = (event) => {
    if (event.button !== 0) {
      return;
    }

    if (event.target instanceof Element && event.target.closest(".dev-er-node")) {
      return;
    }

    const svgElement = svgRef.current;
    if (!svgElement) {
      return;
    }

    const point = toSvgPoint(event, svgElement);
    panStateRef.current = {
      active: true,
      pointerId: event.pointerId,
      lastX: point.x,
      lastY: point.y,
    };

    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event) => {
    const dragState = dragStateRef.current;

    const svgElement = svgRef.current;
    if (!svgElement) {
      return;
    }

    if (dragState.tableName) {
      const pointer = toGraphPoint(event, svgElement, viewport);
      const tableName = dragState.tableName;
      const node = nodeMap[tableName];

      if (!node) {
        return;
      }

      const maxX = graphSize.width - NODE_WIDTH - CANVAS_PADDING;
      const maxY = graphSize.height - node.height - CANVAS_PADDING;
      const x = clamp(pointer.x - dragState.offsetX, CANVAS_PADDING, maxX);
      const y = clamp(pointer.y - dragState.offsetY, CANVAS_PADDING, maxY);

      setNodeOverrides((previous) => ({
        ...previous,
        [tableName]: {
          x,
          y,
        },
      }));

      return;
    }

    const panState = panStateRef.current;
    if (!panState.active) {
      return;
    }

    const point = toSvgPoint(event, svgElement);
    const dx = point.x - panState.lastX;
    const dy = point.y - panState.lastY;

    panStateRef.current = {
      ...panState,
      lastX: point.x,
      lastY: point.y,
    };

    setViewport((current) => ({
      ...current,
      panX: current.panX + dx,
      panY: current.panY + dy,
    }));
  };

  const handlePointerUp = (event) => {
    dragStateRef.current = { tableName: "", offsetX: 0, offsetY: 0 };

    const panState = panStateRef.current;
    if (!panState.active) {
      return;
    }

    if (!event || panState.pointerId === event.pointerId) {
      panStateRef.current = { active: false, pointerId: null, lastX: 0, lastY: 0 };
    }
  };

  const handleWheelZoom = (event) => {
    event.preventDefault();

    const svgElement = svgRef.current;
    if (!svgElement) {
      return;
    }

    const pointer = toSvgPoint(event, svgElement);

    setViewport((current) => {
      const factor = event.deltaY > 0 ? 0.9 : 1.1;
      const nextZoom = clamp(Number((current.zoom * factor).toFixed(3)), MIN_ZOOM, MAX_ZOOM);

      if (nextZoom === current.zoom) {
        return current;
      }

      const worldX = (pointer.x - current.panX) / current.zoom;
      const worldY = (pointer.y - current.panY) / current.zoom;

      return {
        zoom: nextZoom,
        panX: pointer.x - worldX * nextZoom,
        panY: pointer.y - worldY * nextZoom,
      };
    });
  };

  if (loading) {
    return <div className="dev-card">Loading schema...</div>;
  }

  if (error) {
    return <div className="dev-card dev-error">{error}</div>;
  }

  return (
    <div className="dev-page-stack">
      <section className="dev-card">
        <div className="dev-card-head dev-schema-toolbar">
          <div className="dev-tabs">
            <button
              type="button"
              className={`dev-tab ${tab === "columns" ? "is-active" : ""}`}
              onClick={() => setTab("columns")}
            >
              Column Schema
            </button>
            <button
              type="button"
              className={`dev-tab ${tab === "relations" ? "is-active" : ""}`}
              onClick={() => setTab("relations")}
            >
              ER Canvas
            </button>
          </div>

          <div className="dev-inline-actions">
            <button type="button" className="dev-small-btn" onClick={exportJson}>
              Download JSON
            </button>
            <button type="button" className="dev-small-btn" onClick={exportColumnsCsv}>
              Columns CSV
            </button>
            <button type="button" className="dev-small-btn" onClick={exportRelationsCsv}>
              Relations CSV
            </button>
            <button
              type="button"
              className="dev-small-btn"
              onClick={exportZipBundle}
              disabled={isPackagingZip}
            >
              {isPackagingZip ? "Packaging ZIP..." : "Download ZIP"}
            </button>
          </div>
        </div>

        {zipError ? <div className="dev-error-box">{zipError}</div> : null}

        {tab === "columns" ? (
          <div className="dev-accordion-list">
            {tables.map((tableName) => {
              const rows = grouped.get(tableName) || [];
              const expanded = openTable === tableName;
              return (
                <article key={tableName} className="dev-accordion-item">
                  <button
                    type="button"
                    className="dev-accordion-head"
                    onClick={() => setOpenTable(expanded ? "" : tableName)}
                  >
                    <span className="dev-heading">{tableName}</span>
                    <span>{expanded ? "-" : "+"}</span>
                  </button>

                  {expanded ? (
                    <div className="dev-table-wrap">
                      <table className="dev-table">
                        <thead>
                          <tr>
                            <th>Column</th>
                            <th>Type</th>
                            <th>Nullable</th>
                            <th>Default</th>
                            <th>Key</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map((row) => (
                            <tr key={`${tableName}-${row.column_name}`}>
                              <td>{row.column_name}</td>
                              <td>{row.data_type}</td>
                              <td>{row.is_nullable === "YES" ? "✓" : "✗"}</td>
                              <td>{row.column_default || "-"}</td>
                              <td>
                                {row.is_primary_key ? <span className="dev-badge-pk">PK</span> : null}
                                {row.is_foreign_key ? <span className="dev-badge-fk">FK</span> : null}
                                {!row.is_primary_key && !row.is_foreign_key ? "-" : null}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        ) : (
          <div className="dev-page-stack">
            <p className="dev-muted">
              Drag table nodes to reorganize. Drag empty canvas to pan. Use mouse wheel to zoom.
            </p>

            <div className="dev-er-controls">
              <div className="dev-er-search-wrap">
                <input
                  className="dev-inline-input"
                  value={tableSearch}
                  onChange={(event) => setTableSearch(event.target.value)}
                  placeholder="Search table names in ER graph"
                />
                <small>
                  Matches: {matchedTableCount}/{tables.length}
                </small>
              </div>

              <div className="dev-inline-actions">
                <button type="button" className="dev-ghost-btn" onClick={() => zoomBy(0.9)}>
                  Zoom Out
                </button>
                <button type="button" className="dev-ghost-btn" onClick={() => zoomBy(1.1)}>
                  Zoom In
                </button>
                <button type="button" className="dev-ghost-btn" onClick={resetViewport}>
                  Reset View
                </button>
                <span className="dev-pill">{Math.round(viewport.zoom * 100)}%</span>
              </div>
            </div>

            <div className="dev-er-canvas-wrap" ref={canvasWrapRef}>
              <svg
                ref={svgRef}
                className="dev-er-canvas"
                viewBox={`0 0 ${graphSize.width} ${graphSize.height}`}
                onPointerDown={handleCanvasPointerDown}
                onPointerMove={handlePointerMove}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}
                onPointerCancel={handlePointerUp}
                onWheel={handleWheelZoom}
              >
                <defs>
                  <marker
                    id="dev-er-arrow"
                    markerWidth="10"
                    markerHeight="7"
                    refX="9"
                    refY="3.5"
                    orient="auto"
                  >
                    <polygon points="0 0, 10 3.5, 0 7" fill="#58a6ff" />
                  </marker>
                </defs>

                <g
                  className="dev-er-viewport"
                  transform={`translate(${viewport.panX} ${viewport.panY}) scale(${viewport.zoom})`}
                >
                  <g className="dev-er-links">
                    {relations.map((relation, index) => {
                      const source = nodeMap[relation.table_name];
                      const target = nodeMap[relation.foreign_table];

                      if (!source || !target) {
                        return null;
                      }

                      const x1 = source.x + NODE_WIDTH / 2;
                      const y1 = source.y + source.height / 2;
                      const x2 = target.x + NODE_WIDTH / 2;
                      const y2 = target.y + target.height / 2;
                      const curve = Math.max(38, Math.abs(x2 - x1) * 0.3);
                      const d = `M ${x1} ${y1} C ${x1 + curve} ${y1}, ${x2 - curve} ${y2}, ${x2} ${y2}`;
                      const relationMatch = isRelationMatch(relation);

                      return (
                        <path
                          key={`${relation.table_name}-${relation.column_name}-${index}`}
                          className={`dev-er-link ${relationMatch ? "is-match" : "is-dimmed"}`}
                          d={d}
                          markerEnd="url(#dev-er-arrow)"
                        >
                          <title>
                            {relation.table_name}.{relation.column_name} → {relation.foreign_table}.{relation.foreign_column}
                          </title>
                        </path>
                      );
                    })}
                  </g>

                  <g className="dev-er-nodes">
                    {tables.map((tableName) => {
                      const node = nodeMap[tableName];
                      if (!node) {
                        return null;
                      }

                      const columns = grouped.get(tableName) || [];
                      const previewColumns = columns.slice(0, 8);
                      const metric = tableMetrics.get(tableName) || {
                        pkCount: 0,
                        fkCount: 0,
                        previewCount: previewColumns.length,
                      };
                      const hasMore = columns.length > previewColumns.length;
                      const searchState = getNodeSearchState(tableName);

                      return (
                        <g
                          key={tableName}
                          className={`dev-er-node ${searchState.isMatch ? "is-match" : ""} ${searchState.isDimmed ? "is-dimmed" : ""}`}
                          transform={`translate(${node.x}, ${node.y})`}
                          onPointerDown={(event) => handleNodePointerDown(event, tableName)}
                        >
                          <rect width={NODE_WIDTH} height={node.height} rx="10" ry="10" />
                          <text x="12" y="22" className="dev-er-node-title">
                            {tableName}
                          </text>
                          <text x="12" y="40" className="dev-er-node-meta">
                            {columns.length} cols • {metric.pkCount} PK • {metric.fkCount} FK
                          </text>

                          {previewColumns.map((column, index) => (
                            <text key={column.column_name} x="12" y={58 + index * 16} className="dev-er-node-col">
                              {column.is_primary_key ? "PK " : ""}
                              {column.is_foreign_key ? "FK " : ""}
                              {column.column_name}
                            </text>
                          ))}

                          {hasMore ? (
                            <text x="12" y={58 + previewColumns.length * 16} className="dev-er-node-more">
                              +{columns.length - previewColumns.length} more columns
                            </text>
                          ) : null}
                        </g>
                      );
                    })}
                  </g>
                </g>
              </svg>
            </div>

            <div className="dev-table-wrap">
              <table className="dev-table">
                <thead>
                  <tr>
                    <th>Source Table.column</th>
                    <th>Target Table.column</th>
                  </tr>
                </thead>
                <tbody>
                  {relations.map((relation, index) => (
                    <tr key={`${relation.table_name}-${relation.column_name}-${index}`}>
                      <td>{relation.table_name}.{relation.column_name}</td>
                      <td>{relation.foreign_table}.{relation.foreign_column}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
