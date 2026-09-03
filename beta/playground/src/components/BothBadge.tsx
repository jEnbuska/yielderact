import { useContext } from "yract-beta";
import { LocaleContext, ThemeContext } from "./ContextDemo.shared";

export function* BothBadge() {
  const theme = yield* useContext(ThemeContext);
  const locale = yield* useContext(LocaleContext);
  console.log("LOCALE RESOLVED", locale);
  return (
    <span data-testid="both-badge">
      {theme}/{locale}
    </span>
  );
}
