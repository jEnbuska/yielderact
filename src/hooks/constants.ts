export const $STATE = "$STATE" as const;
export const $REF = "$REF" as const;
export const $WEAK_REF = "$WEAK_REF" as const;
export const $ID = "$ID" as const;
export const $MEMO = "$MEMO" as const;
export const $STABLE = "$STABLE" as const;
export const $EFFECT = "$EFFECT" as const;
export const $CONTEXT = "$CONTEXT" as const;
export const $LOAD = "$LOAD" as const;
export const $$RENDER = "$$RENDER" as const;
export const $$HALT = "$$HALT" as const;
export const $$HALTED = "$$HALTED" as const;
export const $$FORCE_UPDATE = "$$FORCE_UPDATE" as const;
export const hookTypes = [
  $STATE,
  $REF,
  $ID,
  $MEMO,
  $STABLE,
  $EFFECT,
  $CONTEXT,
  $WEAK_REF,
  $$RENDER,
  $$HALT,
  $$HALTED,
  $LOAD,
  $$FORCE_UPDATE,
] as const;
