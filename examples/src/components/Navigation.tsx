// TODO: Restore when $patch is re-implemented (#163)
/*
import type { Page } from "../types";

export function* Navigation({
  page,
  isPending,
  navigate,
  scope,
}: {
  page: Page;
  isPending: boolean;
  navigate: (page: Page) => void;
  scope: string;
}) {
  return (
    <nav
      data-testid={`${scope}-nav`}
      style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}
    >
      {(["home", "about", "contact"] satisfies Page[]).map((p) => (
        <button
          key={p}
          data-testid={`${scope}-nav-${p}`}
          onClick={() => navigate(p)}
          disabled={isPending}
          style={{
            padding: "0.3rem 0.7rem",
            background: page === p ? "#0070f3" : "#fff",
            color: page === p ? "#fff" : "#333",
            border: "1px solid #ccc",
            borderRadius: "4px",
            cursor: isPending ? "wait" : "pointer",
          }}
        >
          {isPending && page !== p ? "..." : p}
        </button>
      ))}
    </nav>
  );
}
*/
