import type { UpdateResult } from "./types";
import { SlotKey, SlotPath } from "../slots/general";

export function updateResult(result: Exclude<UpdateResult, void>): UpdateResult {
  return result;
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
