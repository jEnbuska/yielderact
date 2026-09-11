/**
 * App — the playground shell, built from the DOS kit.
 *
 * Every demo is mounted at once, stacked down the page. The sidebar is an
 * in-page table of contents: each link jumps to its section rather than
 * swapping the content, so there is no router and no route state.
 */
import { Screen, Shell, ShellMain, Sidebar } from "./dos";
import "./dos/styles.css";
import { AwaitDemo } from "./sections/await";
import { ContextDemo } from "./sections/context";
import { Counter } from "./sections/counter";
import { DeferredDemo } from "./sections/deferred";
import { DosDemo } from "./sections/dos";
import { EffectDemo } from "./sections/effect";
import { HooksShowcase } from "./sections/hooks";
import { KeyShuffleDemo } from "./sections/key-shuffle";
import { LazyContextDemo } from "./sections/lazy-ctx";
import { TodoList } from "./sections/todos";
import { SideBarHashLink } from "./components/SideBarHashLink";

const demos = [
  { id: "counter", label: "Counter", Demo: Counter },
  { id: "todos", label: "Todo List", Demo: TodoList },
  { id: "hooks", label: "Hooks Showcase", Demo: HooksShowcase },
  { id: "effect", label: "useEffect", Demo: EffectDemo },
  { id: "context", label: "Context Scoping", Demo: ContextDemo },
  { id: "lazy-ctx", label: "Lazy Context", Demo: LazyContextDemo },
  { id: "key-shuffle", label: "Key Shuffle", Demo: KeyShuffleDemo },
  { id: "deferred", label: "Defer Table", Demo: DeferredDemo },
  { id: "await", label: "Await", Demo: AwaitDemo },
  { id: "dos", label: "DOS Kit", Demo: DosDemo },
] as const;

export function* App() {
  return (
    <Screen skipLabel={"Skip to main"}>
      <Shell>
        <Sidebar label="Demos" data-testid="app-tablist">
          {demos.map(({ id, label }) => (
            <SideBarHashLink key={id} targetId={id}>
              {label}
            </SideBarHashLink>
          ))}
        </Sidebar>
        <ShellMain>
          {demos.map(({ id, Demo }) => (
            <section key={`${id}`} id={id} className="dos-demo" aria-label={id}>
              <Demo />
              <button onClick={() => window.location.reload()}>Refresh</button>
            </section>
          ))}
        </ShellMain>
      </Shell>
    </Screen>
  );
}
