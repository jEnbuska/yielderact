/**
 * Child type guards and narrowing helpers.
 *
 * Everything the renderer needs to answer "what kind of thing is this
 * Child?" lives here — the reconciler, the slot builders, and tests all
 * go through these helpers rather than re-testing `typeof` or poking at
 * `vnode.type` inline. Keeping the guards in one file means the full
 * Child/VNode taxonomy is visible at a glance.
 */
