/**
 * Loaders — one for each thing you might know about the wait.
 *
 * `Progress` when you know the total, `LoaderTrain` when you do not,
 * `Spinner` for a short pause, `Cursor` for a prompt still waiting on input.
 */
import { useContext } from "yract-beta";
import type { Children, PropsWithChildren } from "yract-beta";
import { FieldContext } from "./contexts";

export interface ProgressProps {
  value: number;
  max?: number;
}

/** Determinate bar. Label it with a `FieldLabel` inside a `Field`. */
export function* Progress({ value, max = 100 }: ProgressProps) {
  const { controlId, descriptionId } = yield* useContext(FieldContext);
  return (
    <progress
      className="dos-progress"
      id={controlId}
      value={value}
      max={max}
      aria-describedby={descriptionId}
    />
  );
}

export interface LoaderTrainProps {
  /** What is being waited on. Announced in place of a percentage. */
  label: string;
  describedBy?: string;
}

/**
 * Indeterminate bar. A progressbar with no value is announced as such, which
 * is the honest thing to say when no total is known.
 */
export function* LoaderTrain({ label, describedBy }: LoaderTrainProps) {
  return (
    <div
      className="dos-loader-train"
      role="progressbar"
      aria-label={label}
      aria-describedby={describedBy}
    />
  );
}

/**
 * The four-character spinner. The glyph is decorative; the surrounding text is
 * what gets announced, so wrap it in a live region with `Status`.
 */
export function* Spinner() {
  return <span className="dos-spinner" aria-hidden="true" />;
}

/** Blinking block, for a prompt awaiting input. Decorative. */
export function* Cursor() {
  return <span className="dos-cursor" aria-hidden="true" />;
}

/** Polite live region — announces its content when it changes. */
export function* Status({ children }: PropsWithChildren) {
  return (
    <p className="dos-text" role="status">
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
export function* Badge({ tone = "neutral", children }: PropsWithChildren & { tone?: BadgeTone }) {
  return <span className={badgeClass[tone]}>{children}</span>;
}

export interface AlertProps {
  children: Children;
  /**
   * `alert` interrupts the screen reader, so keep it for something that just
   * went wrong. Anything standing on the page at load should stay `status`.
   */
  urgent?: boolean;
}

export function* Alert({ children, urgent }: AlertProps) {
  return (
    <div className="dos-alert" role={urgent ? "alert" : "status"}>
      {children}
    </div>
  );
}
