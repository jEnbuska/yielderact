import type { ComponentGenerator } from "yract";
import { $$FORCE_UPDATE } from "./constants";

export function* requireForceUpdate(): ComponentGenerator<() => void> {
  const callback = yield { type: $$FORCE_UPDATE };
  return callback as () => void;
}
