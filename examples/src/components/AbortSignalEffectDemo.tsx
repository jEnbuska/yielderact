/**
 * AbortSignalEffectDemo – demonstrates `useEffect` with `AbortSignal` instead
 * of a cleanup function.
 *
 * All three user signals are shown simultaneously. When you select a user,
 * only that user's effect polls; the previous signal is aborted automatically.
 * Each row tracks its own abort count via useState — the signal's abort handler
 * increments it directly.
 * Unmounting the panel aborts all signals.
 */
import { useState, useEffect } from 'yielderact';

function* SignalRow({ userId, activeId }: { userId: number; activeId: number }) {
  const [status, setStatus] = yield* useState<string>('idle');
  const [abortCount, setAbortCount] = yield* useState(0);

  yield* useEffect(
    (signal) => {
      if (activeId !== userId) {
        setStatus('inactive');
        return;
      }
      setStatus('polling');

      let stopped = false;
      const poll = async () => {
        let count = 0;
        while (!stopped && !signal.aborted) {
          count++;
          setStatus(`fetched #${count}`);
          await new Promise<void>((resolve, reject) => {
            const timer = setTimeout(resolve, 400);
            signal.addEventListener(
              'abort',
              () => {
                clearTimeout(timer);
                reject(signal.reason);
              },
              { once: true },
            );
          }).catch(() => {
            /* aborted */
          });
        }
      };

      poll();

      signal.addEventListener(
        'abort',
        () => {
          stopped = true;
          setAbortCount((c) => c + 1);
          setStatus('aborted');
        },
        { once: true },
      );

      // No cleanup function returned — relying entirely on the AbortSignal
    },
    [activeId],
  );

  const isActive = activeId === userId;
  return (
    <tr
      data-testid={`signal-row-${userId}`}
      style={{ background: isActive ? '#e8f5e9' : 'transparent' }}
    >
      <td>
        <strong data-testid={`row-uid-${userId}`}>User {userId}</strong>
      </td>
      <td data-testid={`row-status-${userId}`}>{status}</td>
      <td
        data-testid={`row-abort-count-${userId}`}
        style={{ color: abortCount > 0 ? 'red' : 'green' }}
      >
        {abortCount}
      </td>
    </tr>
  );
}

export function* AbortSignalEffectDemo() {
  const [showPanel, setShowPanel] = yield* useState(true);
  const [activeId, setActiveId] = yield* useState(1);

  return (
    <section aria-label="AbortSignal effect demo" data-testid="abort-signal-demo">
      <h2>
        <code>useEffect</code> with <code>AbortSignal</code>
      </h2>

      <p>
        Each row has a <code>useEffect</code> that receives an <code>AbortSignal</code>. Only the
        active user polls. When you switch users, the previous signal is aborted — no cleanup
        function needed. The abort count tracks how many times each signal has been aborted.
      </p>

      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '0.75rem' }}>
        {[1, 2, 3].map((n) => (
          <button
            key={n}
            data-testid={`user-btn-${n}`}
            onClick={() => setActiveId(n)}
            style={{ fontWeight: activeId === n ? 'bold' : 'normal' }}
          >
            User {n}
          </button>
        ))}
      </div>

      <label
        style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}
      >
        <input
          type="checkbox"
          checked={showPanel}
          onChange={() => setShowPanel((v) => !v)}
          data-testid="toggle-panel"
        />
        Show panel
      </label>

      {showPanel && (
        <table style={{ borderCollapse: 'collapse', width: '100%' }} data-testid="signal-table">
          <thead>
            <tr>
              <th style={{ textAlign: 'left', padding: '0.25rem 0.5rem' }}>User</th>
              <th style={{ textAlign: 'left', padding: '0.25rem 0.5rem' }}>Status</th>
              <th style={{ textAlign: 'left', padding: '0.25rem 0.5rem' }}>Abort count</th>
            </tr>
          </thead>
          <tbody>
            <SignalRow userId={1} activeId={activeId} />
            <SignalRow userId={2} activeId={activeId} />
            <SignalRow userId={3} activeId={activeId} />
          </tbody>
        </table>
      )}
    </section>
  );
}
