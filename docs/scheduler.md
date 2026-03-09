# yielderact — Priority Scheduler & Batched Commits

> Internal documentation for the cooperative rendering scheduler, batched DOM
> commits, and the `$deferred` priority system.

---

## Table of Contents

1. [Overview](#overview)
2. [Batched DOM commits](#batched-dom-commits)
   - [Patch queue](#patch-queue)
   - [Off-DOM optimization](#off-dom-optimization)
3. [Cooperative scheduling](#cooperative-scheduling)
   - [Work loop](#work-loop)
   - [Time slicing via MessageChannel](#time-slicing-via-messagechannel)
   - [Sync mode](#sync-mode)
4. [Priority system](#priority-system)
   - [$deferred prop](#deferred-prop)
   - [Priority propagation](#priority-propagation)
   - [Priority levels and ordering](#priority-levels-and-ordering)
5. [setState priority rules](#setstate-priority-rules)
6. [Preemption](#preemption)
   - [Detection](#detection)
   - [Patch ops save/restore](#patch-ops-saverestore)
   - [Recursive preemption](#recursive-preemption)
7. [Generator abandonment](#generator-abandonment)
8. [Interaction with UI patches](#interaction-with-ui-patches)
9. [Key source files](#key-source-files)

---

## Overview

yielderact uses a **priority-aware cooperative scheduler** for rendering updates.
Instead of applying DOM mutations as they occur during reconciliation, all
mutations are collected into a **patch queue** and committed atomically after
each priority level completes. This gives two guarantees:

1. **No intermediate visual states** — the browser never paints a half-updated
   tree.
2. **Higher-priority work preempts lower-priority work** — urgent updates
   (priority 0) interrupt deferred updates (priority 1+) at yield boundaries.

---

## Batched DOM commits

### Patch queue

All DOM operations during reconciliation are routed through wrapper functions
in `patch-queue.ts` instead of calling the DOM API directly:

| Wrapper           | Wraps                      |
| :---------------- | :------------------------- |
| `domInsertBefore` | `parent.insertBefore(…)`   |
| `domAppendChild`  | `parent.appendChild(…)`    |
| `domRemoveChild`  | `parent.removeChild(…)`    |
| `domSetText`      | `textNode.textContent = …` |
| `domEnqueue`      | Arbitrary DOM operation    |

Each wrapper checks two conditions:

1. **Is a patch active?** (`_ops !== null`)
2. **Is the target node connected to the live DOM?** (`node.isConnected`)

If both are true, the operation is pushed onto the `_ops` array for later
commit. Otherwise it executes immediately.

The lifecycle of a patch is:

```
beginPatch()          →  _ops = []
  reconcile…          →  ops pushed to _ops
commitPatch()         →  for (op of _ops) op();  _ops = null
```

`commitPatch()` iterates the array in a plain `for` loop — synchronous and
uninterruptible — so the browser never paints between operations.

### Off-DOM optimization

Operations on **off-DOM nodes** (newly created elements not yet connected to
the document) execute immediately even during an active patch. They are
invisible to the user regardless, and deferring them would add unnecessary
overhead.

---

## Cooperative scheduling

### Work loop

The scheduler maintains a priority queue: `Map<number, Set<GenInstance>>`. Work
is added via `scheduleUpdate(instance)`, which determines the appropriate
priority (see [setState priority rules](#setstate-priority-rules)) and adds the
instance to the corresponding set.

The work loop (`_runLoop`) processes priorities from lowest number (highest
urgency) to highest number:

```
for each priority level (ascending):
    beginPatch()
    for each instance in the set:
        instance._executeRerender()
        check for preemption
        check time budget (async mode)
    commitPatch()
```

Each priority level gets its own `beginPatch()`/`commitPatch()` cycle, so DOM
mutations are committed atomically per level. This means priority-0 updates are
visible to the user before priority-1 work begins.

### Time slicing via MessageChannel

In async mode (`_syncMode = false`), the scheduler yields to the browser every
~5 ms to keep the UI responsive. The technique is the same one React's
scheduler uses:

1. After processing an instance, check `performance.now() >= deadline`.
2. If over budget and more work remains, save global state and post a message
   via `MessageChannel`.
3. The `port1.onmessage` callback restores state and calls `_runLoop()` to
   resume.

`MessageChannel` provides minimal-latency scheduling (~0 ms), unlike
`setTimeout` which has a 4 ms minimum delay in most browsers.

On resume, `_activePriority` tells the loop to continue the
partially-processed priority level (skip `beginPatch()` since it was already
called).

### Sync mode

Sync mode (the default) runs the entire work loop to completion without
yielding. This preserves synchronous rendering behavior for tests and simple
applications. Preemption still works — higher-priority work triggered by
effects or context propagation during a rerender is processed immediately
inline.

`flushSync(fn?)` forces sync processing: it optionally executes `fn` with
processing suppressed (batching all `setState` calls), then flushes all pending
work synchronously.

---

## Priority system

### $deferred prop

The `$deferred` prop marks a subtree as lower priority. It is a
framework-level directive — it is stripped from component props before they
reach the component function.

```tsx
function* App() {
  return (
    <div>
      <Header /> {/* priority 0 (default) */}
      <HeavyList $deferred={true} /> {/* priority 1 */}
    </div>
  );
}
```

### Priority propagation

Priority propagates through the context system, just like `$patch`. An
internal context (`_priorityCtx`) tracks the current priority level. Each
`$deferred={true}` increments the priority by 1:

```
_priorityCtx default = 0

<App>                       priority 0
  <Header />                priority 0
  <Content $deferred>       priority 1  (_getCurrentPriority() + 1)
    <Widget $deferred>      priority 2  (_getCurrentPriority() + 1)
    </Widget>
  </Content>
</App>
```

When a generator component mounts, it captures its priority from
`_getCurrentPriority()` and stores it in `instance.priority`. This value is
used by the scheduler to place the instance in the correct priority queue.

### Priority levels and ordering

- **Priority 0** — default, highest urgency. Processed first.
- **Priority 1+** — deferred. Each `$deferred` ancestor adds 1.
- Lower number = higher urgency = processed first.

During the initial mount (`renderState.isInitialMount === true`), priority
levels are ignored — the entire tree mounts as a single synchronous pass. This
prevents `$deferred` from splitting the initial render into multiple passes,
which would cause visual artifacts.

---

## setState priority rules

When `setState` (via a `$state` setter) triggers a rerender, the priority
assigned to the update depends on **when** it was called:

| Context                       | Priority used                         | Rationale                                               |
| :---------------------------- | :------------------------------------ | :------------------------------------------------------ |
| During render of component B  | `renderState.renderingPriority` (B's) | Cross-component setState inherits the caller's priority |
| Outside render (event, timer) | `instance.priority` (own)             | The instance's captured priority from mount             |

This means if a priority-1 component calls `setState` on a priority-0
component during its render, the update is queued at priority 1 (the caller's
level), not priority 0. This prevents lower-priority renders from generating
urgent work that would defeat the purpose of deferral.

When `rerender()` is called:

1. **During render** (`isRendering === true`): sets `pendingRerender = true`.
   The current render is abandoned and retried with the accumulated state.
2. **During an active patch** (`isPatchActive()`): executes synchronously so
   DOM ops are collected into the same patch queue.
3. **Otherwise** (event handler, timer, async callback): calls
   `scheduleUpdate(instance)` to go through the priority-aware scheduler.

---

## Preemption

### Detection

After each instance rerender, the scheduler calls `_handlePreemption(currentPriority)`.
This checks whether any priority level strictly less than `currentPriority` has
pending work.

Higher-priority work can arrive during a lower-priority rerender because:

- A `useEffect` triggers a `setState` on a priority-0 component.
- Context propagation rerenders a priority-0 consumer.
- A synchronous event fires during an async yield-to-browser pause.

### Patch ops save/restore

When preemption occurs:

1. The current priority's **partial patch ops** are saved via `savePatchOps()`.
2. The higher-priority level gets its own `beginPatch()`/`commitPatch()` cycle.
3. After the higher-priority level completes, the saved ops are restored via
   `restorePatchOps(saved)`.

The saved ops are prepended before any new ops collected at the current
priority, preserving DOM operation order:

```
Priority 2 ops (partial):  [A, B]
  → preempt for priority 0
Priority 0 ops:            [X, Y]  → commitPatch() → applied
  → resume priority 2
Priority 2 ops (restored): [A, B, C, D]  → commitPatch() → applied
```

### Recursive preemption

Preemption can nest arbitrarily. If priority-0 work arrives while processing a
priority-1 preemption of priority-2 work, the handler recurses:

```
Processing priority 2
  → preempt for priority 1 (save priority-2 ops)
    → preempt for priority 0 (save priority-1 ops)
      → process priority 0 fully
      → commitPatch() for priority 0
    → restore priority-1 ops, continue priority 1
    → commitPatch() for priority 1
  → restore priority-2 ops, continue priority 2
  → commitPatch() for priority 2
```

---

## Generator abandonment

When `setState` is called **during** a component's render (while the generator
body is executing), yielderact does not complete the current render. Instead:

1. `rerender()` sees `isRendering === true` and sets `pendingRerender = true`.
2. `runHooks` checks `instance.pendingRerender` after each hook descriptor. If
   true, it returns `{ cancelled: true }`.
3. `executeRerender` detects the cancellation, reverts effect deps for any
   effects queued during the cancelled render, and **retries** by looping back
   to create a fresh generator with the accumulated latest state.

This is safe because:

- Generator functions are pure render functions with no external side effects
  during the hook phase.
- Effect callbacks are only flushed **after** a successful commit, not during
  render.
- The fresh generator re-runs all hooks from the top, picking up the new state
  values from `hookStates`.

Multiple `setState` calls during one render are batched — only a single retry
executes with all accumulated state changes applied.

---

## Interaction with UI patches

The scheduler's batched commits (`beginPatch`/`commitPatch`) are separate from
the UI patch system (`startUIPatch`/`commitUIPatch` and `useUIPatch`). They
serve different purposes:

| Mechanism               | Scope              | Purpose                                            |
| :---------------------- | :----------------- | :------------------------------------------------- |
| Scheduler patch queue   | Per priority level | Atomic DOM commit after reconciliation completes   |
| `startUIPatch` (global) | Entire tree        | Freeze DOM during async work (e.g., data fetching) |
| `useUIPatch` (local)    | Component subtree  | Freeze a subtree's DOM during async work           |

When both are active simultaneously, the scheduler's patch queue collects the
DOM ops as usual, but `commitOrDefer` in `mount.ts` additionally checks
`shouldDefer`:

```ts
const shouldDefer =
  (renderState.patchDepth > 0 || instance.localPatchRefCount > 0) && effectiveBatch !== 'live';
```

If `shouldDefer` is true, the VNode is stored as `pendingVNode` instead of
being reconciled into the live DOM. When the UI patch commits (via
`commitUIPatch` or the `commit()` function from `useUIPatch`), all pending
VNodes are flushed.

Components with `$patch="live"` bypass deferral and update immediately
regardless of active patches.

---

## Key source files

| File                        | Responsibility                                             |
| :-------------------------- | :--------------------------------------------------------- |
| `src/render/scheduler.ts`   | Priority queue, work loop, preemption, time slicing        |
| `src/render/patch-queue.ts` | DOM operation collection and atomic commit                 |
| `src/render/mount.ts`       | `commitOrDefer`, `executeRerender`, `rerender` closures    |
| `src/render/state.ts`       | Shared mutable state (`patchDepth`, `liveOnlyMode`, etc.)  |
| `src/context.ts`            | `_priorityCtx`, `_withPriority`, `_getCurrentPriority`     |
| `src/render/helpers.ts`     | `stripDeferred` — removes `$deferred` from component props |
