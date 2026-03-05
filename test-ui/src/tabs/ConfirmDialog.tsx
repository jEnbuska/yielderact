import { useRender, useResume, useRef, useState } from 'yielderact';
import { Button } from '../components/Button';

type Answer = 'ACCEPTED' | 'REJECTED' | 'NONE';

function* ProceedDialog({ acceptText, rejectText }: { acceptText: string; rejectText: string }) {
  const resume = yield* useResume<Answer>();
  return (
    <div className="flex gap-2">
      <Button variant="primary" onClick={() => resume('ACCEPTED')}>
        {acceptText}
      </Button>
      <Button variant="danger" onClick={() => resume('REJECTED')}>
        {rejectText}
      </Button>
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
        className="ml-2 cursor-pointer"
      >
        Reset
      </button>
    </p>
  );
}

function* Variant2() {
  const answer = yield* useRef<Answer>('NONE');
  const [, rerender] = yield* useState(0);

  while (answer.current === 'NONE') {
    answer.current = yield* useRender<Answer>(
      ({ resume }) => (
        <div className="flex gap-2">
          <Button variant="primary" onClick={() => resume('ACCEPTED')}>
            Accept (inline)
          </Button>
          <Button variant="danger" onClick={() => resume('REJECTED')}>
            Reject (inline)
          </Button>
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
        className="ml-2 cursor-pointer"
      >
        Reset
      </button>
    </p>
  );
}

export function* ConfirmDialog() {
  return (
    <div>
      <h2>useRender / useResume</h2>
      <p className="mb-4" style={{ color: '#555' }}>
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
