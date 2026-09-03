import { Component } from "yract-beta";

type Cause = "enter" | "stay";
export type Load<
  TSearch,
  TArgs = undefined,
  TParams extends string = string,
  TDeps extends Readonly<Record<string, string | undefined>> | undefined = undefined,
> = (args: {
  controller: AbortController;
  deps: TDeps;
  params: RouteParams<TParams>;
  search: TSearch;
  hash: string;
  args: TArgs;
}) => Promise<unknown>;
export type Loader<
  TSearch,
  TArgs = undefined,
  TParams extends string = string,
  TDeps extends Readonly<Record<string, string | undefined>> | undefined = undefined,
> = {
  loaderDeps?: (args: {
    params: RouteParams<TParams>;
    search: TSearch;
    hash?: string;
    args: TArgs;
  }) => TDeps;
  shouldReload?: (args: {
    deps: TDeps;
    params: RouteParams<TParams>;
    search: TSearch;
    hash: string;
    cause: "enter" | "stay";
    args: TArgs;
  }) => boolean;
  load: Load<TSearch, TArgs, TParams, TDeps>;
};
export type LazyComponent = { lazy: () => Promise<Component> };
export type RouteComponent = Component | LazyComponent;

export type Route<TSearch = string, TArgs = unknown> = {
  path: Path;
  children?: Array<Route<TSearch, TArgs> | IndexRoute<TSearch, TArgs>>;
  index?: undefined | false;
  loaders?: Loader<TSearch, TArgs, any>[];
  component?: RouteComponent;
};

export type Path<T extends string> = `/${T}`;

export type RouteParams<TKeys extends string> = Readonly<Record<TKeys, string | undefined>>;

export type IndexRoute<TSearch = string, TArgs = unknown> = {
  index: true;
  loaders?: Loader<TSearch, TArgs, any>[];
  component: RouteComponent;
};

type Redirect = ["REDIRECT", Path];

type NotFound = ["NOT_FOUND"];

type Error = ["ERROR", Error];

export type BeforeLoad = () => Promise<void | any>;

function Callback(com: Component) {}
