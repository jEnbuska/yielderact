import { useContext } from "yract";
import { LocaleContext, ThemeContext } from "../contexts";

export function* BothBadge() {
  const theme = yield* useContext(ThemeContext);
  const locale = yield* useContext(LocaleContext);
  return (
    <span data-testid="both-badge">
      {theme}/{locale}
    </span>
  );
}
