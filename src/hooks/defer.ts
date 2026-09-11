import type { ComponentGenerator, DraftBy } from "../general-types";
import { useState } from "./state";
import type { Component, PropsWithChildren } from "../jsx";
import { Fragment, jsx } from "../jsx-runtime";
import { useStable } from "./stable";
import type { ContextProperties } from "../context";
import { createContext, resolveContext } from "../context";
import { ComponentFiber } from "../instances/component-fiber";
import { createResolvable } from "../create-resolvable";
import type { ComponentSlotType, Slot } from "../slots/slot";
import type { ContextMap, RenderContext } from "../render/types";
import type { TagNamespace } from "../render/elements/namespaces";
import { MOUNT_REASON } from "../render-reasons";
import { useEffect } from "./effect";
import { useRef } from "./ref";
import { $EFFECT } from "./constants";

export function* useDefer(
  config: {
    disabled?: boolean;
  } = {},
): ComponentGenerator<[Component<PropsWithChildren>, boolean]> {
  const [isDeferring, setDeferring] = yield* useState(false);
  const { disabled } = config;
  return [
    yield* useStable(function* Deferred({ children }: PropsWithChildren) {
      const mounted = yield* useRef(false);
      yield* useEffect(() => {
        mounted.current = true;
      });
      return jsx(Defer, {
        children,
        disabled,
        mounted: mounted.current,
        setDeferring,
      });
    }),
    isDeferring,
  ];
}

const staticId = "defer";

export const DeferContext = createContext<boolean>(false, "Defer");
DeferContext.id = staticId;

type DeferProps = {
  setDeferring: (deferring: boolean) => unknown;
  mounted: boolean;
  disabled?: boolean;
};

class DeferFiber extends ComponentFiber<DeferProps> {
  readonly context: ContextProperties<boolean>;
  private controller: AbortController | undefined;
  private channel = new MessageChannel();

  private async notifyDeferring(deferring: boolean): Promise<void> {
    this.controller?.abort();
    const controller = (this.controller = new AbortController());
    const { promise, resolve } = createResolvable<unknown>();
    const { port1, port2 } = this.channel;
    port1.onmessage = resolve;
    port2.postMessage(null);
    await promise;
    if (controller.signal.aborted) return;
    this.props.setDeferring(deferring);
  }

  constructor(
    intent: DraftBy<Slot<ComponentSlotType>, "instance" | "prevProps">,
    parentCtx: ContextMap,
    parent: ComponentFiber | null,
    rctx: RenderContext,
    parentDom: Node,
    ns: TagNamespace,
  ) {
    const context: ContextProperties<boolean> = {
      name: DeferContext.name,
      Provider: DeferContext.Provider,
      version: 0,
      ref: {
        current: false,
      },
      subscribe: () => {
        return () => {};
      },
      depth: (parent?.depth ?? -1) + 1,
      id: staticId,
    };
    const extended = new Map(parentCtx);

    extended.set(staticId, context as any);
    super(intent, extended, parent, rctx, parentDom, ns);
    this.context = context;
  }

  override render() {
    const deferred = (this.context.ref.current = this.props.disabled ? false : this.isDeferred());
    super.render();
    this.prepareAfterDeferredRender();
    void this.notifyDeferring(deferred);
  }

  private prepareAfterDeferredRender() {
    if (this.hookStates) return;
    this.scheduleEffect(MOUNT_REASON);
    this.hookStates = [
      {
        type: $EFFECT,
        deps: [],
        fn: () => {
          this.context.ref.current = false;
          void this.notifyDeferring(false);
          this.hookStates = undefined;
        },
        identifier: Symbol($EFFECT),
        dirty: true,
      },
    ];
  }

  override isDeferred(): boolean {
    if (this.props.mounted && !this.props.disabled) return true;
    return resolveContext(this.parent?.ctx, DeferContext);
  }
}

export const Defer = Object.assign(
  function* Defer({ children }: PropsWithChildren) {
    return jsx(Fragment, { children });
  },
  { Fiber: DeferFiber },
);
