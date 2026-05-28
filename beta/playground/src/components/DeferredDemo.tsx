/**
 * DeferredDemo – large table with sort and search, wrapped in Deferred.
 *
 * Generates 5000 rows with 5 columns. The user can sort by the first
 * column and search by the first column or a combined text search
 * across all columns (datalist-style filtering).
 */
import { $defer, $effect, $memo, $ref, $stable, $state, ComponentProps } from "yract-beta";

/* ── Data generation ── */

const FIRST_NAMES = [
  "Alice",
  "Bob",
  "Carol",
  "Dave",
  "Eve",
  "Frank",
  "Grace",
  "Hank",
  "Iris",
  "Jack",
  "Kate",
  "Leo",
  "Mona",
  "Nick",
  "Olga",
  "Pete",
  "Quinn",
  "Rita",
  "Sam",
  "Tina",
  "Uma",
  "Vic",
  "Wendy",
  "Xena",
  "Yuri",
  "Zara",
];

const DEPARTMENTS = [
  "Engineering",
  "Sales",
  "Marketing",
  "Support",
  "Finance",
  "Legal",
  "HR",
  "Design",
  "Operations",
  "Research",
];

const CITIES = [
  "Helsinki",
  "Berlin",
  "London",
  "Paris",
  "Tokyo",
  "New York",
  "Sydney",
  "Toronto",
  "Mumbai",
  "Seoul",
];

interface Row {
  id: string;
  name: string;
  department: string;
  city: string;
  score: number;
  active: boolean;
}

function generateRows(count: number): Row[] {
  const rows: Row[] = [];
  for (let i = 0; i < count; i++) {
    rows.push({
      id: `${i}`,
      name: FIRST_NAMES[i % FIRST_NAMES.length]!,
      department: DEPARTMENTS[i % DEPARTMENTS.length]!,
      city: CITIES[i % CITIES.length]!,
      score: Math.round(((i * 7 + 13) % 100) * 10) / 10,
      active: i % 3 !== 0,
    });
  }
  return rows;
}

const TOTAL_ROWS = 100_000;
const ALL_ROWS = generateRows(TOTAL_ROWS);

function* TableData({ children }: ComponentProps<"td">) {
  return <div role={"cell"}>{children}</div>;
}

/* ── Table row ── */

function* TableRow({ row }: { row: Row }) {
  return (
    <div
      style={{
        display: "grid",
        contentVisibility: "auto",
        containIntrinsicSize: "auto 18.5px",
        gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr",
      }}
      role="row"
    >
      <TableData>
        {row.name} - {row.id}
      </TableData>
      <div role={"cell"}>{row.department}</div>
      <TableData>{row.city}</TableData>
      <div role={"cell"} style={{ textAlign: "right" }}>
        {row.score}
      </div>
      <TableData style={{ textAlign: "center" }}>{"search"}</TableData>
    </div>
  );
}

/* ── Table (reads deferred context) ── */

type SortDir = "asc" | "desc" | "none";

