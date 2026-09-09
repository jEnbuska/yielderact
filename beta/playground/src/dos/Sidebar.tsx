/**
 * Sidebar — grouped destinations with counts, and the shell that pairs one
 * with its content pane.
 *
 * Composed: `<Sidebar label="Sections"><SidebarGroup>…</SidebarGroup>
 * <SidebarLink count={24} current>Users</SidebarLink></Sidebar>`.
 */
import type { PropsWithChildren } from "yract-beta";
import { Link } from "../fake-router/Link";

export interface SidebarProps extends PropsWithChildren {
  label: string;
  "data-testid"?: string;
}

export function* Sidebar({ label, children, ...rest }: SidebarProps) {
  return (
    <nav className="dos-sidebar" aria-label={label} data-testid={rest["data-testid"]}>
      {children}
    </nav>
  );
}

/**
 * Section heading inside the sidebar. It is a real heading, and returns its id
 * so the links under it can point at it with `aria-describedby`.
 */
export function* SidebarGroup({ id, children }: PropsWithChildren & { id?: string }) {
  return (
    <h3 className="dos-sidebar__group" id={id}>
      {children}
    </h3>
  );
}

export interface SidebarLinkProps extends PropsWithChildren {
  href: string;
  current?: boolean;
  /** Item count. Announced as "…, 24 items" rather than a bare number. */
  count?: number;
  /** Id of the `SidebarGroup` this link sits under. */
  describedBy?: string;
  disabled?: boolean;
  /** Spoken-only note on why a disabled link cannot be followed. */
  disabledReason?: string;
  "data-testid"?: string;
}

export function* SidebarLink({
  href,
  current,
  count,
  describedBy,
  disabled,
  disabledReason = "unavailable",
  children,
  ...rest
}: SidebarLinkProps) {
  return (
    <Link
      className="dos-sidebar__link"
      href={href}
      aria-current={current ? "page" : undefined}
      aria-describedby={describedBy}
      aria-disabled={disabled ? "true" : undefined}
      tabIndex={disabled ? -1 : undefined}
      data-testid={rest["data-testid"]}
    >
      <span>
        {children}
        {!!disabled && <span className="dos-sr-only">{` (${disabledReason})`}</span>}
      </span>
      {count !== undefined && (
        <span className="dos-sidebar__count" aria-hidden="true">
          {count}
        </span>
      )}
      {count !== undefined && <span className="dos-sr-only">{`, ${count} items`}</span>}
    </Link>
  );
}

/** Two-column app shell: the sidebar beside the pane it drives. */
export function* Shell({ children }: PropsWithChildren) {
  return <div className="dos-shell">{children}</div>;
}

export function* ShellMain({ children }: PropsWithChildren) {
  return <div className="dos-shell__main">{children}</div>;
}
