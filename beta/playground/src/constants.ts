import type { Tab } from "./types";
import { Path } from "./fake-router/types";

type DashToUnderscore<T extends string> = T extends `${infer Head}-${infer Tail}`
  ? `${Head}_${DashToUnderscore<Tail>}`
  : T;

type TabKey<T extends string> = Uppercase<DashToUnderscore<T>>;
function toTabKey<T extends string>(tab: string): TabKey<T> {
  return tab.toUpperCase().replaceAll("-", "_") as TabKey<T>;
}

export const tabs = [
  { id: "counter", label: "Counter" },
  { id: "todos", label: "Todo List" },
  { id: "theme", label: "Context / Theme" },
  { id: "hooks", label: "Hooks Showcase" },
  { id: "effect", label: "$effect" },
  { id: "context", label: "Context Scoping" },
  { id: "lazy-ctx", label: "Lazy Context" },
  { id: "key-shuffle", label: "Key Shuffle" },
  { id: "deferred", label: "Defer Table" },
  { id: "slots", label: "Slots" },
  { id: "await", label: "Await" },
  { id: "dos", label: "DOS Kit" },
] as const;
export const tabPaths: Record<TabKey<Tab>, Path<Tab>> = Object.fromEntries(
  Object.values(tabs).map((tab) => [toTabKey(tab.id), `/${tab.id}`]),
) as Record<TabKey<Tab>, Path<Tab>>;
