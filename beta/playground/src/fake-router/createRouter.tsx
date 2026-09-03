import {
  $halt,
  Child,
  ComponentGenerator,
  getForceUpdate,
  useContext,
  useDefer,
  useEffect,
  useMemo,
  useRef,
  useStable,
  useState,
} from "yract-beta";
import {
  NavigationStatusContext,
  OutletContext,
  RouteContext,
  RouteContextValue,
} from "./contexts";
import { IndexRoute, Route } from "./types";
import { assertIsNotNil, findRoutes, getSegments, notEmpty } from "./utils";
import { PreparedRoute } from "./PreparedRoute";
import { $getLoaderPromise, useCreatePreloadingContext, useHandleInitialLoad } from "./hooks";
import { createResolvable } from "../../../src/create-resolvable";

export function createRouter<TSearch = string, TArgs = undefined>(
  routes: Array<Route<TSearch, TArgs> | IndexRoute<TSearch, TArgs>>,
  options: {
    onPreload?: Child;
    args?: TArgs;
    parseSearch?: (search: string) => TSearch;
  } = {},
) {
  const { onPreload } = options;
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
    yield* useHandleInitialLoad(currentRoutes, onPreload, pathname, search, hash);

    const match = currentRoutes[currentRoutes.length - 1]?.match;
    const preloadingCtx = yield* useMemo(
      () => ({ subscribe: rootSubscribe, getState: rootGetState }),
      [href],
    );
    const navigationPromise = yield* useRef<PromiseWithResolvers<void> | undefined>(undefined);
    const navigate = yield* useStable(async (nextHref: string, replace?: boolean) => {
      if (nextHref === href) return;
      navigationPromise.current = createResolvable<void>();
      await Promise.all([navigationPromise.current.promise, setHrefState(nextHref)] as const);
      if (replace) history.replaceState(null, "", nextHref);
      else history.pushState(null, "", nextHref);
    });

    const navigatingRoutes = yield* useMemo(() => new Set<PreparedRoute>());
    yield* useEffect(() => {
      if (navigatingRoutes.size) return;
      navigationPromise.current?.resolve();
    }, [href]);

    const onNavigating = yield* useStable((route) => {
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

type RouteProps = {
  routes: [PreparedRoute, ...PreparedRoute[]];
  unmounting: boolean;
};

function* Route({ routes, unmounting }: RouteProps): ComponentGenerator {
  const [next] = routes;
  assertIsNotNil(next);
  const routesRef = yield* useRef(routes);
  const [current, ...children] = routesRef.current;
  const promise = yield* $getLoaderPromise(routesRef.current);
  const loading = !!promise;
  const preloading = yield* useCreatePreloadingContext(loading, unmounting);
  const ctx = yield* useContext(RouteContext);
  const forceUpdate = yield* getForceUpdate();
  const prepareUnmount = current.match !== next.match;
  yield* useEffect(() => {
    if (!prepareUnmount) return;
    routesRef.current = routes;
    forceUpdate();
  }, [next.match]);
  yield* useEffect(() => {
    if (!promise) return;
    let cancelled = false;
    promise.finally(() => {
      if (cancelled) return;
      forceUpdate();
    });
  }, [promise]);
  const [Defer, isDeferred] = yield* useDefer({ disabled: !prepareUnmount });
  const navigating = yield* useMemo(
    (...args) => args.some(Boolean),
    [prepareUnmount || loading, next.match !== current.match, isDeferred],
  );
  yield* useEffect(() => {
    if (!navigating) return;
    return ctx.onNavigating(current);
  }, [navigating]);
  if (prepareUnmount || loading) yield* $halt();
  const Component = next.getComponent();
  const outlet = notEmpty(children) ? (
    <Route routes={children} unmounting={unmounting || prepareUnmount} />
  ) : null;
  if (!Component) {
    return (
      <Defer>
        <RouteContext value={ctx}>
          <NavigationStatusContext value={preloading}>{outlet}</NavigationStatusContext>
        </RouteContext>
      </Defer>
    );
  }
  return (
    <Defer>
      <OutletContext value={outlet} key={current.match}>
        <RouteContext value={ctx}>
          <NavigationStatusContext value={preloading}>
            <Component />
          </NavigationStatusContext>
        </RouteContext>
      </OutletContext>
    </Defer>
  );
}
