import {
  $halt,
  Child,
  ComponentGenerator,
  getForceUpdate,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useStable,
  useState,
} from "yract-beta";
import {
  NavigationStatusContext,
  PreloadingContextType,
  PreloadingStatus,
  RouteContext,
} from "./contexts";
import { PreparedRoute } from "./PreparedRoute";

export function* useCreatePreloadingContext(
  loading: boolean,
  unmounted: boolean,
): ComponentGenerator<PreloadingContextType> {
  const preloadingCtx = yield* useContext(NavigationStatusContext);
  const { current: subscribers } = yield* useRef(new Set<() => void>());
  const initial = yield* useRef(true);
  console.log("loading", loading, "unmounted", unmounted);
  const getState = yield* useStable((): PreloadingStatus => {
    if (unmounted) return "UNMOUNTING";
    if (loading) return "UPDATING";
    return preloadingCtx.getState();
  });
  const subscribe = yield* useStable((cb: () => void) => {
    subscribers.add(cb);
    const unsubscribe = preloadingCtx.subscribe(cb);
    return function () {
      subscribers.delete(cb);
      unsubscribe();
    };
  });
  yield* useEffect(() => {
    if (initial.current) {
      initial.current = false;
      return;
    }
    for (const sub of subscribers) {
      sub();
    }
  }, [loading, unmounted]);
  return yield* useMemo(() => ({
    subscribe,
    getState,
  }));
}

export function* useHandleInitialLoad(
  routes: PreparedRoute[],
  onPreload: Child,
  pathname: string,
  search: any,
  hash: string,
) {
  const initial = yield* useRef(true);
  if (!initial.current) return;
  initial.current = false;

  const args = { pathname, search, hash };
  const promises = routes.map((route) => route.load(args)).filter(Boolean) as Array<
    Promise<unknown>
  >;
  if (!promises.length) return;
  const forceUpdate = yield* getForceUpdate();
  Promise.all(promises).then(() => forceUpdate());
  yield* $halt(onPreload);
}
export function* $getLoaderPromise(routes: PreparedRoute[]) {
  const [route, ...rest] = routes;
  const loads = yield* useRef(0);
  const { pathname, search, hash } = yield* useContext(RouteContext);
  const load = route.load({ pathname, hash, search });

  if (load) {
    loads.current++;
  }
  return yield* useMemo(() => {
    if (!load) return;
    return Promise.all([
      load,
      ...rest.map((route) => route.load({ pathname, hash, search })).filter(Boolean),
    ]);
  }, [loads.current, load]);
}

export function* useNavigationStatus() {
  const { getState, subscribe } = yield* useContext(NavigationStatusContext);
  const [_, setChanges] = yield* useState(0);

  yield* useEffect(() => {
    return subscribe(() => {
      console.log("-------Change to:-------", getState());
      void setChanges((prev) => prev + 1);
    });
  });
  return getState();
}
