/**
 * App – top-level component rendered into `#root`.
 *
 * Tab-based navigation between yract-beta example demos. Demos that depend on
 * not-yet-implemented hooks ($resolve, $render, $deferred, createPortal, deps,
 * $patch) are intentionally absent.
 */
import { createRoot, useContext, useEffect } from "yract-beta";
import { ContextDemo } from "./components/ContextDemo";
import { Counter } from "./components/Counter";
import { EffectDemo } from "./components/EffectDemo";
import { HooksShowcase } from "./components/HooksShowcase";
import { KeyShuffleDemo } from "./components/KeyShuffleDemo";
import { LazyContextDemo } from "./components/LazyContextDemo";
import { ShownDemo } from "./components/ShownDemo";
import { TodoList } from "./components/TodoList";
import { DeferredDemo } from "./components/DeferredDemo";
import { SlotsDemo } from "./components/SlotsDemo";
import { AwaitDemo } from "./components/AwaitDemo";
import { Link } from "./fake-router/Link";
import { tabPaths, tabs } from "./constants";
import { usePathname, useSearch } from "./hooks";
import { createRouter } from "./fake-router/createRouter";
import { parseSearch } from "./utils";
import { Search } from "./types";
import { createPersonRows } from "./global-state";
import { useNavigationStatus } from "./fake-router/hooks";
import { OutletContext } from "./fake-router/contexts";

function* App() {
  const { tab: activeTab = "counter" } = yield* useSearch();

  const pathname = yield* usePathname();
  const status = yield* useNavigationStatus();
  console.log("... STATUS", status);
  yield* useEffect(() => {
    console.log("---");
  }, [Math.random()]);
  const outlet = yield* useContext(OutletContext);
  console.log("outlet", outlet);

  return (
    <div style={{ maxWidth: "640px", margin: "0 auto", opacity: status !== "IDLE" ? 0.4 : 1 }}>
      <h1 data-testid="app-heading" style={{ marginBottom: "0.25rem" }}>
        yract-beta playground
      </h1>
      <p style={{ color: "#555", marginBottom: "1.25rem" }}>
        Generator-powered JSX components — no magic, just plain JavaScript.
      </p>

      {/* Tab bar — ids derived from data so $id() is not applicable here */}
      <nav
        data-testid="app-tablist"
        style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}
      >
        {tabs.map((tab) => (
          <Link
            key={tab.id}
            role="tab"
            data-testid={`tab-${tab.id}`}
            id={`tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            href={`/${tab.id}`}
            style={{
              padding: "0.4rem 0.9rem",
              borderRadius: "4px",
              border: "1px solid #ccc",
              background: activeTab === tab.id ? "#0070f3" : "#fff",
              color: activeTab === tab.id ? "#fff" : "#333",
              cursor: "pointer",
            }}
          >
            {tab.label}
          </Link>
        ))}
      </nav>

      {/* Active panel */}
      <div id="example-panel">{outlet}</div>
    </div>
  );
}

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Missing #root element");
const root = createRoot(rootEl);
const Router = createRouter<Search>(
  [
    {
      path: "/",
      component: App,
      children: [
        {
          index: true,
          component: Counter,
        },
        {
          path: tabPaths.COUNTER,
          component: Counter,
        },
        {
          path: tabPaths.AWAIT,
          component: AwaitDemo,
        },
        {
          path: tabPaths.CONTEXT,
          component: ContextDemo,
        },
        {
          path: tabPaths.DEFERRED,
          component: DeferredDemo,
        },
        {
          path: tabPaths.EFFECT,
          component: EffectDemo,
        },
        {
          path: tabPaths.HOOKS,
          component: HooksShowcase,
        },
        {
          path: tabPaths.SHOWN,
          component: ShownDemo,
        },
        {
          path: tabPaths.CONTEXT,
          component: ContextDemo,
        },
        {
          path: tabPaths.SLOTS,
          component: SlotsDemo,
        },
        {
          path: tabPaths.TODOS,
          component: TodoList,
        },
        {
          path: tabPaths.KEY_SHUFFLE,
          component: KeyShuffleDemo,
        },
        {
          path: tabPaths.LAZY_CTX,
          component: LazyContextDemo,
        },
      ],
      loaders: [
        {
          async load({ search }) {
            switch (search.tab) {
              case "deferred": {
                return Promise.all([
                  createPersonRows(40_000),
                  new Promise<void>((res) => setTimeout(res, 3000)),
                ]);
              }
            }
          },
        },
      ],
    },
  ],
  {
    parseSearch,
    onPreload: <h1>Loading</h1>,
  },
);
root.render(<Router />);
