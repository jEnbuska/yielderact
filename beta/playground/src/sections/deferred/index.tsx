/**
 * DeferredDemo – large table with sort and search, wrapped in Deferred.
 *
 * Generates 5000 rows with 5 columns. The user can sort by the first
 * column and search by the first column or a combined text search
 * across all columns (datalist-style filtering).
 */
import { useEffect, useMemo, useRef, useStable, useState } from "yract-beta";
import { Window, WindowBar, WindowBody } from "../../dos";
import { getPersonRows } from "../../global-state";
import { TickChart } from "./-components/TickChart";
import { PersonTable, SortDir } from "./-components/PersonTable";
import { PersonRow } from "../../types";
import { PersonFiltering } from "./-components/PersonFiltering";

/* ── Table row ── */

/* ── Table (reads deferred context) ── */

/* ── Main demo ── */

export function* DeferredDemo() {
  const [search, setSearch] = yield* useState("");
  console.log("search", search);
  const [sortDir, setSortDir] = yield* useState<SortDir>("asc");
  const [count, _setCount] = yield* useState(40_000);

  const [rows, setRows] = yield* useState<PersonRow[] | undefined>(undefined);
  yield* useEffect(() => {
    const abortController = new AbortController();
    getPersonRows(15_000, abortController.signal).then((rows) => {
      void setRows(rows);
    });
    return () => abortController.abort();
  }, [count]);

  const filtered = yield* useMemo(
    (query: string, rows) => {
      let result = rows;
      if (!query) {
        return result;
      }
      const lower = query
        .toLowerCase()
        .split(" ")
        .map((word) => word.trim())
        .filter(Boolean);

      return result?.filter(({ name, id, department, city }) => {
        const combined = `${name} ${id} ${department} ${city}`.toLowerCase();
        return lower.every((word) => combined.includes(word));
      });
    },
    [search, rows],
  );

  const updatePerson = yield* useStable((person: PersonRow) => {
    if (!rows?.length) return;
    const index = rows.findIndex((row) => row.id === person.id);
    if (index === -1) throw new Error(`Person with id ${person.id} does not exist`);
    void setRows([...rows.slice(0, index), person, ...rows.slice(index + 1)]);
  });

  const updateSortDir = yield* useStable(() => {
    setSortDir((dir) => {
      console.log("SET SORT");
      if (dir === "desc") return "asc";
      return "desc";
    }).then(() => console.log("SORTED"));
  });

  const start = yield* useRef(Date.now());
  return (
    <Window>
      <WindowBar title="Defer Table" aside="/deferred" />
      <WindowBody>
        <h2>Deferred Table ({rows?.length ?? 0} rows)</h2>
        <p>
          Wrapping the table in <code>&lt;Deferred&gt;</code> keeps the input responsive while 5 000
          rows re-render. The table fades while deferred.
        </p>
        <PersonFiltering
          value={search}
          setValue={setSearch}
          matches={`${filtered?.length ?? 0}/${rows?.length ?? 0}`}
        />
        <PersonTable
          rows={filtered}
          sortDir={sortDir}
          onSort={updateSortDir}
          updatePerson={updatePerson}
        />

        <TickChart start={start.current} />
      </WindowBody>
    </Window>
  );
}
