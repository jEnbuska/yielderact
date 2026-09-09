/**
 * Nav — the top bar of destinations.
 *
 * Composed: `<Nav brand="dos.css"><NavLink current>Text</NavLink>…</Nav>`.
 * The bar brings its own edges, so it reads as chrome on bare screen without
 * a card around it.
 */
import type { Children, PropsWithChildren } from "yract-beta";
import { Link } from "../fake-router/Link";

export interface NavProps extends PropsWithChildren {
  /** Names the landmark. Two navs on a page must not share a label. */
  label: string;
  "data-testid"?: string;
  /** Optional product cell at the left end of the bar. */
  brand?: Children;
  /** Stick to the top of the viewport as the page scrolls. */
  sticky?: boolean;
}

export function* Nav({ label, brand, sticky, children, ...rest }: NavProps) {
  return (
    <nav
      className={sticky ? "dos-nav-bar dos-nav-bar--page" : "dos-nav-bar"}
      aria-label={label}
      data-testid={rest["data-testid"]}
    >
      {!!brand && <span className="dos-nav-bar__brand">{brand}</span>}
      {children}
      <span className="dos-nav-bar__spacer" />
    </nav>
  );
}

export interface NavLinkProps extends PropsWithChildren {
  href: string;
  /** Marks this as the page you are on — `aria-current`, not just a colour. */
  current?: boolean;
  "data-testid"?: string;
}

export function* NavLink({ href, current, children, ...rest }: NavLinkProps) {
  return (
    <Link
      className="dos-nav-bar__link"
      href={href}
      aria-current={current ? "page" : undefined}
      data-testid={rest["data-testid"]}
    >
      {children}
    </Link>
  );
}
