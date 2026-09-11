/**
 * Sidebar — grouped destinations with counts, and the shell that pairs one
 * with its content pane.
 *
 * Composed: `<Sidebar label="Sections"><SidebarGroup>…</SidebarGroup>
 * <SidebarLink count={24} current>Users</SidebarLink></Sidebar>`.
 */
import { useContext } from "yract";
import type { ComponentProps } from "yract";
import { ScreenContext } from "./Screen";

export interface SidebarProps extends ComponentProps<"nav"> {
  label: string;
}

export function* Sidebar({ label, children, ...rest }: SidebarProps) {
  return (
    <nav {...rest} className="dos-sidebar" aria-label={label}>
      {children}
    </nav>
  );
}

/**
 * Section heading inside the sidebar. It is a real heading, and returns its id
 * so the links under it can point at it with `aria-describedby`.
 */
export function* SidebarGroup({ children, ...rest }: ComponentProps<"h3">) {
  return (
    <h3 {...rest} className="dos-sidebar__group">
      {children}
    </h3>
  );
}

export interface SidebarLinkProps extends ComponentProps<"a"> {
  href: string;
  current?: boolean;
  /** Item count. Announced as "…, 24 items" rather than a bare number. */
  count?: number;
  /** `<a>` has no `disabled`, so the kit marks it with `aria-disabled`. */
  disabled?: boolean;
  /** Spoken-only note on why a disabled link cannot be followed. */
  disabledReason?: string;
}

export function* SidebarLink({
  current,
  count,
  disabled,
  disabledReason = "unavailable",
  children,
  ...rest
}: SidebarLinkProps) {
  return (
    <a
      {...rest}
      className="dos-sidebar__link"
      aria-current={current ? "page" : undefined}
      aria-disabled={disabled ? "true" : undefined}
      tabIndex={disabled ? -1 : undefined}
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
    </a>
  );
}

/** Two-column app shell: the sidebar beside the pane it drives. */
export function* Shell({ children, ...rest }: ComponentProps<"div">) {
  return (
    <div {...rest} className="dos-shell">
      {children}
    </div>
  );
}

export function* ShellMain({ children, ...rest }: ComponentProps<"div">) {
  const { mainId } = yield* useContext(ScreenContext);
  return (
    <div {...rest} className="dos-shell__main" id={mainId}>
      {children}
    </div>
  );
}
