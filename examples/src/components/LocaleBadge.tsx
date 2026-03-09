import { $context } from "yielderact";
import { LocaleCtx } from "./ContextDemo.shared";

export function* LocaleBadge() {
  const locale = yield* $context(LocaleCtx);
  return (
    <span data-testid="locale-badge" style={{ padding: "0.2rem 0.5rem", fontSize: "0.85rem" }}>
      {locale}
    </span>
  );
}
