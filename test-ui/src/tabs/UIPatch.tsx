import { useState, useRef, useEffect, useUIPatch, startUIPatch, commitUIPatch } from 'yielderact';
import { Badge } from '../components/Badge';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { CodeLog } from '../components/CodeLog';

type Page = 'home' | 'about' | 'contact';
type PatchMode = 'global' | 'local';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Clocks — demonstrate $patch="default" vs $patch="live"
// ---------------------------------------------------------------------------

function* LiveClock({ tick }: { tick: number }) {
  return <b>{new Date(tick).toLocaleTimeString('en-US')}</b>;
}

function* Clocks() {
  const [tick, setTick] = yield* useState(Date.now());
  yield* useEffect(() => {
    const id = setInterval(() => setTick(() => Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const seconds = new Date().getSeconds();
  return (
    <div className="grid grid-cols-3 gap-4 mb-4">
      <div $patch="default" data-testid="clock-default">
        default: <LiveClock tick={tick} />
      </div>
      <div $patch="live" data-testid="clock-live">
        live: <LiveClock tick={tick} />
      </div>
      <div $patch={seconds % 3 === 0 ? 'live' : 'default'} data-testid="clock-alternating">
        alternating: <LiveClock tick={tick} />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Navigation demo — uses either global or local patch based on mode prop
// ---------------------------------------------------------------------------

function* NavigationDemo({ mode }: { mode: PatchMode }) {
  const startLocalPatch = yield* useUIPatch();
  const [page, setPage] = yield* useState<Page>('home');
  const [isPending, setIsPending] = yield* useState(false);
  const [log, setLog] = yield* useState<string[]>([]);

  const navigate = async (next: Page) => {
    setIsPending(true);
    const commit = mode === 'global' ? (startUIPatch(), commitUIPatch) : startLocalPatch();
    try {
      setLog((prev) => [...prev, `navigating to ${next}…`]);
      await sleep(5000);
      setPage(next);
      setLog((prev) => [...prev, `arrived at ${next}`]);
    } finally {
      setIsPending(false);
      commit();
    }
  };

  return (
    <Card>
      <h4 className="mt-0 font-semibold">Navigation ({mode} patch)</h4>
      <Clocks />
      <nav className="flex gap-2 mb-4">
        {(['home', 'about', 'contact'] as Page[]).map((p) => (
          <button
            key={p}
            onClick={() => navigate(p)}
            disabled={isPending}
            className="px-3 py-1 border rounded text-sm"
            style={{
              background: page === p ? '#0070f3' : '#fff',
              color: page === p ? '#fff' : '#333',
              cursor: isPending ? 'wait' : 'pointer',
            }}
          >
            {isPending && page !== p ? '…' : p}
          </button>
        ))}
      </nav>
      <div className="p-3 bg-gray-100 rounded min-h-20">
        {page === 'home' && <p>🏠 Home</p>}
        {page === 'about' && <p>ℹ️ About</p>}
        {page === 'contact' && <p>📬 Contact</p>}
      </div>
      <CodeLog $shown={!!log.length} lines={log} />
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Visibility demo — used by Playwright tests
// ---------------------------------------------------------------------------

function* VisibilityTarget({ id }: { id: string }) {
  return <Badge testId={id}>visible</Badge>;
}

function* VisibilityDemo({ mode }: { mode: PatchMode }) {
  const startLocalPatch = yield* useUIPatch();
  const commitRef = yield* useRef<(() => void) | null>(null);
  const [showDefault, setShowDefault] = yield* useState(true);
  const [showLive, setShowLive] = yield* useState(true);

  const prefix = mode === 'global' ? 'gv' : 'lv';

  const startPatch = () => {
    if (mode === 'global') startUIPatch();
    else {
      if (!commitRef.current) commitRef.current = startLocalPatch();
    }
  };

  const endPatch = () => {
    if (mode === 'global') commitUIPatch();
    else {
      const fn = commitRef.current;
      commitRef.current = null;
      fn?.();
    }
  };

  return (
    <Card testId={`${prefix}-visibility-demo`}>
      <h4 className="mt-0 font-semibold">Visibility ({mode} patch)</h4>
      <div className="flex gap-2 flex-wrap mb-3">
        <Button testId={`${prefix}-start-patch`} onClick={startPatch}>
          Start patch
        </Button>
        <Button testId={`${prefix}-commit-patch`} onClick={endPatch}>
          Commit patch
        </Button>
        <Button testId={`${prefix}-toggle-default`} onClick={() => setShowDefault((v) => !v)}>
          Toggle default
        </Button>
        <Button testId={`${prefix}-toggle-live`} onClick={() => setShowLive((v) => !v)}>
          Toggle live
        </Button>
      </div>
      <div className="flex gap-4 min-h-8 items-center">
        <span>
          default:{' '}
          <VisibilityTarget $shown={showDefault} $patch="default" id={`${prefix}-target-default`} />
        </span>
        <span>
          live: <VisibilityTarget $shown={showLive} $patch="live" id={`${prefix}-target-live`} />
        </span>
      </div>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Mode toggle
// ---------------------------------------------------------------------------

function ModeToggle({ mode, setMode }: { mode: PatchMode; setMode: (m: PatchMode) => void }) {
  return (
    <div className="flex gap-2 mb-4 items-center">
      <span className="text-sm font-medium">Patch mode:</span>
      {(['global', 'local'] as PatchMode[]).map((m) => (
        <button
          key={m}
          data-testid={`patch-mode-${m}`}
          onClick={() => setMode(m)}
          className="px-3 py-1 border rounded text-sm"
          style={{
            background: mode === m ? '#0070f3' : '#fff',
            color: mode === m ? '#fff' : '#333',
          }}
        >
          {m}
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Root export
// ---------------------------------------------------------------------------

export function* UIPatch() {
  const [mode, setMode] = yield* useState<PatchMode>('global');

  return (
    <div>
      <h2>UI Patch</h2>
      <p>
        <strong>UI patches</strong> freeze DOM updates while async work runs, then apply all changes
        atomically. Mark a subtree <code>$patch="live"</code> to keep it updating.
      </p>
      <ModeToggle mode={mode} setMode={setMode} />
      <div className="flex flex-col gap-6">
        <NavigationDemo mode={mode} />
        <VisibilityDemo mode={mode} />
      </div>
    </div>
  );
}
