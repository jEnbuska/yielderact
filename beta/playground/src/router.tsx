import { createRouter } from "./fake-router/createRouter";
import { Search } from "./types";
import { tabPaths } from "./constants";
import { createPersonRows } from "./global-state";
import { parseSearch } from "./utils";
import { App } from "./App";

export const Router = createRouter<Search>(
  [
    {
      path: "/",
      component: App,
      children: [
        {
          index: true,
          component: {
            lazy: () => import("./pages/counter").then((exp) => exp.Counter),
          },
        },
        {
          path: tabPaths.COUNTER,
          component: {
            lazy: () => import("./pages/counter").then((exp) => exp.Counter),
          },
        },
        {
          path: tabPaths.AWAIT,
          component: {
            lazy: () => import("./pages/await").then((exp) => exp.AwaitDemo),
          },
        },
        {
          path: tabPaths.DOS,
          component: {
            lazy: () => import("./pages/dos").then((exp) => exp.DosDemo),
          },
        },
        {
          path: tabPaths.CONTEXT,
          component: {
            lazy: () => import("./pages/context").then((exp) => exp.ContextDemo),
          },
        },
        {
          path: tabPaths.DEFERRED,
          component: {
            lazy: () => import("./pages/deferred").then((exp) => exp.DeferredDemo),
          },
          loaders: [
            {
              async load() {
                return Promise.all([
                  createPersonRows(40_000),
                  new Promise<void>((res) => setTimeout(res, 3000)),
                ]);
              },
            },
          ],
        },
        {
          path: tabPaths.EFFECT,
          component: {
            lazy: () => import("./pages/effect").then((exp) => exp.EffectDemo),
          },
        },
        {
          path: tabPaths.HOOKS,
          component: {
            lazy: () => import("./pages/hooks").then((exp) => exp.HooksShowcase),
          },
        },
        {
          path: tabPaths.SLOTS,
          component: {
            lazy: () => import("./pages/slots").then((exp) => exp.SlotsDemo),
          },
        },
        {
          path: tabPaths.TODOS,
          component: {
            lazy: () => import("./pages/todos").then((exp) => exp.TodoList),
          },
        },
        {
          path: tabPaths.KEY_SHUFFLE,
          component: {
            lazy: () => import("./pages/key-shuffle").then((exp) => exp.KeyShuffleDemo),
          },
        },
        {
          path: tabPaths.LAZY_CTX,
          component: {
            lazy: () => import("./pages/lazy-ctx").then((exp) => exp.LazyContextDemo),
          },
        },
      ],
    },
  ],
  {
    parseSearch,
    onBeforeLoad: <h1>Loading</h1>,
  },
);
