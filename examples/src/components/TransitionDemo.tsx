import { $effect, $ref, $state, $uiPatch, commitUIPatch, startUIPatch } from "yielderact";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function* Navigation({
  page,
  isPending,
  navigate,
  scope,
}: {
  page: Page;
  isPending: boolean;
  navigate: (page: Page) => void;
  scope: string;
}) {
  return (
    <nav
      data-testid={`${scope}-nav`}
      style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}
    >
      {(["home", "about", "contact"] as Page[]).map((p) => (
        <button
          $key={p}
          data-testid={`${scope}-nav-${p}`}
          onClick={() => navigate(p)}
          disabled={isPending}
          style={{
            padding: "0.3rem 0.7rem",
            background: page === p ? "#0070f3" : "#fff",
            color: page === p ? "#fff" : "#333",
            border: "1px solid #ccc",
            borderRadius: "4px",
            cursor: isPending ? "wait" : "pointer",
          }}
        >
          {isPending && page !== p ? "…" : p}
        </button>
      ))}
    </nav>
  );
}

// ---------------------------------------------------------------------------
// Live clock (always updates, even during a patch)
// ---------------------------------------------------------------------------

function* LiveClock({ tick }: { tick: number }) {
  return <b data-testid="clock-time">{new Date(tick).toLocaleTimeString("en-US")}</b>;
}

// ---------------------------------------------------------------------------
// Page components
// ---------------------------------------------------------------------------

function* HomePage() {
  return (
    <div data-testid="page-home">
      <h3>🏠 Home</h3>
      <p>...</p>
    </div>
  );
}

function* AboutPage() {
  return (
    <div data-testid="page-about">
      <h3>ℹ️ About</h3>
      <p>...</p>
    </div>
  );
}

function* ContactPage() {
  return (
    <div data-testid="page-contact">
      <h3>📬 Contact</h3>
      <p>...</p>
    </div>
  );
}

