import { useState } from 'yielderact';

function InfoPanel() {
  return (
    <div
      data-testid="info-panel"
      className="p-3 rounded-md"
      style={{ background: '#f0f4ff', border: '1px solid #c0cff8' }}
    >
      I am a <strong>function component</strong> – I mount and unmount based on the{' '}
      <code>$shown</code> prop.
    </div>
  );
}

function* StatefulCounter() {
  const [count, setCount] = yield* useState(0);

  return (
    <div
      data-testid="stateful-counter"
      className="flex gap-2 items-center p-3 rounded-md"
      style={{ background: '#f0fff4', border: '1px solid #b0e8c0' }}
    >
      <strong>Stateful counter (resets on re-mount):</strong>
      <button data-testid="counter-dec" onClick={() => setCount(count - 1)}>
        −
      </button>
      <span data-testid="counter-val">{count}</span>
      <button data-testid="counter-inc" onClick={() => setCount(count + 1)}>
        +
      </button>
    </div>
  );
}

function ToggleRow({
  label,
  testId,
  checked,
  onChange,
  children,
}: {
  label: string;
  testId: string;
  checked: boolean;
  onChange: () => void;
  children: unknown;
}) {
  return (
    <div className="mb-4">
      <label className="flex items-center gap-2 mb-1">
        <input type="checkbox" data-testid={testId} checked={checked} onChange={onChange} />
        {label}
      </label>
      {children}
    </div>
  );
}

export function* ShownDemo() {
  const [showElement, setShowElement] = yield* useState(true);
  const [showFunction, setShowFunction] = yield* useState(true);
  const [showGenerator, setShowGenerator] = yield* useState(true);

  return (
    <section aria-label="shown prop demo">
      <h2>
        <code>$shown</code> Prop
      </h2>
      <p>
        The <code>$shown</code> prop conditionally mounts and unmounts any element or component.
        Setting it to <code>false</code> fully removes the node (and its state); setting it back
        re-mounts a fresh instance.
      </p>

      <ToggleRow
        label="Show HTML element"
        testId="toggle-element"
        checked={showElement}
        onChange={() => setShowElement(!showElement)}
      >
        <div
          $shown={showElement}
          data-testid="shown-element"
          className="p-3 rounded-md"
          style={{ background: '#fff8e1', border: '1px solid #ffe082' }}
        >
          I am a plain <strong>&lt;div&gt;</strong> element — toggled with the <code>$shown</code>{' '}
          prop.
        </div>
      </ToggleRow>

      <ToggleRow
        label="Show function component"
        testId="toggle-function"
        checked={showFunction}
        onChange={() => setShowFunction(!showFunction)}
      >
        <InfoPanel $shown={showFunction} />
      </ToggleRow>

      <ToggleRow
        label="Show generator component"
        testId="toggle-generator"
        checked={showGenerator}
        onChange={() => setShowGenerator(!showGenerator)}
      >
        <StatefulCounter $shown={showGenerator} />
      </ToggleRow>
    </section>
  );
}
