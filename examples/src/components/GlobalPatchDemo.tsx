import { commitUIPatch, startUIPatch, useState } from "yract";
import type { Page } from "../types";
import { sleep } from "../utils";
import { Clocks } from "./Clocks";
import { Navigation } from "./Navigation";
import { AboutPage, ContactPage, HomePage } from "./PageStubs";

export function* GlobalPatchDemo() {
  const [page, setPage] = yield* useState<Page>("home");
  const [isPending, setIsPending] = yield* useState(false);
  const [log, setLog] = yield* useState<string[]>([]);

  const navigate = async (next: Page) => {
    void setIsPending(true);
    startUIPatch();
    try {
      void setLog((prev) => [...prev, `[global] navigating to ${next}...`]);
      await sleep(5000);
      void setPage(next);
      void setLog((prev) => [...prev, `[global] arrived at ${next}`]);
    } finally {
      void setIsPending(false);
      commitUIPatch();
    }
  };

  return (
    <div
      data-testid="global-patch-demo"
      style={{ border: "1px solid #ddd", borderRadius: "6px", padding: "1rem" }}
    >
      <h4 data-testid="global-patch-heading" style={{ marginTop: 0 }}>
        Global patch -- entire tree frozen
      </h4>
      <p style={{ color: "#555", fontSize: "0.9rem" }}>
        During navigation the <strong>entire page area</strong> is frozen (including the clock
        below). State changes are computed but DOM stays unchanged until commit.
      </p>

      <Clocks />

      <Navigation page={page} isPending={isPending} navigate={navigate} scope="global" />

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
        data-testid="global-patch-log"
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
