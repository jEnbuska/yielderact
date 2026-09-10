/**
 * Screen — the kit root.
 *
 * Every other component reads its palette and font from the `.dos` custom
 * properties declared here, so a DOS interface must live inside one of these.
 * `Stage` is a patch of bare screen for chrome that sits outside a window.
 *
 * Props extend the element each component returns, so anything the DOM accepts
 * passes straight through. `...rest` is spread first, so the props the kit owns
 * (className, role, aria-*) always win over a caller trying to override them.
 */
import { createContext, useId, useRef } from "yract-beta";
import type { ComponentProps } from "yract-beta";

export interface ScreenProps extends ComponentProps<"div"> {
  skipLabel?: string;
}

export const ScreenContext = createContext({ mainId: "" });

export function* Screen({ skipLabel = "Skip to content", children, ...rest }: ScreenProps) {
  const mainId = yield* useId();
  const ref = yield* useRef({ mainId });
  return (
    <div {...rest} className="dos">
      {!!skipLabel && (
        <a className="dos-skip" href={`#${mainId}`}>
          {skipLabel}
        </a>
      )}
      <ScreenContext value={ref.current}>{children}</ScreenContext>
    </div>
  );
}

export interface StageProps extends ComponentProps<"div"> {
  /** Drop the padding, for chrome that should meet the stage edges. */
  flush?: boolean;
}

export function* Stage({ flush, children, ...rest }: StageProps) {
  return (
    <div {...rest} className={flush ? "dos-stage dos-stage--flush" : "dos-stage"}>
      {children}
    </div>
  );
}

export interface ScrollProps extends ComponentProps<"div"> {
  label: string;
}

/** Horizontal scroll container. Focusable, so a keyboard can scroll it too. */
export function* Scroll({ label, children, ...rest }: ScrollProps) {
  return (
    <div {...rest} className="dos-scroll" role="region" aria-label={label} tabIndex={0}>
      {children}
    </div>
  );
}
