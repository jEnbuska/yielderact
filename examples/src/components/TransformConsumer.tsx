import { useContext, useRef } from "yielderact";
import { AppCtx } from "./LazyContextDemo.shared";
import { RenderBadge } from "./RenderBadge";

export function* TransformConsumer() {
  const renderCount = yield* useRef(0);
  renderCount.current++;

  const upperName = yield* useContext(
    AppCtx,
    (c) => [c.user.name] as [string],
    (name) => name.toUpperCase(),
  );

  return (
    <div
      data-testid="lazy-ctx-transform"
      style={{ padding: "0.5rem", background: "#f0fff4", borderRadius: "4px" }}
    >
      <strong>
        Overload 3 -- selector + transform (tracks user.name, returns uppercased)
        <RenderBadge count={renderCount.current} />
      </strong>
      <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem" }}>
        UPPER_NAME: <code data-testid="lazy-ctx-transform-value">{upperName}</code>
      </p>
      <p style={{ margin: "0.25rem 0 0", fontSize: "0.75rem", color: "#666" }}>
        Render count: <span data-testid="lazy-ctx-transform-renders">{renderCount.current}</span>
      </p>
    </div>
  );
}
