import { Child, createContext } from "yract-beta";
import { PreparedRoute } from "./PreparedRoute";

export type RouteContextValue<TSearch> = {
  hash: string;
  match: string;
  search: TSearch;
  pathname: string;
  navigate: (href: string) => Promise<void>;
  onNavigating: (route: PreparedRoute) => () => void;
};

export const RouteContext = createContext<RouteContextValue<any>>(() => {
  throw new Error("RouteContext not provided");
}, "Route");

export const OutletContext = createContext<Child>(null);

export type PreloadingStatus = "IDLE" | "UPDATING" | "UNMOUNTING";
export type PreloadingContextType = {
  getState(): PreloadingStatus;
  subscribe(_cb: () => void): () => void;
};
export const NavigationStatusContext = createContext<PreloadingContextType>(
  {
    getState(): PreloadingStatus {
      return "IDLE";
    },
    subscribe(_cb: () => void): () => void {
      return () => {};
    },
  },
  "Preloading",
);
