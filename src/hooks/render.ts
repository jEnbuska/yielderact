import type { ComponentGenerator } from "yract";
import type { Child } from "../jsx";
import type { RenderDescriptor } from "./types";

import { $$RENDER } from "./constants";

export function* requireRender(child: Child): ComponentGenerator<never, RenderDescriptor> {
  yield { type: $$RENDER, child } satisfies RenderDescriptor;
  throw new Error("$$render hook was called by a non component function");
}
