/**
 * Entry point — mounts the playground into `#root`.
 *
 * The shell lives in `App.tsx`, which stacks every demo on one page.
 */
import { createRoot } from "yract-beta";
import { App } from "./App";

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Missing #root element");
const root = createRoot(rootEl);
root.render(<App />);
if (window.location.hash) document.getElementById(window.location.hash)?.scrollIntoView();
