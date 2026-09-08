import { useContext } from "yract-beta";
import { LocaleContext } from "../contexts";

export function* LocaleBadge() {
  const locale = yield* useContext(LocaleContext);
  return (
    <span data-testid="locale-badge" style={{ padding: "0.2rem 0.5rem", fontSize: "0.85rem" }}>
      {locale}
    </span>
  );
}
