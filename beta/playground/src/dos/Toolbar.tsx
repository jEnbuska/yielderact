/**
 * MenuBar and BreadCrumbs — the two chrome strips.
 *
 * Both are toolbars: one tab stop for the whole group, arrow keys within it.
 * That is what keeps a ten-item menu bar from costing a keyboard user ten
 * presses to get past.
 */
import type { Children, PropsWithChildren } from "yract-beta";
import { useRoving } from "./roving";

export interface ToolbarProps extends PropsWithChildren {
  label: string;
}

export function* MenuBar({ label, children }: ToolbarProps) {
  const { containerRef, onKeydown } = yield* useRoving<HTMLDivElement>("horizontal", true);
  return (
    <div
      className="dos-menubar"
      role="toolbar"
      aria-label={label}
      ref={containerRef}
      onKeydown={onKeydown}
    >
      {children}
    </div>
  );
}

export interface ToolbarItemProps extends PropsWithChildren {
  onClick?: () => void;
  /** Spoken name, when the visible label is an abbreviation or a glyph. */
  "aria-label"?: string;
}

export function* MenuBarItem({ onClick, children, ...rest }: ToolbarItemProps) {
  return (
    <button
      className="dos-menubar__item"
      type="button"
      data-dos-item=""
      aria-label={rest["aria-label"]}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export interface BreadCrumbsProps extends ToolbarProps {
  /** Trailing text, pushed to the right end of the bar. */
  hint?: Children;
}

export function* BreadCrumbs({ label, hint, children }: BreadCrumbsProps) {
  const { containerRef, onKeydown } = yield* useRoving<HTMLDivElement>("horizontal", true);
  return (
    <div
      className="dos-statusbar"
      role="toolbar"
      aria-label={label}
      ref={containerRef}
      onKeydown={onKeydown}
    >
      {children}
      <span className="dos-statusbar__hint" shown={hint !== undefined}>
        {hint}
      </span>
    </div>
  );
}

export function* Crumb({ onClick, children, ...rest }: ToolbarItemProps) {
  return (
    <button
      className="dos-statusbar__item"
      type="button"
      data-dos-item=""
      aria-label={rest["aria-label"]}
      onClick={onClick}
    >
      {children}
    </button>
  );
}
