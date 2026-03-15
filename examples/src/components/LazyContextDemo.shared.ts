import { createContext } from "yract";

export type AppState = {
  user: { name: string; role: string };
  count: number;
};

export const AppCtx = createContext<AppState>({
  user: { name: "Alice", role: "admin" },
  count: 0,
});
