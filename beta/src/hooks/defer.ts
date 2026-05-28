import type { ComponentGenerator, DraftBy } from "../general-types";
import { $state } from "./state";
import type { Children, Component } from "../jsx";
import { Fragment, jsx } from "../jsx-runtime";
import { $stable } from "./stable";
import type { ContextProperties } from "../context";
import { createContext, resolveContext } from "../context";
import { ComponentFiber } from "../instances/component-fiber";
import { createResolvable } from "../create-resolvable";
import type { ComponentSlotType, Slot } from "../slots/slot";
import type { ContextMap, RenderContext } from "../render/types";
import type { TagNamespace } from "../render/elements/namespaces";
import { MOUNT_REASON } from "../render-reasons";
import { $EFFECT } from "./descriptors";

export function* $defer(): ComponentGenerator<[Component<{ children: Children }>, boolean]> {
  const [isDeferring, setDeferring] = yield* $state(false);
  return [
    yield* $stable(function* Deferred({ children }) {
      return jsx(Defer, {
        children,
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
      ref: { current: resolveContext(parentCtx, DeferContext) },
      subscribe: () => {
        return () => {};
      },
      depth: (parent?.depth ?? -1) + 1,
      id: staticId,
      Provider: DeferContext.Provider,
    };
    const extended = new Map(parentCtx);

    extended.set(staticId, context as any);
    super(intent, extended, parent, rctx, parentDom, ns);
    this.context = context;
  }

  override render() {
    const deferred = (this.context.ref.current = this.isDeferred());
    super.render();

    if (deferred) {
      // Set not-deferred to children state update's after render
      this.prepareAfterMountedRender();
      void this.notifyDeferring(deferred);
    }
  }

  prepareAfterMountedRender() {
    if (this.hookStates) return;
    this.scheduleEffect(MOUNT_REASON);
    this.hookStates = [
      {
        type: $EFFECT,
        deps: [],
        fn: () => {
          this.mounted = true;
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
    if (this.mounted) return true;
    return resolveContext(this.parent?.ctx, DeferContext);
  }
}

export const Defer = Object.assign(
  function* Defer({ children }: { children: Children }) {
    return jsx(Fragment, { children });
  },
  { Fiber: DeferFiber },
);
