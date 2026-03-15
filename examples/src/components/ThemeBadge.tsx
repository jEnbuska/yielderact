import { useContext } from "yract";
import { ThemeCtx, themeStyles } from "./ContextDemo.shared";

export function* ThemeBadge(props: { "data-testid"?: string }) {
  const theme = yield* useContext(ThemeCtx);
  const s = themeStyles[theme];
  return (
    <span
      data-testid={props["data-testid"] ?? "theme-badge"}
      style={{
        padding: "0.2rem 0.5rem",
        borderRadius: "4px",
        fontSize: "0.85rem",
        background: s.background,
        color: s.color,
        border: s.border,
      }}
    >
      {theme}
    </span>
  );
}
