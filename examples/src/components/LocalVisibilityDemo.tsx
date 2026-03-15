import { useRef, useState, useUIPatch } from "yielderact";
import { VisibilityTarget } from "./VisibilityTarget";

export function* LocalVisibilityDemo() {
  const startLocalPatch = yield* useUIPatch();
  const [showDefault, setShowDefault] = yield* useState(true);
  const [showLive, setShowLive] = yield* useState(true);
  // useRef persists the commit fn across rerenders without triggering a rerender
  // (avoids the component freezing its own "start patch" button update).
  const commitRef = yield* useRef<(() => void) | null>(null);

  const beginPatch = () => {
    if (commitRef.current) return; // already active
    commitRef.current = startLocalPatch();
  };

  const endPatch = () => {
    const commit = commitRef.current;
    commitRef.current = null;
    commit?.();
  };

  return (
    <div
      data-testid="local-visibility-demo"
      style={{ border: "1px solid #ddd", borderRadius: "6px", padding: "1rem" }}
    >
      <h4 style={{ marginTop: 0 }}>Local patch -- visibility</h4>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
        <button
          data-testid="lv-start-patch"
          onClick={beginPatch}
          style={{ padding: "0.3rem 0.6rem" }}
        >
          Start patch
        </button>
        <button
          data-testid="lv-commit-patch"
          onClick={endPatch}
          style={{ padding: "0.3rem 0.6rem" }}
        >
          Commit patch
        </button>
        <button
          data-testid="lv-toggle-default"
          onClick={() => setShowDefault((v) => !v)}
          style={{ padding: "0.3rem 0.6rem" }}
        >
          Toggle default
        </button>
        <button
          data-testid="lv-toggle-live"
          onClick={() => setShowLive((v) => !v)}
          style={{ padding: "0.3rem 0.6rem" }}
        >
          Toggle live
        </button>
      </div>
      <div style={{ display: "flex", gap: "1rem", minHeight: "2rem", alignItems: "center" }}>
        <span>
          default: <VisibilityTarget $shown={showDefault} $patch="default" id="lv-target-default" />
        </span>
        <span>
          live: <VisibilityTarget $shown={showLive} $patch="live" id="lv-target-live" />
        </span>
      </div>
    </div>
  );
}
