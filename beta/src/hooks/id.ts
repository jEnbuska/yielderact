import type { IdHookState } from "../render/types";
import { type IdDescriptor } from "./types";

import type { ComponentGenerator } from "../general-types";
import { $ID } from "./constants";

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
