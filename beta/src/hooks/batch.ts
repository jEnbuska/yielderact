import type { BatchHookState } from "../render/types";
import { $$BATCH } from "./descriptors";
import type { ComponentGenerator } from "./types";

export function* $$batch(): ComponentGenerator<BatchHookState["value"]> {
  const value = yield { type: $$BATCH };
  return value as BatchHookState["value"];
}
