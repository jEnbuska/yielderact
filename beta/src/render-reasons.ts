import { $CONTEXT, $STATE } from "./hooks/descriptors";

export const PROPS_REASON = Symbol("$PROPS");
export const MOUNT_REASON = Symbol("$MOUNT");

export function getStateReason() {
  return Symbol($STATE);
}

export function getContextReason() {
  return Symbol($CONTEXT);
}

export function isStateReason(reason: symbol) {
  return reason.description === $STATE;
}

export function isContextReason(reason: symbol) {
  return reason.description === $CONTEXT;
}