function* Clocks() {
  const [tick, setTick] = yield* $state(Date.now());
  yield* $effect(() => {
    const interval = setInterval(() => {
      setTick(() => Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);
  const seconds = new Date().getSeconds();
  return (
    <div className={"grid gap-4 grid-cols-3"}>
      <div style={{ marginBottom: "0.75rem" }} $patch="default" data-testid="clock-default">
        Clock (<code>$patch="default"</code>): <LiveClock tick={tick} />
      </div>
      <div style={{ marginBottom: "0.75rem" }} $patch="live" data-testid="clock-live">
        Clock (<code>$patch="live"</code>, always live): <LiveClock tick={tick} />
      </div>
      <div
        style={{ marginBottom: "0.75rem" }}
        $patch={seconds % 3 === 0 ? "live" : "default"}
        data-testid="clock-alternating"
      >
        Clock (<code>$patch={`{seconds % 3 === 0 ? 'live' : 'default'}`}'</code>:{" "}
        <LiveClock tick={tick} />
      </div>
    </div>
  );
}

type Page = "home" | "about" | "contact";

// ---------------------------------------------------------------------------
// Global patch demo
// ---------------------------------------------------------------------------

function* GlobalPatchDemo() {
  const [page, setPage] = yield* $state<Page>("home");
  const [isPending, setIsPending] = yield* $state(false);
  const [log, setLog] = yield* $state<string[]>([]);

  const navigate = async (next: Page) => {
    setIsPending(true);
    startUIPatch();
    try {
      setLog((prev) => [...prev, `[global] navigating to ${next}…`]);
      await sleep(5000);
      setPage(next);
      setLog((prev) => [...prev, `[global] arrived at ${next}`]);
    } finally {
      setIsPending(false);
      commitUIPatch();
    }
  };

  return (
    <div
      data-testid="global-patch-demo"
      style={{ border: "1px solid #ddd", borderRadius: "6px", padding: "1rem" }}
    >
      <h4 data-testid="global-patch-heading" style={{ marginTop: 0 }}>
        Global patch — entire tree frozen
      </h4>
      <p style={{ color: "#555", fontSize: "0.9rem" }}>
        During navigation the <strong>entire page area</strong> is frozen (including the clock
        below). State changes are computed but DOM stays unchanged until commit.
      </p>

      {/* Live clock is inside the global patch scope and will also freeze */}
      <Clocks />

      <Navigation page={page} isPending={isPending} navigate={navigate} scope="global" />

      <div
        style={{
          padding: "0.75rem",
          background: "#f5f5f5",
          borderRadius: "4px",
          minHeight: "80px",
        }}
      >
        <HomePage $shown={page === "home"} />
        <AboutPage $shown={page === "about"} />
        <ContactPage $shown={page === "contact"} />
      </div>

      <pre
        data-testid="global-patch-log"
        $shown={!!log.length}
        style={{
          marginTop: "0.75rem",
          fontSize: "0.78rem",
          background: "#1a1a1a",
          color: "#cfc",
          padding: "0.5rem",
          borderRadius: "4px",
          overflowX: "auto",
        }}
      >
        {log.join("\n")}
      </pre>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Local patch demo
// ---------------------------------------------------------------------------

function* LocalPatchDemo() {
  const startPatch = yield* $uiPatch();
  const [page, setPage] = yield* $state<Page>("home");
  const [isPending, setIsPending] = yield* $state(false);
  const [log, setLog] = yield* $state<string[]>([]);

  const navigate = async (next: Page) => {
    setIsPending(true);
    const commit = startPatch();
    try {
      setLog((prev) => [...prev, `[local] navigating to ${next}…`]);
      await sleep(5000);
      setPage(next);
      setLog((prev) => [...prev, `[local] arrived at ${next}`]);
    } finally {
      setIsPending(false);
      commit();
    }
  };

  return (
    <div
      data-testid="local-patch-demo"
      style={{ border: "1px solid #ddd", borderRadius: "6px", padding: "1rem" }}
    >
      <h4 data-testid="local-patch-heading" style={{ marginTop: 0 }}>
        Local patch — only this subtree frozen
      </h4>
      <p style={{ color: "#555", fontSize: "0.9rem" }}>
        During navigation only <strong>this component's subtree</strong> is frozen. The live clock
        marked <code>$patch="live"</code> continues to tick — click it while navigating.
      </p>

      <Navigation page={page} isPending={isPending} navigate={navigate} scope="local" />
      <Clocks />
      <div
        style={{
          padding: "0.75rem",
          background: "#f5f5f5",
          borderRadius: "4px",
          minHeight: "80px",
        }}
      >
        <HomePage $shown={page === "home"} />
        <AboutPage $shown={page === "about"} />
        <ContactPage $shown={page === "contact"} />
      </div>

      <pre
        data-testid="local-patch-log"
        $shown={!!log.length}
        style={{
          marginTop: "0.75rem",
          fontSize: "0.78rem",
          background: "#1a1a1a",
          color: "#cfc",
          padding: "0.5rem",
          borderRadius: "4px",
          overflowX: "auto",
        }}
      >
        {log.join("\n")}
      </pre>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Visibility patch demo — used by Playwright tests
// ---------------------------------------------------------------------------

function* VisibilityTarget({ id }: { id: string }) {
  return (
    <span data-testid={id} style={{ padding: "0.2rem 0.5rem", background: "#d4edda" }}>
      visible
    </span>
  );
}

function* GlobalVisibilityDemo() {
  const [showDefault, setShowDefault] = yield* $state(true);
  const [showLive, setShowLive] = yield* $state(true);
  const [patchActive, setPatchActive] = yield* $state(false);

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
      <h4 style={{ marginTop: 0 }}>Global patch — visibility</h4>
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

function* LocalVisibilityDemo() {
  const startLocalPatch = yield* $uiPatch();
  const [showDefault, setShowDefault] = yield* $state(true);
  const [showLive, setShowLive] = yield* $state(true);
  // $ref persists the commit fn across rerenders without triggering a rerender
  // (avoids the component freezing its own "start patch" button update).
  const commitRef = yield* $ref<(() => void) | null>(null);

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
      <h4 style={{ marginTop: 0 }}>Local patch — visibility</h4>
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

// ---------------------------------------------------------------------------
// Root demo component
// ---------------------------------------------------------------------------

export function* TransitionDemo() {
  return (
    <div>
      <h2>UI Patch</h2>
      <p>
        <strong>UI patches</strong> let you freeze DOM updates while async work runs, then apply all
        changes atomically. Components still execute and update their state — only the final DOM
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
