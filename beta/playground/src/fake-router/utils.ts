import { PreparedRoute } from "./PreparedRoute";

export function getRouteParamProperties(routeSegments: string[]) {
  const paramIndexes: number[] = [];
  const paramNames: string[] = [];
  for (let i = 0; i < routeSegments.length; i++) {
    const segment = routeSegments[i];
    if (!segment.startsWith(":")) continue;
    paramIndexes.push(i);
    paramNames.push(segment.substring(1));
  }
  return { paramIndexes, paramNames };
}

export function getParamEntries(paramIndexes: number[], paramNames: string[], pathname: string) {
  const segments = getSegments(pathname);
  const entries: [string, string][] = [];
  for (let i = 0; i < paramIndexes.length; i++) {
    const index = paramIndexes[i];
    const name = paramNames[index];
    const value = segments[index];
    entries.push([name, value]);
  }
  return entries;
}

export function getSegments(path: string): string[] {
  return path.split("/").filter(Boolean);
}

export function findRoutes(segments: string[], routes: PreparedRoute[]): PreparedRoute[] {
  function segmentMatches(segment: string, index: number) {
    return segment.startsWith(":") || segment === segments[index];
  }
  return routes
    .filter((route) => {
      if (route.index) return !segments.length;
      return route.segments.every(segmentMatches);
    })
    .flatMap((route) => [
      route,
      ...findRoutes(segments.slice(route.segments.length), route.children),
    ]);
}

export function shallowEquals(a: Record<string, any>, b: Record<string, any> | undefined) {
  const aEntries = Object.entries(a);
  if (!b) return false;
  const bKeys = Object.keys(b);
  if (aEntries.length !== bKeys.length) return false;
  for (const [key, value] of aEntries) {
    if (b[key] !== value) return false;
  }
  return true;
}

export function notEmpty<T>(arr: T[]): arr is [T, ...T[]] {
  return arr.length > 0;
}

export function isNil<T>(value: T | null | undefined): value is null | undefined {
  return value == null;
}
export function assertIsNotNil<T>(value: T | null | undefined): asserts value is T {
  if (isNil(value)) throw new Error(`Expected value to be not nil but got ${value}`);
}
