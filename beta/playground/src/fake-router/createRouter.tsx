import { Child, useEffect, useMemo, useRef, useStable, useState } from "yract-beta";
import { NavigationStatusContext, RouteContext, RouteContextValue } from "./contexts";
import type { IndexRoute, PathRoute } from "./types";
import { findRoutes, getSegments, notEmpty } from "./utils";
import { PreparedRoute } from "./PreparedRoute";
import { useHandleInitialLoad } from "./hooks";
import { createResolvable } from "../../../src/create-resolvable";
import { Route } from "./Route";

export function createRouter<TSearch = string, TArgs = undefined>(
  routes: Array<PathRoute<TSearch, TArgs> | IndexRoute<TSearch, TArgs>>,
  options: {
    onBeforeLoad?: Child;
    args?: TArgs;
    parseSearch?: (search: string) => TSearch;
  } = {},
) {
  const { onBeforeLoad } = options;
  const parseSearch = options.parseSearch ?? ((search) => search as TSearch);
  const preparedRoutes = routes.map(
    (route) => new PreparedRoute<TSearch, TArgs>(route, options.args!),
  );
  const rootSubscribe = () => () => {};
  const rootGetState = () => "IDLE" as const;

  return function* Router() {
    const [href, setHrefState] = yield* useState(location.href.replace(location.origin, ""));
    const url = new URL(href, location.origin);
    const { pathname, hash } = url;
    const search = yield* useMemo(parseSearch, [url.search]);

    const currentRoutes = yield* useMemo(
      () => findRoutes(getSegments(pathname), preparedRoutes),
      [pathname],
    );
    yield* useHandleInitialLoad(currentRoutes, onBeforeLoad, pathname, search, hash);

    const match = currentRoutes[currentRoutes.length - 1]?.match;
    const preloadingCtx = yield* useMemo(
      () => ({ subscribe: rootSubscribe, getState: rootGetState }),
      [href],
    );
    const navigationPromise = yield* useRef<PromiseWithResolvers<void> | undefined>(undefined);
    const navigate = yield* useStable(async (nextHref: string, replace?: boolean) => {
      if (nextHref === href) return;
      navigationPromise.current = createResolvable<void>();
      await Promise.all([navigationPromise.current.promise, setHrefState(nextHref)]);
      if (replace) history.replaceState(null, "", nextHref);
      else history.pushState(null, "", nextHref);
    });

    const navigatingRoutes = yield* useMemo(() => new Set<PreparedRoute>());
    yield* useEffect(() => {
      if (navigatingRoutes.size) return;
      navigationPromise.current?.resolve();
    }, [href]);

    const onNavigating = yield* useStable((route: PreparedRoute) => {
      navigatingRoutes.add(route);
      return () => {
        navigatingRoutes.delete(route);
        if (navigatingRoutes.size) return;
        navigationPromise.current?.resolve();
      };
    });

    yield* useEffect(() => {
      const onPop = () => void setHrefState(location.href.replace(location.origin, ""));
      window.addEventListener("popstate", onPop);
      return () => window.removeEventListener("popstate", onPop);
    });

    const rCtx = yield* useMemo((): RouteContextValue<any> => {
      return {
        hash,
        match,
        pathname,
        search,
        navigate,
        onNavigating,
      };
    }, [href]);
    if (!notEmpty(currentRoutes)) return null;

    return (
      <RouteContext value={rCtx}>
        <NavigationStatusContext value={preloadingCtx}>
          <Route routes={currentRoutes} unmounting={false} />
        </NavigationStatusContext>
      </RouteContext>
    );
  };
}
