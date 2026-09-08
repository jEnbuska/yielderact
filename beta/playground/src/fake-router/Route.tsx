import {
  ComponentGenerator,
  requireForceUpdate,
  requireHalt,
  useContext,
  useDefer,
  useEffect,
  useMemo,
  useRef,
} from "yract-beta";
import { assertIsNotNil, notEmpty } from "./utils";
import { useCreatePreloadingContext, useLoadRoute } from "./hooks";
import { NavigationStatusContext, OutletContext, RouteContext } from "./contexts";
import { PreparedRoute } from "./PreparedRoute";

type RouteProps = {
  nextRoutes?: [PreparedRoute, ...PreparedRoute[]];
  routes: [PreparedRoute, ...PreparedRoute[]];
  unmounting: boolean;
};

export function* Route({ routes, unmounting }: RouteProps): ComponentGenerator {
  const [next] = routes;
  assertIsNotNil(next);
  const refRoutes = yield* useRef(routes);
  const [prev] = refRoutes.current;
  console.log("next", next.match, prev.match);
  const promise = yield* useLoadRoute(routes);
  const [current, ...children] = routes;
  console.log("promise", promise);
  const loading = !!promise;
  const preloading = yield* useCreatePreloadingContext(loading, unmounting);
  const ctx = yield* useContext(RouteContext);
  const forceUpdate = yield* requireForceUpdate();
  const prepareUnmount = current.match !== next.match;
  yield* useEffect(() => {
    if (!prepareUnmount) return;
    refRoutes.current = routes;
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
  if (prepareUnmount || loading) return yield* requireHalt();
  const Component = next.getComponent();
  const outlet = notEmpty(children) ? (
    <Route routes={children} unmounting={unmounting || prepareUnmount} />
  ) : null;
  if (!Component) {
    return (
      <Defer>
        <OutletContext value={outlet}>
          <RouteContext value={ctx}>
            <NavigationStatusContext value={preloading}>{outlet}</NavigationStatusContext>
          </RouteContext>
        </OutletContext>
      </Defer>
    );
  }
  return (
    <Defer>
      <OutletContext value={outlet}>
        <RouteContext value={ctx}>
          <NavigationStatusContext value={preloading}>
            <Component />
          </NavigationStatusContext>
        </RouteContext>
      </OutletContext>
    </Defer>
  );
}
