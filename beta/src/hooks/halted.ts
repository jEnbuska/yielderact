import type { HaltedDescriptor } from "./types";
import type { RefObject } from "./ref";
import type { ComponentGenerator } from "../general-types";
import { $$HALTED } from "./constants";

export function* $halted(): ComponentGenerator<RefObject<boolean>, HaltedDescriptor> {
  return (yield { type: $$HALTED }) as RefObject<boolean>;
}
