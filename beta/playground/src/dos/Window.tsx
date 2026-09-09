/**
 * Window — the raised panel with a title bar, plus the two recessed surfaces
 * that live inside it.
 *
 * Pass `labelledBy` an id you also give the title, so the section is named for
 * assistive tech without inventing a heading the design does not show.
 */
import type { Children, PropsWithChildren } from "yract-beta";

export interface WindowProps extends PropsWithChildren {
  id?: string;
  /** Id of the element naming this window, usually its `WindowBar` title. */
  labelledBy?: string;
  /** Shallower drop shadow, for a window nested inside another panel. */
  nested?: boolean;
}

export function* Window({ id, labelledBy, nested, children }: WindowProps) {
  return (
    <section
      className={nested ? "dos-win dos-win--nested" : "dos-win"}
      id={id}
      aria-labelledby={labelledBy}
    >
      {children}
    </section>
  );
}

export interface WindowBarProps {
  title: Children;
  /** Right-hand slot: a close glyph, a tag list, whatever the window needs. */
  aside?: Children;
  titleId?: string;
}

export function* WindowBar({ title, aside, titleId }: WindowBarProps) {
  return (
    <div className="dos-win__bar">
      <span id={titleId}>{title}</span>
      {!!aside && <span>{aside}</span>}
    </div>
  );
}

export function* WindowBody({ children }: PropsWithChildren) {
  return <div className="dos-win__body">{children}</div>;
}

export interface WellProps extends PropsWithChildren {
  /** Minimal padding, for a well that only frames a list. */
  flush?: boolean;
}

export function* Well({ flush, children }: WellProps) {
  return <div className={flush ? "dos-well dos-well--flush" : "dos-well"}>{children}</div>;
}

/** Black terminal surface. Content keeps its whitespace, as in a real console. */
export function* Terminal({ children }: PropsWithChildren) {
  return <pre className="dos-term">{children}</pre>;
}

export type TerminalToneName = "hi" | "ok" | "warn" | "err";

export function* TerminalTone({ tone, children }: PropsWithChildren & { tone: TerminalToneName }) {
  return <span className={`dos-term__${tone}`}>{children}</span>;
}
