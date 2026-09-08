/**
 * Roving-tabindex keyboard navigation for composite widgets.
 *
 * A tablist, toolbar or listbox is a single tab stop; arrow keys move within
 * it. Since the items are arbitrary children, the container finds them in the
 * DOM by `[data-dos-item]` rather than through a registry — that keeps the
 * components composable, with no index props to thread through.
 */
import { useEffect, useRef, type RefObject } from "yract-beta";
import type { ComponentGenerator } from "yract-beta";
import type { SEvent } from "yract-beta";

export type RovingOrientation = "horizontal" | "vertical" | "both";

export interface Roving<T extends HTMLElement> {
  containerRef: RefObject<T | undefined>;
  onKeydown: (event: SEvent<"keydown">) => void;
}

function items(container: HTMLElement | undefined): HTMLElement[] {
  if (!container) return [];
  return Array.from(container.querySelectorAll<HTMLElement>("[data-dos-item]"));
}

function nextIndex(key: string, index: number, length: number): number {
  if (key === "Home") return 0;
  if (key === "End") return length - 1;
  if (key === "ArrowRight" || key === "ArrowDown") return (index + 1) % length;
  return (index - 1 + length) % length;
}

function handles(key: string, orientation: RovingOrientation): boolean {
  if (key === "Home" || key === "End") return true;
  const horizontal = key === "ArrowRight" || key === "ArrowLeft";
  const vertical = key === "ArrowDown" || key === "ArrowUp";
  if (orientation === "horizontal") return horizontal;
  if (orientation === "vertical") return vertical;
  return horizontal || vertical;
}

/**
 * Wire arrow-key movement into a composite widget.
 *
 * `manageTabIndex` is for groups with no selected item (a toolbar): the first
 * item becomes the tab stop and focus moves it along. Groups that already have
 * a selected item (tabs, listbox) derive `tabIndex` from that instead, so they
 * pass `false` and stay declarative.
 */
export function* useRoving<T extends HTMLElement>(
  orientation: RovingOrientation = "both",
  manageTabIndex = false,
): ComponentGenerator<Roving<T>> {
  const containerRef = yield* useRef<T | undefined>(undefined);

  yield* useEffect(() => {
    if (!manageTabIndex) return;
    items(containerRef.current).forEach((item, index) => {
      item.tabIndex = index === 0 ? 0 : -1;
    });
  });

  function onKeydown(event: SEvent<"keydown">): void {
    const { key } = event.nativeEvent;
    if (!handles(key, orientation)) return;
    const all = items(containerRef.current);
    const index = all.indexOf(document.activeElement as HTMLElement);
    if (index === -1 || all.length === 0) return;
    event.preventDefault();
    const target = all[nextIndex(key, index, all.length)];
    if (!target) return;
    if (manageTabIndex) {
      all.forEach((item) => {
        item.tabIndex = item === target ? 0 : -1;
      });
    }
    target.focus();
  }

  return { containerRef, onKeydown };
}
