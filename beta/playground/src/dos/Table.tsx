/**
 * Table — bordered rows that light up under the pointer.
 *
 * `caption` is required: a table with no caption gives a screen reader nothing
 * to announce when the user lands on it. Pass `visuallyHidden` when the design
 * has no room for it.
 */
import type { Children, PropsWithChildren } from "yract-beta";

export interface TableProps extends PropsWithChildren {
  caption: Children;
  /** Keep the caption for screen readers but take it out of the layout. */
  visuallyHiddenCaption?: boolean;
}

export function* Table({ caption, visuallyHiddenCaption = true, children }: TableProps) {
  return (
    <table className="dos-table">
      <caption className={visuallyHiddenCaption ? "dos-sr-only" : undefined}>{caption}</caption>
      {children}
    </table>
  );
}

export function* TableHead({ children }: PropsWithChildren) {
  return <thead>{children}</thead>;
}

export function* TableBody({ children }: PropsWithChildren) {
  return <tbody>{children}</tbody>;
}

export function* TableRow({ children }: PropsWithChildren) {
  return <tr className="dos-table__row">{children}</tr>;
}

export interface TableHeadCellProps extends PropsWithChildren {
  /** Which cells this header describes. Defaults to the column below it. */
  scope?: "col" | "row";
}

export function* TableHeadCell({ scope = "col", children }: TableHeadCellProps) {
  return (
    <th className="dos-table__head-cell" scope={scope}>
      {children}
    </th>
  );
}

export interface TableCellProps extends PropsWithChildren {
  /** Right-align, for figures that should line up on their last digit. */
  numeric?: boolean;
}

export function* TableCell({ numeric, children }: TableCellProps) {
  return (
    <td className={numeric ? "dos-table__cell dos-table__cell--num" : "dos-table__cell"}>
      {children}
    </td>
  );
}
