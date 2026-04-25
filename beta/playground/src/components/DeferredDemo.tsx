/**
 * DeferredDemo – large table with sort and search, wrapped in Deferred.
 *
 * Generates 5000 rows with 5 columns. The user can sort by the first
 * column and search by the first column or a combined text search
 * across all columns (datalist-style filtering).
 */
import { $effect, $memo, $stable, $state, createContext, Defer } from "yract-beta";
import { ComponentProps } from "../../../src/jsx";

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

const TOTAL_ROWS = 25_000;
const ALL_ROWS = generateRows(TOTAL_ROWS);

function* TableData({ children }: ComponentProps<"td">) {
  return <td>{children}</td>;
}

/* ── Table row ── */

function* TableRow({ row, index }: { row: Row; index: number }) {
  if (row.id === "1") console.log("render", row.name, index);
  yield* $effect(() => {
    if (row.id === "1") console.log("MOUNTED", row.name, "At index", index);
  }, [index]);
  return (
    <tr>
      <TableData>{index}</TableData>
      <TableData>
        {row.name} - {row.id}
      </TableData>
      <td>{row.department}</td>
      <TableData>{row.city}</TableData>
      <td style={{ textAlign: "right" }}>{row.score}</td>
      <TableData style={{ textAlign: "center" }}>{row.active ? "Yes" : "No"}</TableData>
    </tr>
  );
}

/* ── Table (reads deferred context) ── */

type SortDir = "asc" | "desc" | "none";

const SearchContext = createContext("");

function* Table({ rows, sortDir, onSort }: { rows: Row[]; sortDir: SortDir; onSort: () => void }) {
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
  return (
    <div
      style={{
        maxHeight: "400px",
        overflow: "auto",
        border: "1px solid #ddd",
        borderRadius: "4px",
      }}
    >
      <table
        data-testid="Defer-table"
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "0.85rem",
          opacity: false ? "0.5" : "1",
          transition: "opacity 0.15s",
        }}
      >
        <thead style={{ position: "sticky", top: 0, background: "#f0f0f0" }}>
          <tr>
            <th
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
            </th>
            <th style={{ padding: "0.5rem", textAlign: "left" }}>Department</th>
            <th style={{ padding: "0.5rem", textAlign: "left" }}>City</th>
            <th style={{ padding: "0.5rem", textAlign: "right" }}>Score</th>
            <th style={{ padding: "0.5rem", textAlign: "center" }}>Active</th>
          </tr>
        </thead>
        <tbody data-testid="table-body">
          {sortedRows.map((row, index) => (
            <TableRow key={String(row.id)} row={row} index={index} />
          ))}
        </tbody>
      </table>
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
    }).then((it) => console.log("SORTED"));
  });

  const [tick, setTick] = yield* $state(0);
  yield* $effect((signal) => {
    /*const interval = setInterval(() => {
      setTick((prev) => Math.round((prev + 0.1) * 10) / 10);
    }, 100);
    signal.onabort = () => {
      clearInterval(interval);
    };*/
  });

  let tickStr = `${tick}`;
  if (!tickStr.includes(".")) {
    tickStr = `${tick}.0`;
  }
  return (
    <section aria-label="Deferred table example">
      <h2>Deferred Table ({TOTAL_ROWS} rows)</h2>
      <p>Tick {tickStr}</p>
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
      <Defer value={true}>
        <div>
          <Table rows={filtered} sortDir={sortDir} onSort={updateSortDir} />
        </div>
      </Defer>
    </section>
  );
}
