import type { ComponentSlotType, ContextSlotType, Slot } from "./slots/slot";
import {
  componentSlotType,
  contextSlotType,
  elementSlotType,
  fragmentSlotType,
} from "./slots/slot";
import type { Children } from "./jsx";
import type { DependencyList, DraftBy } from "./general-types";
import type { DraftIntent } from "./slots/intent-draft";

const _values = new WeakMap<ReadonlyMap<any, any>, any[]>();
const _valuesReversed = new WeakMap<ReadonlyMap<any, any>, any[]>();

export function getMapValuesReversed<T>(map: ReadonlyMap<any, T>): T[] {
  return _valuesReversed.getOrInsertComputed(map, mapValuesReversed);
}

function mapValuesReversed<T>(map: ReadonlyMap<any, T>) {
  return getMapValues(map).toReversed();
}

export function getMapValues<T>(map: ReadonlyMap<any, T>): T[] {
  return _values.getOrInsertComputed(map, mapValues);
}

function mapValues<T>(map: ReadonlyMap<string, T>) {
  return [...map.values()];
}

export const emptyMap: ReadonlyMap<any, any> = new Map<any, any>();

let randomRoot: string | undefined;
let randomIndex = 0;
export function randomId(): string {
  if (randomRoot === undefined) {
    randomRoot = Math.random().toString(36).slice(2);
    while (randomRoot.length < 8) randomRoot = Math.random().toString(36).slice(2);
  }
  return `${randomRoot}${randomIndex++}`;
}
/** Returns true when the dependency arrays differ (shallow `Object.is` comparison). */
export function depsChanged(
  prev: DependencyList | undefined,
  next: DependencyList | undefined,
): boolean {
  if (prev === undefined || next === undefined) return true;
  if (prev.length !== next.length) return true;
  for (let i = 0; i < prev.length; i++) {
    if (!Object.is(prev[i], next[i])) return true;
  }
  return false;
}

/** Shallow equality check for two objects (same keys, all values `Object.is`). */
export function shallowEqual(a: Record<string, unknown>, b: Record<string, unknown>): boolean {
  if (a === b) return true;
  const aKeys = Object.keys(a);
  if (aKeys.length !== Object.keys(b).length) return false;
  for (const k of aKeys) {
    if (!(k in b) || !Object.is(a[k], b[k])) return false;
  }
  return true;
}

/**
 * Merge a VNode's positional children into its props as `children`,
 * stripping framework directives (`key`, `shown`) that are consumed
 * by the reconciler and should never reach component/context instances.
 */
export function propsWithChildren(
  intent: Omit<
    DraftBy<Slot<ComponentSlotType | ContextSlotType>, "instance" | "prevProps">,
    "type"
  >,
): Record<string, unknown> & { children?: Children | ReadonlyArray<Children> } {
  const { children, props } = intent;
  switch (children.length) {
    case 0:
      return props;
    case 1: {
      const only = children[0];
      if (only == null || typeof only === "boolean") {
        return props;
      }
      return { children: only, ...props };
    }
    default:
      return { children, ...props };
  }
}

export function isArrayChildren(children: Children): children is ReadonlyArray<Children> {
  return Array.isArray(children);
}

export function childrenEquals(children: Children, another: Children): boolean {
  children ??= "";
  another ??= "";
  if (children === another) return true;
  if (typeof another !== typeof children) {
    return false;
  }

  if (isArrayChildren(children)) {
    if (!isArrayChildren(another)) {
      return false;
    }
    if (children.length !== another.length) return false;
    for (let i = 0; i < children.length; i++) {
      if (childrenEquals(children[i], another[i])) continue;
      return false;
    }
    return true;
  }

  if (typeof children === "object" && typeof another === "object") {
    const prevDraft = another as DraftIntent;
    if (children.type !== prevDraft.type) {
      console.log("different draft.type children");
      return false;
    }
    if (children.key !== prevDraft.key) {
      console.log("child.key", children.key, "vs", prevDraft.key);
      console.log("different keys children");
      return false;
    }
    switch (children.type) {
      case contextSlotType:
        if (children.context !== prevDraft.context) {
          console.log("different contexts");
          return false;
        }
        break;
      case componentSlotType:
        if (children.component !== prevDraft.component) {
          console.log("different components");
          return false;
        }
        break;
      case elementSlotType:
        if (children.element !== prevDraft.element) {
          console.log("different elements");
          return false;
        }

        break;
      case fragmentSlotType:
        return childrenEquals(children.children, prevDraft.children);
    }
    if (!shallowEqual(children.props, prevDraft.props)) return false;
    return childrenEquals(children.children, prevDraft.children);
  }
  console.log("another is not object");
  return false;
}

export function copyChildren(children: Children): Children {
  if (children == null) return children;
  if (Array.isArray(children)) return children.map(copyChildren);
  switch (typeof children) {
    case "object": {
      const copy = { ...children };
      if ("children" in copy) {
        copy.children = copy.children.map(copyChildren);
      }
      return copy;
    }
    default:
      return children;
  }
}
