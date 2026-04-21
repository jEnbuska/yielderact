/**
 * App – top-level component rendered into `#root`.
 *
 * Tab-based navigation between yract-beta example demos. Demos that depend on
 * not-yet-implemented hooks ($resolve, $render, $deferred, createPortal, deps,
 * $patch) are intentionally absent.
 */
import { $effect, $state, createRoot } from "yract-beta";
import { AbortSignalEffectDemo } from "./components/AbortSignalEffectDemo";
import { ContextDemo } from "./components/ContextDemo";
import { Counter } from "./components/Counter";
import { EffectDemo } from "./components/EffectDemo";
import { HooksShowcase } from "./components/HooksShowcase";
import { KeyShuffleDemo } from "./components/KeyShuffleDemo";
import { LazyContextDemo } from "./components/LazyContextDemo";
import { ShownDemo } from "./components/ShownDemo";
import { ThemeDemo } from "./components/ThemeDemo";
import { TodoList } from "./components/TodoList";
import { DeferredDemo } from "./components/DeferredDemo";

type Tab =
  | "counter"
  | "todos"
  | "theme"
  | "hooks"
  | "shown"
  | "effect"
  | "context"
  | "lazy-ctx"
  | "abort-signal"
  | "key-shuffle"
  | "deferred";

const tabs: { id: Tab; label: string }[] = [
  { id: "counter", label: "Counter" },
  { id: "todos", label: "Todo List" },
  { id: "theme", label: "Context / Theme" },
  { id: "hooks", label: "Hooks Showcase" },
  { id: "shown", label: "shown prop" },
  { id: "effect", label: "$effect" },
  { id: "context", label: "Context Scoping" },
  { id: "lazy-ctx", label: "Lazy Context" },
  { id: "abort-signal", label: "AbortSignal Effect" },
  { id: "key-shuffle", label: "Key Shuffle" },
  { id: "deferred", label: "Deferred Table" },
];

function getInitialTab(): Tab {
  const tab = localStorage.getItem("tab");
  const tabIds = tabs.map((tab) => tab.id);
  if (tabIds.includes(tab as Tab)) {
    return tab as Tab;
  }
  return "counter";
}
function* App() {
  const [activeTab, setActiveTab] = yield* $state<Tab>(getInitialTab);
  yield* $effect(() => {
    localStorage.setItem("tab", activeTab);
  }, [activeTab]);

  return (
    <div style={{ maxWidth: "640px", margin: "0 auto" }}>
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
          <button
            key={tab.id}
            role="tab"
            data-testid={`tab-${tab.id}`}
            id={`tab-${tab.id}`}
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
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
          </button>
        ))}
      </nav>

      {/* Active panel */}
      <div id="example-panel">
        <Counter shown={activeTab === "counter"} />
        <TodoList shown={activeTab === "todos"} />
        <ThemeDemo shown={activeTab === "theme"} />
        <HooksShowcase shown={activeTab === "hooks"} />
        <ShownDemo shown={activeTab === "shown"} />
        <EffectDemo shown={activeTab === "effect"} />
        <ContextDemo shown={activeTab === "context"} />
        <LazyContextDemo shown={activeTab === "lazy-ctx"} />
        <AbortSignalEffectDemo shown={activeTab === "abort-signal"} />
        <KeyShuffleDemo shown={activeTab === "key-shuffle"} />
        <DeferredDemo shown={activeTab === "deferred"} />
      </div>
    </div>
  );
}

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Missing #root element");
const root = createRoot(rootEl);
root.render(<App />);
