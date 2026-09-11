/**
 * Tabs — a group that owns the selection, a strip that presents it, and the
 * panels it switches between.
 *
 *   <TabGroup defaultValue="details" label="Record">
 *     <TabList>
 *       <Tab value="details">Details</Tab>
 *     </TabList>
 *     <TabPanel value="details">…</TabPanel>
 *   </TabGroup>
 *
 * The split matters twice over: a `role="tablist"` may only contain tabs, so
 * the panels cannot live in the strip; and the panels still need the selected
 * value, so both have to sit inside one provider.
 *
 * Selection is uncontrolled by default; pass `value` and `onChange` to drive
 * it from outside. Arrow keys move between tabs and select as they go, which
 * is what a reader expects when the panels are cheap to render.
 */
import type { ComponentProps, PropsWithChildren } from "yract";
import { useContext, useId, useState } from "yract";
import { TabsContext } from "./contexts";
import { useRoving } from "./roving";

export interface TabGroupProps extends PropsWithChildren {
  /** Value of the tab selected on first render. */
  defaultValue: string;
  /** Names the tablist. Required — a bare tablist tells a screen reader nothing. */
  label: string;
  /** Controlled selection. Pair with `onValueChange`. */
  value?: string;
  onValueChange?: (value: string) => void;
}

export function* TabGroup({ defaultValue, label, value, onValueChange, children }: TabGroupProps) {
  const baseId = yield* useId();
  const [internal, setInternal] = yield* useState(defaultValue);

  const selected = value ?? internal;

  function select(next: string): void {
    if (value === undefined) void setInternal(next);
    onValueChange?.(next);
  }

  return <TabsContext value={{ selected, select, baseId, label }}>{children}</TabsContext>;
}

/** The strip itself. Holds only `Tab` children, as the role requires. */
export function* TabList({ children, ...rest }: ComponentProps<"div">) {
  const { label } = yield* useContext(TabsContext);
  const { containerRef, onKeydown } = yield* useRoving<HTMLDivElement>("horizontal");

  return (
    <div
      {...rest}
      className="dos-tabs"
      role="tablist"
      aria-label={label}
      ref={containerRef}
      onKeydown={onKeydown}
    >
      {children}
    </div>
  );
}

export interface TabProps extends ComponentProps<"button"> {
  /** Identifies the tab and links it to the panel with the same value. */
  value: string;
}

export function* Tab({ value, children, ...rest }: TabProps) {
  const { selected, select, baseId } = yield* useContext(TabsContext);
  const isSelected = selected === value;

  return (
    <button
      {...rest}
      className="dos-tab"
      type="button"
      role="tab"
      data-dos-item=""
      id={`${baseId}tab-${value}`}
      aria-controls={`${baseId}panel-${value}`}
      aria-selected={isSelected}
      tabIndex={isSelected ? 0 : -1}
      onClick={() => select(value)}
    >
      {children}
    </button>
  );
}

/**
 * Panel for the tab with the matching value. Focusable, so a keyboard user
 * lands on the content after tabbing off the strip.
 *
 * Unselected panels return `null`, which leaves the
 * unselected tabs' `aria-controls` pointing at ids that are not there. ARIA
 * ignores an IDREF that does not resolve, so this costs nothing — and keeping
 * three hidden panels mounted to avoid it would cost more.
 */
export function* TabPanel({ value, children, ...rest }: ComponentProps<"div"> & { value: string }) {
  const { selected, baseId } = yield* useContext(TabsContext);

  if (selected !== value) return null;
  return (
    <div
      {...rest}
      className="dos-tabpanel"
      role="tabpanel"
      id={`${baseId}panel-${value}`}
      aria-labelledby={`${baseId}tab-${value}`}
      tabIndex={0}
    >
      {children}
    </div>
  );
}
