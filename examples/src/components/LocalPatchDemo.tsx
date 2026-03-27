import { useState, useUIPatch } from "yract";
import type { Page } from "../types";
import { sleep } from "../utils";
import { Clocks } from "./Clocks";
import { Navigation } from "./Navigation";
import { AboutPage, ContactPage, HomePage } from "./PageStubs";

export function* LocalPatchDemo() {
  const startPatch = yield* useUIPatch();
  const [page, setPage] = yield* useState<Page>("home");
  const [isPending, setIsPending] = yield* useState(false);
  const [log, setLog] = yield* useState<string[]>([]);

  const navigate = async (next: Page) => {
    void setIsPending(true);
    const commit = startPatch();
    try {
      void setLog((prev) => [...prev, `[local] navigating to ${next}...`]);
      await sleep(5000);
      void setPage(next);
      void setLog((prev) => [...prev, `[local] arrived at ${next}`]);
    } finally {
      void setIsPending(false);
      commit();
    }
  };

  return (
    <div
      data-testid="local-patch-demo"
      style={{ border: "1px solid #ddd", borderRadius: "6px", padding: "1rem" }}
    >
      <h4 data-testid="local-patch-heading" style={{ marginTop: 0 }}>
        Local patch -- only this subtree frozen
      </h4>
      <p style={{ color: "#555", fontSize: "0.9rem" }}>
        During navigation only <strong>this component's subtree</strong> is frozen. The live clock
        marked <code>$patch="live"</code> continues to tick -- click it while navigating.
      </p>

      <Navigation page={page} isPending={isPending} navigate={navigate} scope="local" />
      <Clocks />
      <div
        style={{
          padding: "0.75rem",
          background: "#f5f5f5",
          borderRadius: "4px",
          minHeight: "80px",
        }}
      >
        <HomePage $shown={page === "home"} />
        <AboutPage $shown={page === "about"} />
        <ContactPage $shown={page === "contact"} />
      </div>

      <pre
        data-testid="local-patch-log"
        $shown={!!log.length}
        style={{
          marginTop: "0.75rem",
          fontSize: "0.78rem",
          background: "#1a1a1a",
          color: "#cfc",
          padding: "0.5rem",
          borderRadius: "4px",
          overflowX: "auto",
        }}
      >
        {log.join("\n")}
      </pre>
    </div>
  );
}
