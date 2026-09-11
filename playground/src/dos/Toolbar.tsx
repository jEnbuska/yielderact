/**
 * MenuBar and BreadCrumbs — the two chrome strips.
 *
 * Both are toolbars: one tab stop for the whole group, arrow keys within it.
 * That is what keeps a ten-item menu bar from costing a keyboard user ten
 * presses to get past.
 */
import type { Children, ComponentProps } from "yract";
import { useRoving } from "./roving";

export interface ToolbarProps extends ComponentProps<"div"> {
  label: string;
}

export function* MenuBar({ label, children, ...rest }: ToolbarProps) {
  const { containerRef, onKeydown } = yield* useRoving<HTMLDivElement>("horizontal", true);
  return (
    <div
      {...rest}
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

export interface ToolbarItemProps extends ComponentProps<"button"> {}

export function* MenuBarItem({ children, ...rest }: ToolbarItemProps) {
  return (
    <button {...rest} className="dos-menubar__item" type="button" data-dos-item="">
      {children}
    </button>
  );
}

export interface BreadCrumbsProps extends ToolbarProps {
  /** Trailing text, pushed to the right end of the bar. */
  hint?: Children;
}

export function* BreadCrumbs({ label, hint, children, ...rest }: BreadCrumbsProps) {
  const { containerRef, onKeydown } = yield* useRoving<HTMLDivElement>("horizontal", true);
  return (
    <div
      {...rest}
      className="dos-statusbar"
      role="toolbar"
      aria-label={label}
      ref={containerRef}
      onKeydown={onKeydown}
    >
      {children}
      {!!hint && <span className="dos-statusbar__hint">{hint}</span>}
    </div>
  );
}

export function* Crumb({ children, ...rest }: ToolbarItemProps) {
  return (
    <button {...rest} className="dos-statusbar__item" type="button" data-dos-item="">
      {children}
    </button>
  );
}
