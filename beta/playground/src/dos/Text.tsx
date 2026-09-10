/**
 * Type primitives — headings, body copy, inline marks.
 *
 * `Heading` takes a `level`, which sets both the tag and the style, so the
 * document outline and the visual hierarchy cannot drift apart. Use `onScreen`
 * where the text sits on the blue ground rather than on a gray panel.
 *
 * Props extend the element each component returns; `...rest` is spread first so
 * the kit's own className always wins.
 */
import type { Children, ComponentProps } from "yract-beta";

export interface HeadingProps extends ComponentProps<"h1"> {
  level: 1 | 2 | 3;
  /** Lightens the text for the blue screen background. */
  onScreen?: boolean;
}

export function* Heading({ level, onScreen, children, ...rest }: HeadingProps) {
  const className = `dos-h${level}${onScreen ? ` dos-h${level}--screen` : ""}`;
  if (level === 1) {
    return (
      <h1 {...rest} className={className}>
        {children}
      </h1>
    );
  }
  if (level === 2) {
    return (
      <h2 {...rest} className={className}>
        {children}
      </h2>
    );
  }
  return (
    <h3 {...rest} className={className}>
      {children}
    </h3>
  );
}

export function* Text({ children, ...rest }: ComponentProps<"p">) {
  return (
    <p {...rest} className="dos-text">
      {children}
    </p>
  );
}

export function* Small({ children, ...rest }: ComponentProps<"small">) {
  return (
    <small {...rest} className="dos-small">
      {children}
    </small>
  );
}

export interface LinkProps extends ComponentProps<"a"> {
  href: string;
  /** Darker link colour, for use on the gray panel rather than the blue screen. */
  onPanel?: boolean;
}

export function* Link({ onPanel, children, ...rest }: LinkProps) {
  return (
    <a {...rest} className={onPanel ? "dos-link dos-link--panel" : "dos-link"}>
      {children}
    </a>
  );
}

export function* Rule(props: ComponentProps<"hr">) {
  return <hr {...props} className="dos-rule" />;
}

export function* Code({ children, ...rest }: ComponentProps<"code">) {
  return (
    <code {...rest} className="dos-code">
      {children}
    </code>
  );
}

export function* Kbd({ children, ...rest }: ComponentProps<"kbd">) {
  return (
    <kbd {...rest} className="dos-kbd">
      {children}
    </kbd>
  );
}

export function* Quote({ children, ...rest }: ComponentProps<"blockquote">) {
  return (
    <blockquote {...rest} className="dos-quote">
      {children}
    </blockquote>
  );
}

export function* BulletList({ children, ...rest }: ComponentProps<"ul">) {
  return (
    <ul {...rest} className="dos-bullets">
      {children}
    </ul>
  );
}

export function* BulletItem({ children, ...rest }: ComponentProps<"li">) {
  return (
    <li {...rest} className="dos-bullets__item">
      {children}
    </li>
  );
}

export function* Tag({ children, ...rest }: ComponentProps<"span">) {
  return (
    <span {...rest} className="dos-tag">
      {children}
    </span>
  );
}

export interface RowProps extends ComponentProps<"div"> {
  /** Tighter gap, for pills and badges rather than buttons. */
  tight?: boolean;
}

export function* Row({ tight, children, ...rest }: RowProps) {
  return (
    <div {...rest} className={tight ? "dos-row dos-row--tight" : "dos-row"}>
      {children}
    </div>
  );
}

/**
 * Visually hidden text that screen readers still announce. Use it to spell out
 * something the design conveys with position or colour alone.
 */
export function* ScreenReaderOnly({
  children,
  ...rest
}: ComponentProps<"span"> & { children: Children }) {
  return (
    <span {...rest} className="dos-sr-only">
      {children}
    </span>
  );
}
