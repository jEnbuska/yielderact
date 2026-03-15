/**
 * EffectDemo – demonstrates `useEffect` for side-effects and cleanup.
 *
 * Shows three patterns:
 *   1. A self-ticking timer (interval started in effect, cleared on unmount).
 *   2. A log of effect / cleanup calls to make the lifecycle visible.
 *   3. Toggling the component on/off to observe cleanup on unmount.
 */
import { useEffect, useState } from "yract";

function* Timer() {
  const [tick, setTick] = yield* useState(0);

  yield* useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return (
    <p data-testid="timer">
      Seconds elapsed: <strong>{tick}</strong>
    </p>
  );
}

function* LifecycleLog({ id }: { id: number }) {
  const [log, setLog] = yield* useState<string[]>([]);

  yield* useEffect(() => {
    setLog((prev) => [...prev, `▶ effect for id=${id}`]);
    return () => setLog((prev) => [...prev, `■ cleanup for id=${id}`]);
  }, [id]);

  return (
    <ul data-testid="lifecycle-log" style={{ fontFamily: "monospace", fontSize: "0.85rem" }}>
      {log.map((entry, i) => (
        <li $key={String(i)}>{entry}</li>
      ))}
    </ul>
  );
}

export function* EffectDemo() {
  const [showTimer, setShowTimer] = yield* useState(true);
  const [logId, setLogId] = yield* useState(1);

  return (
    <section aria-label="useEffect demo">
      <h2>
        <code>useEffect</code>
      </h2>

      <h3>1. Interval timer (effect with cleanup)</h3>
      <p>
        The timer starts an <code>setInterval</code> in a <code>useEffect</code> with{" "}
        <code>[]</code> deps. The interval is cleared when the component unmounts.
      </p>
      <label
        style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}
      >
        <input type="checkbox" checked={showTimer} onChange={() => setShowTimer((v) => !v)} />
        Show timer
      </label>
      <Timer $shown={showTimer} />

      <hr style={{ margin: "1.5rem 0" }} />

      <h3>2. Lifecycle log (effect re-runs when deps change)</h3>
      <p>
        Each button changes <code>id</code>. The effect logs ▶ on run and ■ cleanup before the next
        run.
      </p>
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "0.75rem" }}>
        {[1, 2, 3].map((n) => (
          <button
            $key={String(n)}
            data-testid={`id-btn-${n}`}
            onClick={() => setLogId(n)}
            style={{ fontWeight: logId === n ? "bold" : "normal" }}
          >
            id = {n}
          </button>
        ))}
      </div>
      <LifecycleLog id={logId} />
    </section>
  );
}
