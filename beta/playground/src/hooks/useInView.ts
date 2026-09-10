import { useEffect, useRef, useState } from "yract-beta";

export function* useInView<T extends HTMLElement | SVGElement>(options?: IntersectionObserverInit) {
  const ref = yield* useRef<T | undefined>(undefined);
  const [inView, setInView] = yield* useState(false);

  yield* useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(([entry]) => void setInView(entry.isIntersecting), options);
    io.observe(el);
    void setInView(el.checkVisibility());
    return () => io.disconnect();
  }, []);

  return [ref, inView] as const;
}
