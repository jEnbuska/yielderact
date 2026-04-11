/**
 * EffectDemo – demonstrates `$effect` for side-effects.
 *
 * Beta's `$effect` does NOT accept a returned cleanup function — instead it
 * receives an `AbortSignal` that fires when the effect should tear down
 * (deps change or unmount). Use `signal.addEventListener("abort", ...)` for
 * cleanup, or pass the signal to APIs that already understand it (fetch,
 * AbortController, etc.).
 *
 * Patterns shown:
 *   1. A self-ticking timer that clears its interval via `signal.onabort`.
 *   2. A log of effect / abort calls to make the lifecycle visible.
 *   3. Toggling the component on/off to observe abort on unmount.
 */
import { $effect, $state } from "yract-beta";

function* Timer() {
  const [tick, setTick] = yield* $state(0);

  yield* $effect((signal) => {
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    signal.addEventListener("abort", () => clearInterval(id));
  }, []);

  return (
    <p data-testid="timer">
      Seconds elapsed: <strong>{tick}</strong>
    </p>
  );
}

function* LifecycleLog({ id }: { id: number }) {
  const [log, setLog] = yield* $state<string[]>([]);

  yield* $effect((signal) => {
    setLog((prev) => [...prev, `▶ effect for id=${id}`]);
    signal.addEventListener("abort", () =>
      setLog((prev) => [...prev, `■ aborted for id=${id}`]),
    );
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
  const [showTimer, setShowTimer] = yield* $state(true);
  const [logId, setLogId] = yield* $state(1);

  return (
    <section aria-label="$effect demo">
      <h2>
        <code>$effect</code>
      </h2>

      <h3>1. Interval timer (effect with cleanup)</h3>
      <p>
        The timer starts an <code>setInterval</code> in a <code>$effect</code> with{" "}
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
