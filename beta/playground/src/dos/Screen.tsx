/**
 * Screen — the kit root.
 *
 * Every other component reads its palette and font from the `.dos` custom
 * properties declared here, so a DOS interface must live inside one of these.
 * `Stage` is a patch of bare screen for chrome that sits outside a window.
 */
import type { PropsWithChildren } from "yract-beta";

export interface ScreenProps extends PropsWithChildren {
  /** Skip-link target id, so keyboard users can jump past the chrome. */
  mainId?: string;
  skipLabel?: string;
}

export function* Screen({ mainId, skipLabel = "Skip to content", children }: ScreenProps) {
  return (
    <div className="dos">
      <a className="dos-skip" href={`#${mainId}`} shown={mainId !== undefined}>
        {skipLabel}
      </a>
      {children}
    </div>
  );
}

export interface StageProps extends PropsWithChildren {
  /** Drop the padding, for chrome that should meet the stage edges. */
  flush?: boolean;
}

export function* Stage({ flush, children }: StageProps) {
  return <div className={flush ? "dos-stage dos-stage--flush" : "dos-stage"}>{children}</div>;
}

/** Horizontal scroll container. Focusable, so a keyboard can scroll it too. */
export function* Scroll({ label, children }: PropsWithChildren & { label: string }) {
  return (
    <div className="dos-scroll" role="region" aria-label={label} tabIndex={0}>
      {children}
    </div>
  );
}
