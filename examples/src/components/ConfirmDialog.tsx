/**
 * ConfirmDialog – demonstrates the useRender / useResume hooks.
 *
 * Two variants are shown side-by-side:
 *  • Variant 1: JSX passed directly to useRender; the child uses useResume.
 *  • Variant 2: Inline render function receives resume as a prop.
 */
import { useRender, useResume, useRef, useState } from 'yielderact';

// ---------------------------------------------------------------------------
// Variant 1 – child component uses useResume
// ---------------------------------------------------------------------------

type Answer = 'ACCEPTED' | 'REJECTED' | 'NONE';

function* ProceedDialog({ acceptText, rejectText }: { acceptText: string; rejectText: string }) {
  const resume = yield* useResume<Answer>();
  return (
    <div style={{ display: 'flex', gap: '0.5rem' }}>
      <button
        onClick={() => resume('ACCEPTED')}
        style={{
          padding: '0.4rem 1rem',
          background: '#0070f3',
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
      >
        {acceptText}
      </button>
      <button
        onClick={() => resume('REJECTED')}
        style={{
          padding: '0.4rem 1rem',
          background: '#e00',
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
        }}
      >
        {rejectText}
      </button>
    </div>
  );
}

function* Variant1() {
  const answer = yield* useRef<Answer>('NONE');
  const [, rerender] = yield* useState(0);

  while (answer.current === 'NONE') {
    answer.current = yield* useRender<Answer>(
      <ProceedDialog acceptText="Accept" rejectText="Reject" />,
    );
  }

  return (
    <p>
      Variant 1 result: <strong>{answer.current}</strong>{' '}
      <button
        onClick={() => {
          answer.current = 'NONE';
          rerender((n) => n + 1);
        }}
        style={{ marginLeft: '0.5rem', cursor: 'pointer' }}
      >
        Reset
      </button>
    </p>
  );
}

// ---------------------------------------------------------------------------
// Variant 2 – inline render function
// ---------------------------------------------------------------------------

function* Variant2() {
  const answer = yield* useRef<Answer>('NONE');
  const [, rerender] = yield* useState(0);

  while (answer.current === 'NONE') {
    answer.current = yield* useRender<Answer>(
      ({ resume }) => (
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button
            onClick={() => resume('ACCEPTED')}
            style={{
              padding: '0.4rem 1rem',
              background: '#0070f3',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Accept (inline)
          </button>
          <button
            onClick={() => resume('REJECTED')}
            style={{
              padding: '0.4rem 1rem',
              background: '#e00',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
            }}
          >
            Reject (inline)
          </button>
        </div>
      ),
      [],
    );
  }

  return (
    <p>
      Variant 2 result: <strong>{answer.current}</strong>{' '}
      <button
        onClick={() => {
          answer.current = 'NONE';
          rerender((n) => n + 1);
        }}
        style={{ marginLeft: '0.5rem', cursor: 'pointer' }}
      >
        Reset
      </button>
    </p>
  );
}

// ---------------------------------------------------------------------------
// Top-level export
// ---------------------------------------------------------------------------

export function* ConfirmDialog() {
  return (
    <div>
      <h2>useRender / useResume</h2>
      <p style={{ color: '#555', marginBottom: '1rem' }}>
        Generator components can pause and wait for user interaction using <code>useRender</code>.
        The resume callback unblocks the generator and returns the value to the caller.
      </p>

      <h3>
        Variant 1 – child uses <code>useResume</code>
      </h3>
      <Variant1 />

      <h3>Variant 2 – inline render function</h3>
      <Variant2 />
    </div>
  );
}
