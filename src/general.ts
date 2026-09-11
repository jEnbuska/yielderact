import type { Children, FrameworkProps } from "./jsx";
import type { DependencyList } from "./general-types";
import type { ComponentSlotType, ContextSlotType, SlotProps } from "./slots/slot";

/**
 * `Map.prototype.getOrInsertComputed` without the engine requirement — that
 * method needs V8 14.6 (Node 26), which puts it out of reach on current LTS.
 *
 * Uses `has` rather than a truthiness check on `get`, so a computed
 * `undefined` is cached instead of recomputed on every call, matching the
 * built-in's semantics.
 */
export function getOrInsertComputed<K extends object, V>(
  map: WeakMap<K, V>,
  key: K,
  compute: (key: K) => V,
): V {
  if (map.has(key)) return map.get(key)!;
  const value = compute(key);
  map.set(key, value);
  return value;
}

const _values = new WeakMap<ReadonlyMap<any, any>, any[]>();
const _valuesReversed = new WeakMap<ReadonlyMap<any, any>, any[]>();

export function getMapValuesReversed<T>(map: ReadonlyMap<any, T>): T[] {
  return getOrInsertComputed(_valuesReversed, map, mapValuesReversed);
}

function mapValuesReversed<T>(map: ReadonlyMap<any, T>) {
  return getMapValues(map).toReversed();
}

export function getMapValues<T>(map: ReadonlyMap<any, T>): T[] {
  return getOrInsertComputed(_values, map, mapValues);
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

export const frameworkProps: Set<string> = new Set(["key", "deps"] satisfies Array<
  keyof FrameworkProps
>);
export function propsEquals(
  a: SlotProps<ComponentSlotType | ContextSlotType>,
  b: SlotProps<ComponentSlotType | ContextSlotType>,
): boolean {
  if (a === b) return true;
  for (const k in a) {
    if (frameworkProps.has(k)) continue;
    const key = k as keyof SlotProps<ComponentSlotType | ContextSlotType>;
    if (!Object.is(a[key], b[key])) return false;
  }
  for (const k in b) {
    if (frameworkProps.has(k)) continue;
    const key = k as keyof SlotProps<ComponentSlotType | ContextSlotType>;
    if (!Object.is(a[key], b[key])) return false;
  }
  return true;
}

export function stripFrameworkProps<T extends Record<string, any>>(props: T): T {
  const copy: T = {} as any;
  let hasFrameworkProps = false;
  for (const k in props) {
    const isFrameworkProps = frameworkProps.has(k);
    if (isFrameworkProps) {
      hasFrameworkProps ||= true;
      continue;
    }
    copy[k] = props[k];
  }
  return hasFrameworkProps ? copy : props;
}

export function isArrayChildren(children: Children): children is ReadonlyArray<Children> {
  return Array.isArray(children);
}
