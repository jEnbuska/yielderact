import { IndexRoute, Load, Loader, Route, RouteComponent, RouteParams } from "./types";
import { getParamEntries, getSegments, shallowEquals } from "./utils";

type OngoingLoad = { controller: AbortController; promise: Promise<unknown> };
type PendingLoad<TSearch, TArgs> = {
  load: Load<TSearch, TArgs, any, any>;
  controller: AbortController;
  deps: any;
  params: RouteParams<string>;
  search: TSearch;
  hash: string;
};
export class PreparedRoute<TSearch = any, TArgs = any> {
  static #resolvedPromises = new WeakMap<Promise<unknown>, any>();
  #component: RouteComponent | undefined;
  readonly segments: string[] = [];
  readonly index: boolean;
  readonly match: string;
  readonly children: PreparedRoute<TSearch, TArgs>[];
  readonly #args: TArgs;
  readonly #paramIndexes: number[];
  readonly #paramNames: string[];
  readonly #loaders: Array<Loader<TSearch, TArgs, any, any>>;
  readonly #staged: Array<undefined | PendingLoad<TSearch, TArgs>> = [];
  readonly #ongoing: Array<undefined | OngoingLoad> = [];
  #lastPathname: string = "";
  #lastParams: RouteParams<string> | undefined = undefined;
  #lastDeps: Array<Record<string, any> | undefined> = [];

  constructor(
    route: Route<TSearch, TArgs> | IndexRoute<TSearch, TArgs>,
    args: TArgs,
    segments: string[] = [],
  ) {
    this.index = !!route.index;
    const path = route.index ? "/" : route.path;
    this.segments = [...segments, ...getSegments(path)];
    this.match = `/${segments.filter(Boolean).join("/")}`;
    const children = route.index ? [] : (route.children ?? []);
    this.children = children.map(
      (child) => new PreparedRoute<TSearch, TArgs>(child, args, segments),
    );
    this.#component = route.component;
    const { loaders = [] } = route;
    this.#loaders = loaders;
    const paramIndexes: number[] = [];
    this.#staged = new Array(loaders.length).fill(undefined);
    this.#lastDeps = new Array(loaders.length).fill(undefined);
    this.#ongoing = new Array(loaders.length).fill(undefined);
    this.#args = args;
    const paramNames: string[] = [];
    for (let i = 0; i < this.segments.length; i++) {
      const segment = this.segments[i];
      if (!segment.startsWith(":")) continue;
      paramIndexes.push(i);
      paramNames.push(segment.substring(1));
    }
    this.#paramNames = paramNames;
    this.#paramIndexes = paramIndexes;
  }

  getComponent() {
    if (typeof this.#component === "object") {
      throw new Error("Component is lazy, use loadComponent() to load it first.");
    }
    return this.#component;
  }

  #getParams(pathname: string): RouteParams<string> {
    if (pathname === this.#lastPathname) return this.#lastParams!;
    this.#lastPathname = pathname;
    const params = getParamEntries(this.#paramIndexes, this.#paramNames, pathname);
    const last = this.#lastParams;
    for (const [name, value] of params) {
      if (last?.[name] !== value) {
        return (this.#lastParams = Object.freeze(Object.fromEntries(params)));
      }
    }
    this.#lastParams ??= Object.freeze({});
    return this.#lastParams;
  }

  load(args: { pathname: string; hash: string; search: TSearch }) {
    const { pathname, hash, search } = args;
    const params = this.#getParams(pathname);
    const depsArgs = { params, search, hash, args: this.#args };
    for (let i = 0; i < this.#loaders.length; i++) {
      const loader = this.#loaders[i];
      const deps = loader.loaderDeps?.(depsArgs) ?? depsArgs;
      if (shallowEquals(deps, this.#lastDeps[i])) continue;
      this.#lastDeps[i] = deps;
      this.#staged[i]?.controller.abort();
      this.#staged[i] = {
        load: loader.load,
        deps,
        controller: new AbortController(),
        hash,
        search,
        params,
      };
    }
    return this.#resolvePromises();
  }

  #resolvePromises() {
    const promises: Array<Promise<unknown>> = [];
    if (typeof this.#component === "object") {
      promises.push(this.#component.lazy().then((Component) => (this.#component = Component)));
    }
    for (let i = 0; i < this.#staged.length; i++) {
      const pending = this.#staged[i];
      this.#staged[i] = undefined;
      const ongoing = this.#ongoing[i];
      if (!pending) {
        if (!ongoing) continue;
        if (PreparedRoute.#resolvedPromises.has(ongoing.promise)) continue;
        promises.push(ongoing.promise);
        continue;
      }
      if (ongoing) ongoing.controller.abort();
      this.#ongoing[i] = undefined;
      const { load, controller, deps, hash, params, search } = pending;
      const promise = load({
        deps,
        controller,
        params,
        hash,
        search,
        args: this.#args,
      });
      if (PreparedRoute.#resolvedPromises.has(promise)) continue;
      this.#ongoing[i] = { controller, promise };
      const current = this.#ongoing[i];
      return promise.then((result) => {
        if (current !== this.#ongoing[i]) return;
        this.#ongoing[i] = undefined;
        PreparedRoute.#resolvedPromises.set(promise, result);
      });
    }
    if (promises.length) return Promise.all(promises);
  }
}
