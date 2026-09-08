/**
 * App — the playground shell, built from the DOS kit.
 *
 * Chrome only: the demo navigation stacked down the left. Each page under
 * `pages/` frames itself and renders its own breadcrumbs, so the shell does
 * not decide how a demo presents its own content.
 */
import { $id, useContext } from "yract-beta";
import { Screen, Shell, ShellMain, Sidebar, SidebarLink } from "./dos";
import "./dos/styles.css";
import { OutletContext } from "./fake-router/contexts";
import { useNavigationStatus } from "./fake-router/hooks";
import { tabs } from "./constants";
import { useActiveTab } from "./hooks";

export function* App() {
  const mainId = yield* $id();
  const status = yield* useNavigationStatus();
  const outlet = yield* useContext(OutletContext);

  const activeTab = yield* useActiveTab();
  const idle = status === "IDLE";

  return (
    <Screen mainId={mainId}>
      <Shell>
        <Sidebar label="Demos" data-testid="app-tablist">
          {tabs.map((tab) => (
            <SidebarLink
              key={tab.id}
              href={`/${tab.id}`}
              current={activeTab.id === tab.id}
              data-testid={`tab-${tab.id}`}
            >
              {tab.label}
            </SidebarLink>
          ))}
        </Sidebar>

        <ShellMain>
          <div id={mainId} style={{ opacity: idle ? 1 : 0.4 }}>
            <div id="example-panel">{outlet}</div>
          </div>
        </ShellMain>
      </Shell>
    </Screen>
  );
}
