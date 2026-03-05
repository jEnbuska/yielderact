import { useState, useEffect } from 'yielderact';

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
    <ul data-testid="lifecycle-log" className="font-mono text-sm">
      {log.map((entry, i) => (
        <li key={i}>{entry}</li>
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
        The timer starts a <code>setInterval</code> in a <code>useEffect</code> with <code>[]</code>{' '}
        deps. The interval is cleared when the component unmounts.
      </p>
      <label className="flex items-center gap-2 mb-2">
        <input type="checkbox" checked={showTimer} onChange={() => setShowTimer((v) => !v)} />
        Show timer
      </label>
      {showTimer && <Timer />}

      <hr className="my-6" />

      <h3>2. Lifecycle log (effect re-runs when deps change)</h3>
      <p>
        Each button changes <code>id</code>. The effect logs ▶ on run and ■ cleanup before the next
        run.
      </p>
      <div className="flex gap-2 mb-3">
        {[1, 2, 3].map((n) => (
          <button
            key={n}
            data-testid={`id-btn-${n}`}
            onClick={() => setLogId(n)}
            style={{ fontWeight: logId === n ? 'bold' : 'normal' }}
          >
            id = {n}
          </button>
        ))}
      </div>
      <LifecycleLog id={logId} />
    </section>
  );
}
