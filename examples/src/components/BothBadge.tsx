import { useContext } from "yract";
import { LocaleCtx, ThemeCtx } from "./ContextDemo.shared";

export function* BothBadge() {
  const theme = yield* useContext(ThemeCtx);
  const locale = yield* useContext(LocaleCtx);
  return (
    <span data-testid="both-badge">
      {theme}/{locale}
    </span>
  );
}
