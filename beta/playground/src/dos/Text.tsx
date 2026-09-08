/**
 * Type primitives — headings, body copy, inline marks.
 *
 * `Heading` takes a `level`, which sets both the tag and the style, so the
 * document outline and the visual hierarchy cannot drift apart. Use `onScreen`
 * where the text sits on the blue ground rather than on a gray panel.
 */
import type { Children, PropsWithChildren } from "yract-beta";

export interface HeadingProps extends PropsWithChildren {
  level: 1 | 2 | 3;
  /** Lightens the text for the blue screen background. */
  onScreen?: boolean;
  id?: string;
  "data-testid"?: string;
}

export function* Heading({ level, onScreen, id, children, ...rest }: HeadingProps) {
  const className = `dos-h${level}${onScreen ? ` dos-h${level}--screen` : ""}`;
  const testId = rest["data-testid"];
  if (level === 1) {
    return (
      <h1 className={className} id={id} data-testid={testId}>
        {children}
      </h1>
    );
  }
  if (level === 2) {
    return (
      <h2 className={className} id={id} data-testid={testId}>
        {children}
      </h2>
    );
  }
  return (
    <h3 className={className} id={id} data-testid={testId}>
      {children}
    </h3>
  );
}

export function* Text({ children }: PropsWithChildren) {
  return <p className="dos-text">{children}</p>;
}

export function* Small({ children }: PropsWithChildren) {
  return <small className="dos-small">{children}</small>;
}

export interface LinkProps extends PropsWithChildren {
  href: string;
  /** Darker link colour, for use on the gray panel rather than the blue screen. */
  onPanel?: boolean;
  "aria-label"?: string;
}

export function* Link({ href, onPanel, children, ...rest }: LinkProps) {
  return (
    <a
      className={onPanel ? "dos-link dos-link--panel" : "dos-link"}
      href={href}
      aria-label={rest["aria-label"]}
    >
      {children}
    </a>
  );
}

export function* Rule() {
  return <hr className="dos-rule" />;
}

export function* Code({ children }: PropsWithChildren) {
  return <code className="dos-code">{children}</code>;
}

export function* Kbd({ children }: PropsWithChildren) {
  return <kbd className="dos-kbd">{children}</kbd>;
}

export function* Quote({ children }: PropsWithChildren) {
  return <blockquote className="dos-quote">{children}</blockquote>;
}

export function* BulletList({ children }: PropsWithChildren) {
  return <ul className="dos-bullets">{children}</ul>;
}

export function* BulletItem({ children }: PropsWithChildren) {
  return <li className="dos-bullets__item">{children}</li>;
}

export function* Tag({ children }: PropsWithChildren) {
  return <span className="dos-tag">{children}</span>;
}

export interface RowProps extends PropsWithChildren {
  /** Tighter gap, for pills and badges rather than buttons. */
  tight?: boolean;
}

export function* Row({ tight, children }: RowProps) {
  return <div className={tight ? "dos-row dos-row--tight" : "dos-row"}>{children}</div>;
}

/**
 * Visually hidden text that screen readers still announce. Use it to spell out
 * something the design conveys with position or colour alone.
 */
export function* ScreenReaderOnly({ children }: { children: Children }) {
  return <span className="dos-sr-only">{children}</span>;
}
