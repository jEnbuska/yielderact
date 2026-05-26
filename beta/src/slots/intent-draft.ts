import type { Children, Component, Context, DependencyList } from "yract-beta";
import type { ContextSlotType } from "./slot";
import {
  componentSlotType,
  type ComponentSlotType,
  contextSlotType,
  elementSlotType,
  type ElementSlotType,
  fragmentSlotType,
  type FragmentSlotType,
} from "./slot";
import type { DraftBy } from "../general-types";
import type { SlotIntent } from "./slot-intent";
import { getIntentChildren } from "./slot-intent";

type DraftSlotType = ComponentSlotType | ContextSlotType | FragmentSlotType | ElementSlotType;

export type DraftIntent<T extends DraftSlotType = DraftSlotType> = T extends DraftSlotType
  ? DraftBy<SlotIntent<T>, "index" | "key" | "path">
  : never;

export function asFragmentDraft(
  children: Children[],
  key: string | undefined,
): DraftIntent<FragmentSlotType> {
  return {
    children: getIntentChildren(children),
    component: undefined,
    context: undefined,
    deps: undefined,
    element: undefined,
    headNode: undefined,
    index: undefined,
    instance: undefined,
    key,
    move: undefined,
    path: undefined,
    prevProps: undefined,
    prevText: undefined,
    props: undefined,
    slots: undefined,
    tailNode: undefined,
    text: undefined,
    type: fragmentSlotType,
  };
}

export function asContextDraft(
  children: Children,
  key: string | undefined,
  context: Context,
  props: Record<string, unknown>,
): DraftIntent<ContextSlotType> {
  return {
    children: getIntentChildren(children),
    component: context.Provider,
    context,
    deps: undefined,
    element: undefined,
    headNode: undefined,
    index: undefined,
    instance: undefined,
    key,
    move: undefined,
    path: undefined,
    prevProps: undefined,
    prevText: undefined,
    props,
    slots: undefined,
    tailNode: undefined,
    text: undefined,
    type: contextSlotType,
  };
}

export function asElementDraft(
  children: Children,
  key: string | undefined,
  element: string,
  props: Record<string, unknown>,
): DraftIntent<ElementSlotType> {
  return {
    children: getIntentChildren(children),
    component: undefined,
    context: undefined,
    deps: undefined,
    element,
    headNode: undefined,
    index: undefined,
    instance: undefined,
    key,
    move: undefined,
    path: undefined,
    prevProps: undefined,
    prevText: undefined,
    props,
    slots: undefined,
    tailNode: undefined,
    text: undefined,
    type: elementSlotType,
  };
}

export function asComponentDraft(
  children: Children,
  key: string | undefined,
  component: Component,
  props: Record<string, unknown>,
  deps: DependencyList | undefined,
): DraftIntent<ComponentSlotType> {
  return {
    children: getIntentChildren(children),
    component,
    context: undefined,
    deps,
    element: undefined,
    headNode: undefined,
    index: undefined,
    instance: undefined,
    key,
    move: undefined,
    path: undefined,
    prevProps: undefined,
    prevText: undefined,
    props,
    slots: undefined,
    tailNode: undefined,
    text: undefined,
    type: componentSlotType,
  };
}