function* Example({
  rows,
  sortDir,
  onSort,
  search,
}: {
  rows: Row[];
  sortDir: SortDir;
  onSort: () => void;
  search: string;
}) {
  const sortLabel = sortDir === "asc" ? " ▲" : sortDir === "desc" ? " ▼" : "";
  const sortedRows = yield* $memo(() => {
    return rows.toSorted((a, b) => {
      let cmp: number;
      if (a.name === b.name) {
        cmp = Number(a.id) - Number(b.id);
      } else {
        cmp = a.name.localeCompare(b.name);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [sortDir, rows]);
  const [Defer, deferring] = yield* $defer();
  return (
    <div
      style={{
        maxHeight: "400px",
        overflow: "auto",
        border: "1px solid #ddd",
        borderRadius: "4px",
      }}
    >
      <div
        data-testid="Defer-table"
        role="table"
        style={{
          fontSize: "0.85rem",
          transition: "opacity 0.15s",
          width: "100%",
        }}
      >
        <div
          style={{
            position: "sticky",
            top: 0,
            background: "#f0f0f0",
            zIndex: 1,
          }}
        >
          <div role="row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr" }}>
            <div
              role={"columnheader"}
              data-testid="sort-name"
              onClick={onSort}
              style={{
                cursor: "pointer",
                padding: "0.5rem",
                textAlign: "left",
                userSelect: "none",
              }}
            >
              Name{sortLabel}
            </div>
            <div role={"columnheader"} style={{ padding: "0.5rem", textAlign: "left" }}>
              Department
            </div>
            <div role={"columnheader"} style={{ padding: "0.5rem", textAlign: "left" }}>
              City
            </div>
            <div role={"columnheader"} style={{ padding: "0.5rem", textAlign: "right" }}>
              Score
            </div>
            <div role={"columnheader"} style={{ padding: "0.5rem", textAlign: "center" }}>
              Search
            </div>
          </div>
        </div>
        <div style={{ position: "relative", opacity: deferring ? "0.5" : "1" }}>
          <Defer>
            <TableBody rows={sortedRows} search={search} />
          </Defer>
        </div>
      </div>
    </div>
  );
}

function* TableBody({ rows }: { rows: Row[]; search: string }) {
  return (
    <div role="rowgroup">
      {rows.map((row) => (
        <TableRow key={String(row.id)} row={row} deps={[row]} />
      ))}
    </div>
  );
}

/* ── Main demo ── */

export function* DeferredDemo() {
  const [search, setSearch] = yield* $state("");
  const [sortDir, setSortDir] = yield* $state<SortDir>("asc");

  const filtered = yield* $memo(
    (query: string) => {
      let result = ALL_ROWS;
      if (!query) {
        return result;
      }
      const lower = query.toLowerCase();
      return result.filter((row) => {
        const combined = `${row.name} ${row.id} ${row.department} ${row.city} ${row.score} ${row.active ? "yes" : "no"}`;
        return combined.toLowerCase().includes(lower);
      });
    },
    [search],
  );

  const updateSortDir = yield* $stable(() => {
    setSortDir((dir) => {
      if (dir === "desc") return "asc";
      return "desc";
    }).then(() => console.log("SORTED"));
  });

  const [ticks, setTicks] = yield* $state([{ id: "a", tick: Date.now() }]);
  yield* $effect((signal) => {
    const handle = setInterval(() => {
      setTicks((prev) => [
        ...prev.slice(Math.max(0, prev.length - 100)),
        { id: `${Math.random()}`, tick: Date.now() },
      ]);
    }, 100);
    signal.onabort = () => clearInterval(handle);
  });
  const start = yield* $ref(Date.now());

  return (
    <section aria-label="Deferred table example">
      <h2>Deferred Table ({TOTAL_ROWS} rows)</h2>
      <p>Tick {ticks[ticks.length - 1].tick}</p>
      <p>
        Wrapping the table in <code>&lt;Deferred&gt;</code> keeps the input responsive while 5 000
        rows re-render. The table fades while deferred.
      </p>
      <div
        style={{ display: "flex", gap: "0.75rem", marginBottom: "0.75rem", alignItems: "center" }}
      >
        <input
          data-testid="search-input"
          type="text"
          placeholder="Search all columns..."
          value={search}
          onInput={(e) => setSearch((e.target as HTMLInputElement).value)}
          style={{
            padding: "0.4rem 0.6rem",
            borderRadius: "4px",
            border: "1px solid #ccc",
            flex: "1",
            maxWidth: "300px",
          }}
        />
        <span data-testid="row-count" style={{ fontSize: "0.85rem", color: "#666" }}>
          {filtered.length} / {ALL_ROWS.length} rows
        </span>
      </div>
      <Example rows={filtered} sortDir={sortDir} onSort={updateSortDir} search={search} />
      <TickChart entries={ticks} start={start.current} />
    </section>
  );
}

/**
 * TickChart — visualizes inter-tick durations over time.
 *
 * For each consecutive pair of entries, plots a point at
 * `(entry.tick, entry.tick - prev.tick)`:
 *   - X axis: absolute tick time (ms)
 *   - Y axis: gap since previous tick (ms)
 *
 * The first entry has no previous tick and is not plotted, so an `entries`
 * array of length N produces N - 1 points. Caller is responsible for
 * passing entries sorted by `tick` ascending; no internal sorting is done.
 *
 * Edge cases:
 *   - 0 or 1 entries → empty state placeholder.
 *   - All ticks equal → flat line at y=0 (yMax falls back to 1).
 *
 * @param {Object} props
 * @param {Array<{tick: number, id: string}>} props.entries
 *   Up to 200 entries. Each entry needs `tick` (ms) and `id` (string, used as React key).
 * @param {number} [props.width=600]   SVG width in pixels.
 * @param {number} [props.height=300]  SVG height in pixels.
 */

type TickChartProps = {
  width?: number;
  height?: number;
  start: number;
  entries: Array<{ tick: number; id: string }>;
};
export function* TickChart({ entries, width = 1080, height = 300, start }: TickChartProps) {
  const points = yield* $memo(() => {
    if (entries.length < 2) return [];
    const out = [];
    for (let i = 1; i < entries.length; i++) {
      out.push({
        tick: Math.round((entries[i].tick - start) / 100) / 10,
        delta: entries[i].tick - entries[i - 1].tick,
        id: entries[i].id,
      });
    }
    return out;
  }, [entries, start]);

  if (points.length === 0) {
    return (
      <svg width={width} height={height} role="img" aria-label="No tick data">
        <text x={width / 2} y={height / 2} textAnchor="middle" fill="#888" fontSize="14">
          Need at least 2 entries to render
        </text>
      </svg>
    );
  }

  const padding = { top: 20, right: 20, bottom: 40, left: 55 };
  const innerW = width - padding.left - padding.right;
  const innerH = height - padding.top - padding.bottom;

  const xMin = points[0].tick;
  const xMax = points[points.length - 1].tick;
  const xRange = xMax - xMin || 1;
  const rawYMax = Math.max(...points.map((p) => p.delta));
  const yMax = rawYMax === 0 ? 1 : rawYMax * 1.1; // 10% headroom

  const xScale = (t: number) => padding.left + ((t - xMin) / xRange) * innerW;
  const yScale = (d: number) => padding.top + innerH - (d / yMax) * innerH;

  const path = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${xScale(p.tick)} ${yScale(p.delta)}`)
    .join(" ");

  const yTickCount = 5;
  const yTickValues = Array.from({ length: yTickCount + 1 }, (_, i) => (yMax * i) / yTickCount);
  const xTickCount = 5;
  const xTickValues = Array.from(
    { length: xTickCount + 1 },
    (_, i) => xMin + (xRange * i) / xTickCount,
  );

  return (
    <svg width={width} height={height} role="img" aria-label="Tick duration chart">
      {/* Y gridlines + labels */}
      {yTickValues.map((v, i) => (
        <g key={`y-${i}`}>
          <line
            x1={padding.left}
            x2={width - padding.right}
            y1={yScale(v)}
            y2={yScale(v)}
            stroke="#eee"
          />
          <text x={padding.left - 8} y={yScale(v) + 4} textAnchor="end" fontSize="11" fill="#666">
            {v.toFixed(1)}
          </text>
        </g>
      ))}

      {/* X axis labels */}
      {xTickValues.map((v, i) => (
        <text
          key={`x-${i}`}
          x={xScale(v)}
          y={height - padding.bottom + 18}
          textAnchor="middle"
          fontSize="11"
          fill="#666"
        >
          {v.toFixed(0)}
        </text>
      ))}

      {/* Axes */}
      <line
        x1={padding.left}
        y1={padding.top}
        x2={padding.left}
        y2={height - padding.bottom}
        stroke="#333"
      />
      <line
        x1={padding.left}
        y1={height - padding.bottom}
        x2={width - padding.right}
        y2={height - padding.bottom}
        stroke="#333"
      />

      {/* Data line + dots */}
      <path d={path} fill="none" stroke="#7c3aed" strokeWidth="1.5" />
      {points.map((p) => (
        <circle key={p.id} cx={xScale(p.tick)} cy={yScale(p.delta)} r="2.5" fill="#7c3aed">
          <title>{`${p.id}: ${p.delta.toFixed(2)}ms @ ${p.tick.toFixed(0)}ms`}</title>
        </circle>
      ))}

      {/* Axis titles */}
      <text x={width / 2} y={height - 5} textAnchor="middle" fontSize="12" fill="#333">
        tick (ms)
      </text>
      <text
        x={-(height / 2)}
        y={15}
        transform="rotate(-90)"
        textAnchor="middle"
        fontSize="12"
        fill="#333"
      >
        Δ since prev (ms)
      </text>
    </svg>
  );
}
