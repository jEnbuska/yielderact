import type { IdHookState } from "../render/types";
import { $ID, type IdDescriptor } from "./descriptors";

import type { ComponentGenerator } from "../general-types";

let idCounter = 0;

function nextId(): string {
  return `:r${idCounter++}:`;
}

/**
 * Stable unique ID hook. Returns a string ID that is stable across re-renders.
 */
export function* $id(): ComponentGenerator<string> {
  const desc: IdDescriptor = { type: $ID };
  const id = yield desc;
  return id as string;
}

/** @internal */
export function processId(prev?: IdHookState): IdHookState {
  if (prev !== undefined) return prev;
  return { type: $ID, id: nextId() };
}
