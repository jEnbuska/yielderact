import { useContext, useRef } from "yract";
import { AppCtx } from "../contexts";
import { RenderBadge } from "./RenderBadge";

export function* SelectorConsumer() {
  const renderCount = yield* useRef(0);
  renderCount.current++;

  const ctx = yield* useContext(AppCtx, (c) => [c.user.name]);

  return (
    <div
      data-testid="lazy-ctx-selector"
      style={{ padding: "0.5rem", background: "#f0f7ff", borderRadius: "4px" }}
    >
      <strong>
        Overload 2 -- selector (tracks user.name)
        <RenderBadge count={renderCount.current} />
      </strong>
      <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem" }}>
        name: <code data-testid="lazy-ctx-selector-name">{ctx.user.name}</code>
        {"  "}count: <code data-testid="lazy-ctx-selector-count-val">{ctx.count}</code>
      </p>
      <p style={{ margin: "0.25rem 0 0", fontSize: "0.75rem", color: "#666" }}>
        Render count: <span data-testid="lazy-ctx-selector-renders">{renderCount.current}</span>
      </p>
    </div>
  );
}
