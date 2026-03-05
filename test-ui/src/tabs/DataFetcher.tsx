import { useResolve, useId } from 'yielderact';

interface User {
  id: number;
  name: string;
  email: string;
}

async function fetchUser(signal: AbortSignal): Promise<User> {
  await new Promise((resolve, reject) => {
    const t = setTimeout(resolve, 1500);
    signal.addEventListener('abort', () => {
      clearTimeout(t);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });
  return { id: 1, name: 'Jane Doe', email: 'jane@example.com' };
}

function* Spinner() {
  const id = yield* useId();
  return (
    <p id={id} data-testid="loading-message" style={{ color: '#888', fontStyle: 'italic' }}>
      Loading user data…
    </p>
  );
}

function* ErrorMessage() {
  const id = yield* useId();
  return (
    <p id={id} data-testid="error-message" style={{ color: '#c00' }}>
      Failed to load data. Please try again.
    </p>
  );
}

export function* DataFetcher() {
  const userDataId = yield* useId();

  const user = yield* useResolve<User>(
    { fn: fetchUser, loading: <Spinner />, error: <ErrorMessage /> },
    [],
  );

  return (
    <section aria-label="Data fetcher example">
      <h2>Data Fetcher</h2>
      <p>
        <code>yield* useResolve</code> suspends rendering while a promise is pending and
        automatically resumes when it resolves.
      </p>
      <div
        id={userDataId}
        data-testid="user-data"
        className="p-3 rounded font-mono"
        style={{ background: '#f5f5f5' }}
      >
        <div>
          <strong>Name:</strong> {user.name}
        </div>
        <div>
          <strong>Email:</strong> {user.email}
        </div>
      </div>
    </section>
  );
}
