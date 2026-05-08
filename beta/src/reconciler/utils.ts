import type { RefResult, UpdateResult } from "./types";
import type { SlotKey, SlotPath } from "../slots/general";
import type { VNodeProps } from "yract-beta";
import type { RefLike } from "../render/element-props";
import { assertIsRefLike } from "../render/element-props";
import type { SlotElement } from "../render/elements/namespaces";

export function updateResult(result: Exclude<UpdateResult, void>): UpdateResult {
  return result;
}

export function isRefProps<T extends VNodeProps>(props: T): props is T & { ref: RefLike } {
  if ("ref" in props) {
    const ref = props["ref"];
    assertIsRefLike(ref);
    return true;
  }
  return false;
}

export function registerRef(element: SlotElement, ref: RefLike): RefResult {
  return {
    type: "REF",
    ref,
    element,
  };
}

/**
 * Build a unique slot path string from a parent path and a child key.
 * Positional indices (number) are prefixed with `#`.
 * User-provided string keys are length-prefixed with `$` to avoid
 * collisions with indices and to handle arbitrary string content safely.
 */
export function createSlotPath(parentPath: SlotPath, key: SlotKey): SlotPath {
  if (typeof key === "number") return `${parentPath}#${key}`;
  return `${parentPath}$${key.length}:${key}`;
}
export const emptyProps: VNodeProps = {};
