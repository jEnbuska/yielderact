import { useEffect, useState } from "yract";
import { useWeakRef } from "../../../src/hooks/weakRef";

export function* useInView<T extends HTMLElement | SVGElement>(options?: IntersectionObserverInit) {
  const ref = yield* useWeakRef<T>();
  const [inView, setInView] = yield* useState(false);

  yield* useEffect(() => {
    const el = ref.current.deref();
    if (!el) return undefined;
    const io = new IntersectionObserver(([entry]) => void setInView(entry.isIntersecting), options);
    io.observe(el);
    void setInView(el.checkVisibility());
    return () => io.disconnect();
  }, []);

  return [ref, inView] as const;
}
