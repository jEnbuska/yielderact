import { type Context, createContext, useContext } from "./context";
import { $USE_SLOT_CONTENT, type SlotContentDescriptor } from "./hooks/descriptors";
import type { ComponentGenerator } from "./hooks/types";
import { useEffect } from "./hooks/useEffect";
import { useRef } from "./hooks/useRef";
import { useState } from "./hooks/useState";
import { type Child, type Component, createElement, Fragment, type InternalProps } from "./jsx";

/** @internal */
export interface SlotRegistry {
  content: Child | null;
  waitingRerenders: Array<() => void>;
  setContent: (content: Child | null) => void;
}

export interface Slot extends Context<Child | null> {
  readonly Provider: Component<InternalProps & { children?: Child[] }>;
  readonly Fill: Component<InternalProps & { children?: Child[] }>;
}

/** @internal */
export interface UseSlotContentResult {
  content: Child | null;
}

interface SlotInternals {
  registryCtx: Context<SlotRegistry | null>;
}

const slotInternals = new WeakMap<Slot, SlotInternals>();

export function createSlot(): Slot {
  const contentCtx = createContext<Child | null>(null);
  const registryCtx = createContext<SlotRegistry | null>(null);

  // Save original context Provider functions BEFORE we overwrite slot.Provider
  const ContentProvider = contentCtx.Provider;
  const RegistryProvider = registryCtx.Provider;

  function* SlotProvider(props: InternalProps) {
    const [content, setContent] = yield* useState<Child | null>(null);
    const registryRef = yield* useRef<SlotRegistry | null>(null);

    if (registryRef.current === null) {
      registryRef.current = {
        content: null,
        waitingRerenders: [],
        setContent,
      };
    }
    registryRef.current.setContent = setContent;

    const children = (props.children ?? []) as Child[];
    let literalContent: Child | null = null;
    const passthrough: Child[] = [];

    for (const child of children) {
      if (isSlotFillVNode(child, slot)) {
        literalContent =
          child.children.length === 1
            ? (child.children[0] as Child)
            : createElement(Fragment, null, ...child.children);
      } else {
        passthrough.push(child);
      }
    }

    const effectiveContent = literalContent ?? content;

    if (literalContent !== null) {
      registryRef.current.content = literalContent;
    }

    return createElement(
      RegistryProvider as Component<InternalProps>,
      { value: registryRef.current },
      createElement(
        ContentProvider as Component<InternalProps>,
        { value: effectiveContent },
        ...passthrough,
      ),
    );
  }

  function* SlotFill(props: InternalProps) {
    const registry = yield* useContext(registryCtx);
    if (registry === null) {
      throw new Error("Slot.Fill must be used inside a Slot.Provider");
    }

    const children = (props.children ?? []) as Child[];
    const fillContent: Child =
      children.length === 1 ? (children[0] as Child) : createElement(Fragment, null, ...children);

    registry.content = fillContent;

    yield* useEffect(() => {
      // Use queueMicrotask to avoid synchronous re-entry during initial mount.
      // The scheduler cannot safely rerender an ancestor component while the
      // initial buildNode tree is still being assembled.
      queueMicrotask(() => {
        registry.setContent(fillContent);
      });
      return undefined;
    }, [fillContent]);

    return null;
  }

  (SlotFill as unknown as Record<string, unknown>)["__slotFillFor"] = null;

  const slot = contentCtx as unknown as Slot;
  Object.defineProperty(slot, "Provider", {
    value: SlotProvider as unknown as Component<InternalProps & { children?: Child[] }>,
    enumerable: true,
    configurable: false,
    writable: false,
  });
  Object.defineProperty(slot, "Fill", {
    value: SlotFill as unknown as Component<InternalProps & { children?: Child[] }>,
    enumerable: true,
    configurable: false,
    writable: false,
  });

  (SlotFill as unknown as Record<string, unknown>)["__slotFillFor"] = slot;

  slotInternals.set(slot, { registryCtx });

  return slot;
}

export function* useSlotContent(slot: Slot): ComponentGenerator<Child> {
  const internals = slotInternals.get(slot);
  if (!internals) {
    throw new Error("useSlotContent: invalid slot — must be created by createSlot()");
  }

  yield* useContext(slot);

  const descriptor: SlotContentDescriptor = {
    type: $USE_SLOT_CONTENT,
    registryCtx: internals.registryCtx as Context<unknown>,
    contentCtx: slot as Context<unknown>,
  };
  const result = yield descriptor;
  return (result as UseSlotContentResult).content;
}

function isSlotFillVNode(child: Child, _slot: Slot): child is import("./jsx").VNode {
  if (child == null || typeof child !== "object" || typeof child === "boolean") return false;
  if (!("type" in child)) return false;
  const vnode = child as import("./jsx").VNode;
  return (
    typeof vnode.type === "function" &&
    (vnode.type as unknown as Record<string, unknown>)["__slotFillFor"] === _slot
  );
}
