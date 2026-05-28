import type { ComponentSlotType, ContextSlotType, Slot } from "./slots/slot";
import type { Children } from "./jsx";
import type { DependencyList, DraftBy } from "./general-types";

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

// TODO handle keying children
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
      return { children: only, ...props };
    }
    default:
      return { children, ...props };
  }
}

export function isArrayChildren(children: Children): children is ReadonlyArray<Children> {
  return Array.isArray(children);
}
