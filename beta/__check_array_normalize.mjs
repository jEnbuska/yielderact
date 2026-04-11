// Self-contained smoke test for the wrap-arrays-as-Fragments normalization.
//
// Mirrors the algorithm in beta/src/jsx.ts (createElement + wrapArrayChildren)
// without importing it, so this script runs under plain `node` with no
// build step. The production code is verified by `npm run typecheck`;
// this script proves the algorithm produces the right *shape* on the user's
// nested-array example.
//
// Run: node beta/__check_array_normalize.mjs

const Fragment = Symbol("Fragment");

function createElement(type, props, ...children) {
  props = props ?? {};
  let effective;
  if ("$children" in props && props.$children !== undefined) {
    const v = props.$children;
    effective = Array.isArray(v) ? v : [v];
  } else if (children.length) {
    effective = children;
  } else {
    effective = [];
  }
  // wrap nested arrays as Fragment vnodes
  let needsWrap = false;
  for (const c of effective) {
    if (Array.isArray(c)) {
      needsWrap = true;
      break;
    }
  }
  if (needsWrap) {
    const result = [];
    for (const c of effective) {
      if (Array.isArray(c)) {
        result.push(createElement(Fragment, null, ...c));
      } else {
        result.push(c);
      }
    }
    effective = result;
  }
  props.$children = effective;
  return { type, props, children: effective };
}

// User-defined component, identified by name in props.
function Com(_props) {}

function buildScene1(count) {
  // First example from the user — D constant inside a 1-element array,
  // X always present, Y only when count is even.
  return createElement(
    "div",
    null,
    ...[
      createElement(Com, { name: "A" }),
      createElement(Com, { name: "C" }),
      [createElement(Com, { name: "D" })],
      count % 2
        ? [createElement(Com, { name: "X" })]
        : [createElement(Com, { name: "X" }), createElement(Com, { name: "Y" })],
    ].filter(Boolean),
  );
}

// ── Pretty-printer ────────────────────────────────────────────────────────

function shape(child) {
  if (child == null || typeof child === "boolean") return "ø";
  if (typeof child === "string" || typeof child === "number") return JSON.stringify(child);
  if (Array.isArray(child)) return `array[${child.map(shape).join(",")}]`;
  // VNode
  const t = child.type;
  let label;
  if (t === Fragment) label = "Fragment";
  else if (typeof t === "string") label = `"${t}"`;
  else if (typeof t === "function") {
    const name = child.props && child.props.name;
    label = t.name + (name ? `[${name}]` : "");
  } else label = String(t);
  return `${label}(${child.children.map(shape).join(",")})`;
}

// ── Diff: walk both trees in parallel like the reconciler would ────────────

function isVNode(c) {
  return c != null && typeof c === "object" && !Array.isArray(c);
}

function sameType(a, b) {
  return isVNode(a) && isVNode(b) && a.type === b.type;
}

function leafName(child) {
  if (!isVNode(child) || typeof child.type !== "function") return null;
  const n = child.props && child.props.name;
  return n ? `${child.type.name}[${n}]` : child.type.name;
}

function collectComponents(child, out) {
  if (!isVNode(child)) return;
  if (typeof child.type === "function") {
    out.push(leafName(child));
    return;
  }
  for (const c of child.children) collectComponents(c, out);
}

function diffChildren(prev, next) {
  const stable = [];
  const added = [];
  const removed = [];
  const len = Math.max(prev.length, next.length);
  for (let i = 0; i < len; i++) {
    const p = prev[i];
    const n = next[i];
    if (p === undefined && n !== undefined) {
      collectComponents(n, added);
      continue;
    }
    if (n === undefined && p !== undefined) {
      collectComponents(p, removed);
      continue;
    }
    if (!sameType(p, n)) {
      collectComponents(p, removed);
      collectComponents(n, added);
      continue;
    }
    if (isVNode(p) && isVNode(n)) {
      if (typeof p.type === "function") {
        // Component slot reused → instance survives → "stable"
        stable.push(leafName(p));
      } else {
        // Fragment / element → recurse into children
        const sub = diffChildren(p.children, n.children);
        stable.push(...sub.stable);
        added.push(...sub.added);
        removed.push(...sub.removed);
      }
    }
  }
  return { stable, added, removed };
}

// ── Run the assertions ─────────────────────────────────────────────────────

function eq(actual, expected, label) {
  const a = [...actual].sort().join(",");
  const e = [...expected].sort().join(",");
  if (a !== e) {
    console.error(`❌ ${label}: expected [${e}], got [${a}]`);
    process.exitCode = 1;
    return false;
  }
  console.log(`✅ ${label}: [${a}]`);
  return true;
}

const even = buildScene1(0);
const odd = buildScene1(1);

console.log("count=0 shape:");
console.log("  " + shape(even));
console.log("count=1 shape:");
console.log("  " + shape(odd));

console.log("\nDiff (count=0 → count=1):");
const diff = diffChildren(even.children, odd.children);
console.log("  stable:", diff.stable);
console.log("  removed:", diff.removed);
console.log("  added:", diff.added);

console.log("\nAssertions:");
eq(diff.stable, ["Com[A]", "Com[C]", "Com[D]", "Com[X]"], "stable components");
eq(diff.removed, ["Com[Y]"], "removed components");
eq(diff.added, [], "added components");

if (process.exitCode) {
  console.log("\n💥 Smoke test FAILED");
} else {
  console.log("\n🎯 Smoke test PASSED — only Y mounts/unmounts on the count toggle.");
}
