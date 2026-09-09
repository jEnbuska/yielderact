/**
 * HooksShowcase – demonstrates three built-in hooks in one component:
 *
 *  • $id   – connects a <label> to its <input> with a stable unique id.
 *  • $memo – recomputes a filtered list only when the search query changes.
 *  • $ref  – tracks how many times the component has rendered without
 *            triggering a re-render on mutation.
 */
import { $id, useMemo, useRef, useState } from "yract-beta";
import { BreadCrumbs, Crumb, Window, WindowBar, WindowBody } from "../../dos";

const FRUITS = [
  "Apple",
  "Banana",
  "Cherry",
  "Date",
  "Elderberry",
  "Fig",
  "Grape",
  "Honeydew",
  "Kiwi",
  "Lemon",
  "Mango",
  "Nectarine",
];

export function* HooksShowcase() {
  const titleId = yield* $id();
  // $id: stable unique ID used to associate the <label> with the <input>
  const inputId = yield* $id();

  const [query, setQuery] = yield* useState("");

  // $ref: mutable counter that persists across renders without causing them
  const renderCount = yield* useRef(0);
  renderCount.current += 1;

  // $memo: deps are forwarded as arguments to the factory — `searchQuery`
  // receives the current value of `query` and the list only recomputes when
  // the query changes (yract's unique dep-forwarding behaviour).
  const filtered = yield* useMemo(
    (searchQuery: string) =>
      FRUITS.filter((fruit) => fruit.toLowerCase().includes(searchQuery.toLowerCase())),
    [query],
  );

  return (
    <>
      <BreadCrumbs label="Location" hint="/hooks">
        <Crumb>yract-beta</Crumb>
        <Crumb>Hooks Showcase</Crumb>
      </BreadCrumbs>
      <Window labelledBy={titleId}>
        <WindowBar title="Hooks Showcase" titleId={titleId} aside="/hooks" />
        <WindowBody>
          <p>
            Demonstrates <code>$id</code>, <code>$memo</code>, and <code>$ref</code> together in one
            component.
          </p>

          {/* $id: the generated id wires the <label> to the <input> */}
          <div style={{ marginBottom: "0.75rem" }}>
            <label
              data-testid="hooks-search-label"
              htmlFor={inputId}
              style={{ marginRight: "0.5rem" }}
            >
              Search fruits:
            </label>
            <input
              id={inputId}
              data-testid="hooks-search-input"
              type="text"
              value={query}
              placeholder="Type to filter…"
              onInput={(e) => setQuery(e.currentTarget?.value ?? "")}
            />
          </div>

          {/* $memo: filtered list, only recomputed when query changes */}
          <ul
            data-testid="hooks-fruit-list"
            style={{ listStyle: "disc", paddingLeft: "1.25rem", margin: "0 0 0.5rem" }}
          >
            {filtered.map((fruit) => (
              <li key={fruit} data-testid={`fruit-${fruit.toLowerCase()}`}>
                {fruit}
              </li>
            ))}
          </ul>
          {filtered.length === 0 && (
            <p data-testid="hooks-no-results" style={{ color: "#888" }}>
              No fruits match "{query}".
            </p>
          )}

          {/* $ref: render count is tracked without triggering a re-render */}
          <p
            data-testid="hooks-render-count"
            style={{ marginTop: "0.75rem", color: "#666", fontSize: "0.85rem" }}
          >
            Component has rendered {renderCount.current} time(s) — tracked with <code>$ref</code>{" "}
            (mutations do not cause a re-render).
          </p>
        </WindowBody>
      </Window>
    </>
  );
}
