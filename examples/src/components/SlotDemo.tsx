/**
 * SlotDemo -- demonstrates the Slot API (`createSlot`, `useSlotContent`,
 * `Slot.Fill`) for projecting content into named slots of a layout component.
 *
 * Two scenarios are shown:
 *  1. A PageLayout with Header and Footer slots.
 *  2. Dynamic updates -- a button changes the header content at runtime.
 */
import { type Child, createSlot, useSlotContent, useState } from "yract";

/* ── Slot definitions ── */

const HeaderSlot = createSlot();
const FooterSlot = createSlot();

/* ── Layout component that consumes both slots ── */

function* PageLayout(props: { children?: Child[] }) {
  const headerContent = yield* useSlotContent(HeaderSlot);
  const footerContent = yield* useSlotContent(FooterSlot);

  return (
    <div
      data-testid="slot-layout"
      style={{
        border: "2px solid #ccc",
        borderRadius: "6px",
        overflow: "hidden",
      }}
    >
      {/* Header area */}
      <header
        data-testid="slot-header"
        style={{
          padding: "0.75rem 1rem",
          background: "#0070f3",
          color: "#fff",
          fontWeight: "bold",
        }}
      >
        {headerContent ?? <em>No header provided</em>}
      </header>

      {/* Main content area */}
      <main data-testid="slot-main" style={{ padding: "1rem" }}>
        {props.children}
      </main>

      {/* Footer area */}
      <footer
        data-testid="slot-footer"
        style={{
          padding: "0.75rem 1rem",
          background: "#f5f5f5",
          borderTop: "1px solid #ddd",
          color: "#666",
          fontSize: "0.85rem",
        }}
      >
        {footerContent ?? <em>No footer provided</em>}
      </footer>
    </div>
  );
}

/* ── Fill-as-component for the header ── */

function* HeaderFill(props: { label: string }) {
  return (
    <HeaderSlot.Fill>
      <span data-testid="slot-header-content">{props.label}</span>
    </HeaderSlot.Fill>
  );
}

/* ── Root demo component ── */

export function* SlotDemo() {
  const [headerText, setHeaderText] = yield* useState("Welcome to the Slot API");
  const [clickCount, setClickCount] = yield* useState(0);

  const handleUpdateHeader = () => {
    const next = clickCount + 1;
    setClickCount(next);
    setHeaderText(`Header updated ${next} time${next === 1 ? "" : "s"}`);
  };

  return (
    <section aria-label="Slot API demo">
      <h2>Slot API</h2>
      <p>
        Slots let a layout component define named content areas (Header, Footer) that consumers fill
        from the outside. The layout reads slot content via <code>useSlotContent</code> and renders
        it in the right place.
      </p>

      <div style={{ marginBottom: "1rem" }}>
        <button data-testid="slot-update-header" onClick={handleUpdateHeader}>
          Update Header
        </button>
        <span data-testid="slot-click-count" style={{ marginLeft: "0.5rem", color: "#666" }}>
          Clicked: {clickCount}
        </span>
      </div>

      <HeaderSlot.Provider>
        <FooterSlot.Provider>
          {/* Fill-as-component for header */}
          <HeaderFill label={headerText} />

          {/* Literal Fill for footer */}
          <FooterSlot.Fill>
            <span data-testid="slot-footer-content">Built with yract</span>
          </FooterSlot.Fill>

          {/* The layout consumes both slots */}
          <PageLayout>
            <p data-testid="slot-body-content">
              This is the main body content passed as regular children.
            </p>
          </PageLayout>
        </FooterSlot.Provider>
      </HeaderSlot.Provider>
    </section>
  );
}
