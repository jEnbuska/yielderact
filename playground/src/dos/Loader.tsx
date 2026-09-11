/**
 * Loaders — one for each thing you might know about the wait.
 *
 * `Progress` when you know the total, `LoaderTrain` when you do not,
 * `Spinner` for a short pause, `Cursor` for a prompt still waiting on input.
 */
import { useContext } from "yract";
import type { Children, ComponentProps } from "yract";
import { FieldContext } from "./contexts";

export interface ProgressProps extends ComponentProps<"progress"> {
  value: number;
  max?: number;
}

/** Determinate bar. Label it with a `FieldLabel` inside a `Field`. */
export function* Progress({ value, max = 100, ...rest }: ProgressProps) {
  const { controlId, descriptionId } = yield* useContext(FieldContext);
  return (
    <progress
      aria-describedby={descriptionId}
      {...rest}
      className="dos-progress"
      id={controlId}
      value={value}
      max={max}
    />
  );
}

export interface LoaderTrainProps extends ComponentProps<"div"> {
  /** What is being waited on. Announced in place of a percentage. */
  label: string;
}

/**
 * Indeterminate bar. A progressbar with no value is announced as such, which
 * is the honest thing to say when no total is known.
 */
export function* LoaderTrain({ label, ...rest }: LoaderTrainProps) {
  return <div {...rest} className="dos-loader-train" role="progressbar" aria-label={label} />;
}

/**
 * The four-character spinner. The glyph is decorative; the surrounding text is
 * what gets announced, so wrap it in a live region with `Status`.
 */
export function* Spinner(props: ComponentProps<"span">) {
  return <span {...props} className="dos-spinner" aria-hidden="true" />;
}

/** Blinking block, for a prompt awaiting input. Decorative. */
export function* Cursor(props: ComponentProps<"span">) {
  return <span {...props} className="dos-cursor" aria-hidden="true" />;
}

/** Polite live region — announces its content when it changes. */
export function* Status({ children, ...rest }: ComponentProps<"p">) {
  return (
    <p {...rest} className="dos-text" role="status">
      {children}
    </p>
  );
}

export type BadgeTone = "neutral" | "info" | "ok" | "warn" | "error";

const badgeClass: Record<BadgeTone, string> = {
  neutral: "dos-badge",
  info: "dos-badge dos-badge--info",
  ok: "dos-badge dos-badge--ok",
  warn: "dos-badge dos-badge--warn",
  error: "dos-badge dos-badge--error",
};

/** State pill. The tone is a duplicate of the text, never a substitute for it. */
export interface BadgeProps extends ComponentProps<"span"> {
  tone?: BadgeTone;
}

export function* Badge({ tone = "neutral", children, ...rest }: BadgeProps) {
  return (
    <span {...rest} className={badgeClass[tone]}>
      {children}
    </span>
  );
}

export interface AlertProps extends ComponentProps<"div"> {
  children: Children;
  /**
   * `alert` interrupts the screen reader, so keep it for something that just
   * went wrong. Anything standing on the page at load should stay `status`.
   */
  urgent?: boolean;
}

export function* Alert({ children, urgent, ...rest }: AlertProps) {
  return (
    <div {...rest} className="dos-alert" role={urgent ? "alert" : "status"}>
      {children}
    </div>
  );
}
