import { randomId } from "../general";
import type { Draft } from "./draft";
import type { ComponentSlotType, ContextSlotType, ElementSlotType, FragmentSlotType } from "./slot";
import type { Component } from "yract";

const componentIdMap = new WeakMap<Component<any>>();

export function getComponentSlotKey(draft: Draft<ComponentSlotType>, index: number): string {
  const slotId = componentIdMap.getOrInsertComputed(draft.component, randomId);
  const componentKey = draft._key ?? index;
  return `"${slotId}""${typeof componentKey}"${componentKey}`;
}

export function getElementSlotKey(draft: Draft<ElementSlotType>, index: number) {
  const elementKey = draft._key ?? index;
  return `"${draft.element}${typeof elementKey}${elementKey}"`;
}

const fragmentTypeKey = randomId();

export function getFragmentSlotKey(draft: Draft<FragmentSlotType>, index: number): string {
  const fragmentKey = draft._key ?? index;
  return `"${fragmentTypeKey}${typeof fragmentKey}${fragmentKey}"`;
}

export function getArrayFragmentSlotKey(index: number): string {
  return `"${fragmentTypeKey}number${index}"`;
}

export function getContextSlotKey(draft: Draft<ContextSlotType>, index: number): string {
  const contextKey = draft._key ?? index;
  return `"${draft.context.id}${typeof contextKey}${contextKey}"`;
}

export function getTextSlotKey(index: number): string {
  return `"leaf${index}"`;
}
