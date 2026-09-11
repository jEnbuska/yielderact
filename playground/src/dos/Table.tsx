/**
 * Table — bordered rows that light up under the pointer.
 *
 * Built from `div`s with ARIA table roles and CSS grid rather than native
 * table elements. Native `<table>` establishes its own layout algorithm that
 * has to measure every row, which defeats `content-visibility` — a grid of
 * divs lets rows be skipped entirely while off screen.
 *
 * `columns` is required: unlike `<table>`, a grid cannot size its own columns
 * from cell content, so the track list is declared once on the table and every
 * row inherits it through the `--dos-table-cols` custom property.
 *
 * Pass `rowHeight` to opt body rows into `content-visibility: auto`. It feeds
 * `contain-intrinsic-size`, so give the height a real row measures at —
 * a wrong value makes the scrollbar jump as rows are rendered.
 *
 * `caption` is required: a table with no caption gives a screen reader nothing
 * to announce when the user lands on it. Pass `visuallyHidden` when the design
 * has no room for it.
 */
import type { Children, ComponentProps } from "yract";
import { useId } from "yract";

export type CellAlign = "start" | "center" | "end";

const alignClass: Record<CellAlign, string> = {
  start: "",
  center: " dos-table__cell--center",
  end: " dos-table__cell--num",
};

export interface TableProps extends ComponentProps<"div"> {
  caption: Children;
  /** Grid track list shared by every row, e.g. `"2fr 1fr 1fr"`. */
  columns: string;
  /** Height a body row occupies, e.g. `"1.6em"`. Enables content-visibility. */
  rowHeight?: string;
  /** Keep the caption for screen readers but take it out of the layout. */
  visuallyHiddenCaption?: boolean;
}

export function* Table({
  caption,
  columns,
  rowHeight,
  visuallyHiddenCaption = true,
  children,
  ...rest
}: TableProps) {
  const captionId = yield* useId();
  return (
    <div
      className={rowHeight === undefined ? "dos-table" : "dos-table dos-table--skippable"}
      role="table"
      aria-labelledby={captionId}
      {...rest}
      style={{
        ...rest.style,
        "--dos-table-cols": columns,
        ...(rowHeight === undefined ? {} : { "--dos-table-row-h": rowHeight }),
      }}
    >
      <div
        className={visuallyHiddenCaption ? "dos-sr-only" : "dos-table__caption"}
        role="caption"
        id={captionId}
      >
        {caption}
      </div>
      {children}
    </div>
  );
}

export interface TableHeadProps extends ComponentProps<"div"> {
  /** Pin the header to the top of the nearest scroll container. */
  sticky?: boolean;
}

export function* TableHead({ sticky, children, ...rest }: TableHeadProps) {
  return (
    <div
      {...rest}
      className={sticky ? "dos-table__head dos-table__head--sticky" : "dos-table__head"}
      role="rowgroup"
    >
      {children}
    </div>
  );
}

export function* TableBody({ children, ...rest }: ComponentProps<"div">) {
  return (
    <div {...rest} className="dos-table__body" role="rowgroup">
      {children}
    </div>
  );
}

export interface TableRowProps extends ComponentProps<"div"> {}

export function* TableRow({ children, ...rest }: TableRowProps) {
  return (
    <div {...rest} className="dos-table__row" role="row">
      {children}
    </div>
  );
}

export interface TableHeadCellProps extends ComponentProps<"div"> {
  /** Which cells this header describes. Defaults to the column below it. */
  scope?: "col" | "row";
  align?: CellAlign;
  /** Makes the header a sort control and announces the current direction. */
  sort?: "ascending" | "descending" | "none";
}

export function* TableHeadCell({
  scope = "col",
  align = "start",
  onClick,
  sort,
  children,
  ...rest
}: TableHeadCellProps) {
  const sortable = onClick !== undefined;
  return (
    <div
      onClick={onClick}
      className={
        sortable
          ? `dos-table__head-cell dos-table__head-cell--sortable${alignClass[align]}`
          : `dos-table__head-cell${alignClass[align]}`
      }
      role={scope === "row" ? "rowheader" : "columnheader"}
      aria-sort={sortable ? (sort ?? "none") : undefined}
      tabIndex={sortable ? 0 : undefined}
      {...rest}
    >
      {children}
    </div>
  );
}

export interface TableCellProps extends ComponentProps<"div"> {
  /** Right-align, for figures that should line up on their last digit. */
  numeric?: boolean;
  align?: CellAlign;
}

export function* TableCell({ numeric, align, ...rest }: TableCellProps) {
  return (
    <div
      className={`dos-table__cell${alignClass[align ?? (numeric ? "end" : "start")]}`}
      role="cell"
      {...rest}
    />
  );
}
