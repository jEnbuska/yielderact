import { GlobalPatchDemo } from "./GlobalPatchDemo";
import { GlobalVisibilityDemo } from "./GlobalVisibilityDemo";
import { LocalPatchDemo } from "./LocalPatchDemo";
import { LocalVisibilityDemo } from "./LocalVisibilityDemo";

export function* TransitionDemo() {
  return (
    <div>
      <h2>UI Patch</h2>
      <p>
        <strong>UI patches</strong> let you freeze DOM updates while async work runs, then apply all
        changes atomically. Components still execute and update their state -- only the final DOM
        write is deferred.
      </p>
      <p>
        Mark a subtree <code>$patch="live"</code> to let it update normally even during a patch.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
        <GlobalPatchDemo />
        <LocalPatchDemo />
        <GlobalVisibilityDemo />
        <LocalVisibilityDemo />
      </div>
    </div>
  );
}
