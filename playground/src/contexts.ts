import { createContext } from "yract";

export type Theme = "light" | "dark";
export type Locale = "en" | "fi";

export const ThemeContext = createContext<Theme>("light", "Theme");
export const LocaleContext = createContext<Locale>("en", "Locale");

export const themeStyles: Record<Theme, { background: string; color: string; border: string }> = {
  light: { background: "#f9f9f9", color: "#111", border: "1px solid #ccc" },
  dark: { background: "#222", color: "#eee", border: "1px solid #555" },
};

export type AppState = {
  user: { name: string; role: string };
  count: number;
};

export const AppCtx = createContext<AppState>({
  user: { name: "Alice", role: "admin" },
  count: 0,
});
