import type { ComponentGenerator } from "yract-beta";
import type { BaseInstance } from "../instances/base-instance";
import type { InstanceDescriptor } from "./descriptors";
import { $$INSTANCE } from "./descriptors";

export function* $$instance(): ComponentGenerator<BaseInstance> {
  const instance = yield { type: $$INSTANCE } satisfies InstanceDescriptor;
  return instance as BaseInstance;
}
