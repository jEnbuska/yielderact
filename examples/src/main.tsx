/**
 * App – top-level component rendered into `#root`.
 *
 * Provides a simple tab-based navigation between the five example demos.
 */
import { createRoot, useState } from "yielderact";
import { AbortSignalEffectDemo } from "./components/AbortSignalEffectDemo";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { ContextDemo } from "./components/ContextDemo";
import { Counter } from "./components/Counter";
import { DataFetcher, ResolveRawDemo } from "./components/DataFetcher";
import { EffectDemo } from "./components/EffectDemo";
import { HooksShowcase } from "./components/HooksShowcase";
import { KeyShuffleDemo } from "./components/KeyShuffleDemo";
import { LazyContextDemo } from "./components/LazyContextDemo";
import { PortalDemo } from "./components/PortalDemo";
import { ShownDemo } from "./components/ShownDemo";
import { ThemeDemo } from "./components/ThemeDemo";
import { TodoList } from "./components/TodoList";
import { TransitionDemo } from "./components/TransitionDemo";

type Tab =
  | "counter"
  | "todos"
  | "theme"
  | "data"
  | "raw"
  | "hooks"
  | "shown"
  | "confirm"
  | "effect"
  | "transition"
  | "context"
  | "lazy-ctx"
  | "abort-signal"
  | "key-shuffle"
  | "portal";

const tabs: { id: Tab; label: string }[] = [
  { id: "counter", label: "Counter" },
  { id: "todos", label: "Todo List" },
  { id: "theme", label: "Context / Theme" },
  { id: "data", label: "Data Fetcher" },
  { id: "raw", label: "useResolveRaw" },
  { id: "hooks", label: "Hooks Showcase" },
  { id: "shown", label: "$shown prop" },
  { id: "confirm", label: "useRender" },
  { id: "effect", label: "useEffect" },
  { id: "transition", label: "UI Patch" },
  { id: "context", label: "Context Scoping" },
  { id: "lazy-ctx", label: "Lazy Context" },
  { id: "abort-signal", label: "AbortSignal Effect" },
  { id: "key-shuffle", label: "Key Shuffle" },
  { id: "portal", label: "createPortal" },
];

function* App() {
  const [activeTab, setActiveTab] = yield* useState<Tab>("counter");

  return (
    <div style={{ maxWidth: "640px", margin: "0 auto" }}>
      <h1 data-testid="app-heading" style={{ marginBottom: "0.25rem" }}>
        yielderact examples
      </h1>
      <p style={{ color: "#555", marginBottom: "1.25rem" }}>
        Generator-powered JSX components — no magic, just plain JavaScript.
      </p>

      {/* Tab bar — ids derived from data so useId() is not applicable here */}
      <nav
        data-testid="app-tablist"
        style={{ display: "flex", gap: "0.5rem", marginBottom: "1.5rem", flexWrap: "wrap" }}
      >
        {tabs.map((tab) => (
          <button
            $key={tab.id}
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
        <Counter $shown={activeTab === "counter"} />
        <TodoList $shown={activeTab === "todos"} />
        <ThemeDemo $shown={activeTab === "theme"} />
        <DataFetcher $shown={activeTab === "data"} />
        <ResolveRawDemo $shown={activeTab === "raw"} />
        <HooksShowcase $shown={activeTab === "hooks"} />
        <ShownDemo $shown={activeTab === "shown"} />
        <ConfirmDialog $shown={activeTab === "confirm"} />
        <EffectDemo $shown={activeTab === "effect"} />
        <TransitionDemo $shown={activeTab === "transition"} />
        <ContextDemo $shown={activeTab === "context"} />
        <LazyContextDemo $shown={activeTab === "lazy-ctx"} />
        <AbortSignalEffectDemo $shown={activeTab === "abort-signal"} />
        <KeyShuffleDemo $shown={activeTab === "key-shuffle"} />
        <PortalDemo $shown={activeTab === "portal"} />
      </div>
    </div>
  );
}

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Missing #root element");
const root = createRoot(rootEl);
root.render(<App />);
