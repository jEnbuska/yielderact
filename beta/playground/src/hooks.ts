import { useContext } from "yract-beta";
import { RouteContext } from "./fake-router/contexts";
import { Pathname, Search } from "./types";

export function* useSearch() {
  const { search } = yield* useContext(RouteContext);
  return search as Search;
}

export function* usePathname() {
  const { pathname } = yield* useContext(RouteContext);
  return pathname as Pathname;
}
