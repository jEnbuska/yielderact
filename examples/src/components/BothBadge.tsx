import { $context } from "yielderact";
import { LocaleCtx, ThemeCtx } from "./ContextDemo.shared";

export function* BothBadge() {
  const theme = yield* $context(ThemeCtx);
  const locale = yield* $context(LocaleCtx);
  return (
    <span data-testid="both-badge">
      {theme}/{locale}
    </span>
  );
}
