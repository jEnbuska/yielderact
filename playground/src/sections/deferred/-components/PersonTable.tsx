import type  { PersonRow } from "../../../types";
import { useDefer, useMemo, useRef } from "yract";
import {
  LoaderTrain,
  Select,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeadCell,
  TableRow,
} from "../../../dos";
import { DEPARTMENTS } from "../../../global-state";

const formatter = new Intl.DateTimeFormat("fi", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

export type SortDir = "asc" | "desc" | "none";

type UpdatePerson = (person: PersonRow) => void;

export function* PersonTable({
  rows,
  sortDir,
  onSort,
  updatePerson,
}: {
  rows: readonly PersonRow[] | undefined;
  sortDir: SortDir;
  onSort: () => void;
  updatePerson: UpdatePerson;
}) {
  const sortLabel = sortDir === "asc" ? " ▲" : sortDir === "desc" ? " ▼" : "";
  const sortedRows = yield* useMemo(() => {
    return rows?.toSorted((a, b) => {
      let cmp: number;
      if (a.name === b.name) {
        cmp = Number(a.id) - Number(b.id);
      } else {
        cmp = a.name.localeCompare(b.name);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [sortDir, rows]);
  const [Defer, deferring] = yield* useDefer();
  return (
    <Table
      caption="People by name, department and city"
      columns="1fr 1fr 1fr 1fr 1fr"
      rowHeight="18.5px"
      data-testid="Defer-table"
      style={{ maxHeight: "500px", overflowY: "auto", opacity: deferring ? 0.5 : 1 }}
    >
      <TableHead sticky>
        <TableRow>
          <TableHeadCell
            onClick={onSort}
            sort={sortDir === "none" ? "none" : sortDir === "asc" ? "ascending" : "descending"}
            data-testid="sort-name"
          >
            Name{sortLabel}
          </TableHeadCell>
          <TableHeadCell id="persons-department">Department</TableHeadCell>
          <TableHeadCell>City</TableHeadCell>
          <TableHeadCell align="center">Mounted at</TableHeadCell>
          <TableHeadCell align="center">Re-renders</TableHeadCell>
        </TableRow>
      </TableHead>
      <Defer>
        {!sortedRows ? (
          <LoaderTrain label={"Deferred rendering…"} />
        ) : (
          <PersonTableBody rows={sortedRows} updatePerson={updatePerson} />
        )}
      </Defer>
    </Table>
  );
}
function* PersonTableBody({
  rows,
  updatePerson,
}: {
  rows: readonly PersonRow[];
  updatePerson: UpdatePerson;
}) {
  const mounted = yield* useRef(new Date());
  const renders = yield* useRef(0);
  renders.current++;

  return (
    <TableBody>
      <TableRow style={{ fontWeight: "bold" }}>
        <TableCell>{"Table body"}</TableCell>
        <TableCell>{"-"}</TableCell>
        <TableCell>{"-"}</TableCell>
        <TableCell align="center">
          {formatter.format(mounted.current)},<i>{mounted.current.getMilliseconds()}</i>
        </TableCell>
        <TableCell align="center">{renders.current}</TableCell>
      </TableRow>
      {rows.map((row) => (
        <PersonTableRow key={row.id} row={row} deps={[row]} updatePerson={updatePerson} />
      ))}
    </TableBody>
  );
}

function* PersonTableRow({ row, updatePerson }: { row: PersonRow; updatePerson: UpdatePerson }) {
  const mounted = yield* useRef(new Date());
  const renders = yield* useRef(0);
  renders.current++;

  return (
    <TableRow>
      <TableCell id={`${row.id}-name`}>
        {row.name} - {row.id}
      </TableCell>
      <TableCell>
        <Select
          value={row.department}
          aria-labelledby={`${row.id}-name person-department`}
          onValueChange={(department) => {
            updatePerson({ ...row, department });
          }}
        >
          {DEPARTMENTS.map((d) => (
            <option value={d}>{d}</option>
          ))}
        </Select>
      </TableCell>
      <TableCell>{row.city}</TableCell>
      <TableCell align="center">
        {formatter.format(mounted.current)},<i>{mounted.current.getMilliseconds()}</i>
      </TableCell>
      <TableCell align="center">{renders.current}</TableCell>
    </TableRow>
  );
}
