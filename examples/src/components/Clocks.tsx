import { useEffect, useState } from "yract";
import { LiveClock } from "./LiveClock";

export function* Clocks() {
  const [tick, setTick] = yield* useState(Date.now());
  yield* useEffect(() => {
    const interval = setInterval(() => {
      setTick(() => Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);
  const seconds = new Date().getSeconds();
  return (
    <div className={"grid gap-4 grid-cols-3"}>
      <div style={{ marginBottom: "0.75rem" }} $patch="default" data-testid="clock-default">
        Clock (<code>$patch="default"</code>): <LiveClock tick={tick} />
      </div>
      <div style={{ marginBottom: "0.75rem" }} $patch="live" data-testid="clock-live">
        Clock (<code>$patch="live"</code>, always live): <LiveClock tick={tick} />
      </div>
      <div
        style={{ marginBottom: "0.75rem" }}
        $patch={seconds % 3 === 0 ? "live" : "default"}
        data-testid="clock-alternating"
      >
        Clock (<code>$patch={`{seconds % 3 === 0 ? 'live' : 'default'}`}'</code>:{" "}
        <LiveClock tick={tick} />
      </div>
    </div>
  );
}
