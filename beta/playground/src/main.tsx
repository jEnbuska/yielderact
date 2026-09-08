/**
 * Entry point — mounts the router into `#root`.
 *
 * The shell lives in `App.tsx`, the routes in `router.tsx`.
 */
import { createRoot } from "yract-beta";
import { Router } from "./router";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Missing #root element");
const root = createRoot(rootEl);
root.render(<Router />);
