import type { Child } from "../jsx";
import type { HaltDescriptor } from "./types";
import type { ComponentGenerator } from "yract-beta";
import { $$HALT } from "./constants";

export function* requireHalt(initialFallback?: Child): ComponentGenerator<never, HaltDescriptor> {
  yield { type: $$HALT, initialFallback } satisfies HaltDescriptor;
  throw new Error("$$halt hook was called by a non component function");
}
