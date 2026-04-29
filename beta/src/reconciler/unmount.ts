/**
 * Leaf module for the unmount path — kept free of any imports that pull in
 * `BaseInstance` / `ComponentInstance` / `ContextInstance` so it can be used
 * from both the reconciler and `BaseInstance` without forming an import
 * cycle. `slots.ts` only references the instance classes via `import type`,
 * so its presence here is safe.
 */
export function removeRange(first: Node, last: Node, parent: Node): void {
  let cur: Node | null = first;
  while (cur) {
    const next: Node | null = cur === last ? null : cur.nextSibling;
    if (cur.parentNode === parent) parent.removeChild(cur);
    cur = next;
  }
}
