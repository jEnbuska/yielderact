/**
 * ContextDemo -- exercises multiple context permutations:
 *
 *  1. Two independent contexts (theme + locale) toggled independently.
 *  2. Nested provider override: an inner Provider shadows the outer one.
 *  3. State preservation: changing a context value must NOT reset unrelated
 *     component state in descendant components.
 *  4. Cross-subtree isolation: two sibling Providers for the same context
 *     must not interfere with each other.
 */
import { useState } from "yract-beta";
import { Window, WindowBar, WindowBody } from "../../dos";
import { BothBadge } from "../../components/BothBadge";
import { type Locale, LocaleContext, type Theme, ThemeContext, themeStyles } from "../../contexts";
import { LocaleBadge } from "../../components/LocaleBadge";
import { SiblingProvidersDemo } from "../../components/SiblingProvidersDemo";
import { StatefulConsumer } from "../../components/StatefulConsumer";
import { ThemeBadge } from "../../components/ThemeBadge";

export function* ContextDemo() {
  const [theme, setTheme] = yield* useState<Theme>("light");
  const [locale, setLocale] = yield* useState<Locale>("en");
  console.log("locale", locale);

  return (
    <Window>
      <WindowBar title="Context Scoping" aside="/context" />
      <WindowBody>
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
          <button
            data-testid="toggle-theme-btn"
            onClick={() => setTheme((t) => (t === "light" ? "dark" : "light"))}
          >
            Toggle theme
          </button>
          <button
            data-testid="toggle-locale-btn"
            onClick={() => setLocale((l) => (l === "en" ? "fi" : "en"))}
          >
            Toggle locale
          </button>
        </div>

        {/* Part 1: two independent contexts */}
        <h3>1 - Two independent contexts</h3>
        <p style={{ fontSize: "0.9rem", color: "#555", marginBottom: "0.5rem" }}>
          Theme and Locale are separate contexts. Toggling one must not affect the other.
        </p>
        <ThemeContext value={theme}>
          <LocaleContext value={locale}>
            <div
              data-testid="independent-panel"
              style={{
                padding: "0.75rem",
                borderRadius: "6px",
                ...themeStyles[theme],
                marginBottom: "1rem",
              }}
            >
              Theme: <ThemeBadge data-testid="theme-badge" /> &nbsp; Locale: <LocaleBadge /> &nbsp;
              Both: <BothBadge />
            </div>
          </LocaleContext>
        </ThemeContext>

        {/* Part 2: inner Provider shadows outer */}
        <h3>2 - Nested Provider override</h3>
        <p style={{ fontSize: "0.9rem", color: "#555", marginBottom: "0.5rem" }}>
          The outer theme is <em>{theme}</em>. An inner Provider hard-codes the theme to{" "}
          <em>dark</em>. The inner card must always display <em>dark</em>.
        </p>
        <ThemeContext value={theme}>
          <div data-testid="outer-card" style={{ padding: "0.5rem", ...themeStyles[theme] }}>
            <span>Outer card -- theme: </span>
            <ThemeBadge data-testid="outer-theme-badge" />
            <ThemeContext value="dark">
              <div
                data-testid="inner-card"
                style={{ marginTop: "0.5rem", padding: "0.5rem", ...themeStyles["dark"] }}
              >
                <span>Inner card (always dark) -- theme: </span>
                <ThemeBadge data-testid="inner-theme-badge" />
              </div>
            </ThemeContext>
          </div>
        </ThemeContext>

        {/* Part 3: state preserved across context updates */}
        <h3>3 - State preserved across context updates</h3>
        <p style={{ fontSize: "0.9rem", color: "#555", marginBottom: "0.5rem" }}>
          Increment the counter, then toggle the outer theme. The counter must keep its value.
        </p>
        <ThemeContext value={theme}>
          <StatefulConsumer />
        </ThemeContext>

        {/* Part 4: sibling providers are isolated */}
        <SiblingProvidersDemo />
      </WindowBody>
    </Window>
  );
}
