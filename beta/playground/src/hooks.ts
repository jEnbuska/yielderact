import { useContext } from "yract-beta";
import { RouteContext } from "./fake-router/contexts";
import { Search } from "./types";
import { Path } from "./fake-router/types";
import { tabs } from "./constants";

export function* useSearch() {
  const { search } = yield* useContext(RouteContext);
  return search as Search;
}

export function* usePathname() {
  const { pathname } = yield* useContext(RouteContext);
  return pathname as Path;
}

export function* useActiveTab() {
  let pathname: string = yield* usePathname();
  pathname = pathname.substring(1);
  return tabs.find((tab) => tab.id === pathname) ?? ({ id: "counter", label: "Counter" } as const);
}
