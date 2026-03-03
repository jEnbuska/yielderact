/**
 * DataFetcher – demonstrates `usePromise` for async data loading.
 *
 * `yield* usePromise(...)` suspends the component rendering and shows a
 * loading placeholder until the promise resolves (or an error placeholder
 * if it rejects).  Once resolved, execution continues and the component
 * returns its final JSX.
 */
import { render, usePromise, useId } from 'yielderact';

interface User {
  id: number;
  name: string;
  email: string;
}

/** Simulates a 1.5 s network request. */
async function fetchUser(): Promise<User> {
  await new Promise((resolve) => setTimeout(resolve, 1500));
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

  const user = yield* usePromise<User>({
    fn: fetchUser,
    loading: <Spinner />,
    error: <ErrorMessage />,
  });

  return (
    <section aria-label="Data fetcher example">
      <h2>Data Fetcher</h2>
      <p>
        <code>yield* usePromise</code> suspends rendering while a promise is pending and
        automatically resumes when it resolves.
      </p>
      <div
        id={userDataId}
        data-testid="user-data"
        style={{
          padding: '0.75rem',
          background: '#f5f5f5',
          borderRadius: '4px',
          fontFamily: 'monospace',
        }}
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

export function mountDataFetcher(container: HTMLElement): void {
  render(<DataFetcher />, container);
}
