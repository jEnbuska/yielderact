import { commitUIPatch, startUIPatch, useState } from "yielderact";
import { VisibilityTarget } from "./VisibilityTarget";

export function* GlobalVisibilityDemo() {
  const [showDefault, setShowDefault] = yield* useState(true);
  const [showLive, setShowLive] = yield* useState(true);
  const [patchActive, setPatchActive] = yield* useState(false);

  const beginPatch = () => {
    setPatchActive(true);
    startUIPatch();
  };

  const commitPatch = () => {
    setPatchActive(false);
    commitUIPatch();
  };

  return (
    <div
      data-testid="global-visibility-demo"
      style={{ border: "1px solid #ddd", borderRadius: "6px", padding: "1rem" }}
    >
      <h4 style={{ marginTop: 0 }}>Global patch -- visibility</h4>
      <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
        <button
          data-testid="gv-start-patch"
          disabled={patchActive}
          onClick={beginPatch}
          style={{ padding: "0.3rem 0.6rem" }}
        >
          Start patch
        </button>
        <button
          data-testid="gv-commit-patch"
          disabled={!patchActive}
          onClick={commitPatch}
          style={{ padding: "0.3rem 0.6rem" }}
        >
          Commit patch
        </button>
        <button
          data-testid="gv-toggle-default"
          onClick={() => setShowDefault((v) => !v)}
          style={{ padding: "0.3rem 0.6rem" }}
        >
          Toggle default
        </button>
        <button
          data-testid="gv-toggle-live"
          onClick={() => setShowLive((v) => !v)}
          style={{ padding: "0.3rem 0.6rem" }}
        >
          Toggle live
        </button>
      </div>
      <div style={{ display: "flex", gap: "1rem", minHeight: "2rem", alignItems: "center" }}>
        <span>
          default: <VisibilityTarget $shown={showDefault} $patch="default" id="gv-target-default" />
        </span>
        <span>
          live: <VisibilityTarget $shown={showLive} $patch="live" id="gv-target-live" />
        </span>
      </div>
    </div>
  );
}
