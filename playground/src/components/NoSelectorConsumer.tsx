import { useContext, useRef } from "yract";
import { AppCtx } from "../contexts";
import { RenderBadge } from "./RenderBadge";

export function* NoSelectorConsumer() {
  const renderCount = yield* useRef(0);
  renderCount.current++;

  const ctx = yield* useContext(AppCtx);

  return (
    <div
      data-testid="lazy-ctx-no-selector"
      style={{ padding: "0.5rem", background: "#f9f9f9", borderRadius: "4px" }}
    >
      <strong>
        Overload 1 -- no selector
        <RenderBadge count={renderCount.current} />
      </strong>
      <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem" }}>
        name: <code data-testid="lazy-ctx-no-selector-name">{ctx.user.name}</code>
        {"  "}count: <code data-testid="lazy-ctx-no-selector-count-val">{ctx.count}</code>
      </p>
      <p style={{ margin: "0.25rem 0 0", fontSize: "0.75rem", color: "#666" }}>
        Render count: <span data-testid="lazy-ctx-no-selector-renders">{renderCount.current}</span>
      </p>
    </div>
  );
}
