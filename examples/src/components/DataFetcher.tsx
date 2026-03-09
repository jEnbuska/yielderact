/**
 * DataFetcher – demonstrates `$resolve` for async data loading.
 *
 * `yield* $resolve(...)` suspends the component rendering and shows a
 * loading placeholder until the promise resolves (or an error placeholder
 * if it rejects).  Once resolved, execution continues and the component
 * returns its final JSX.
 */
import { $id, $memo, $resolve, $resolveRaw, $state, render } from "yielderact";

interface User {
  id: number;
  name: string;
  email: string;
}

/** Simulates a 1.5 s network request. Respects the provided AbortSignal. */
async function fetchUser(signal: AbortSignal): Promise<User> {
  await new Promise((resolve, reject) => {
    const t = setTimeout(resolve, 1500);
    signal.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new DOMException("Aborted", "AbortError"));
    });
  });
  return { id: 1, name: "Jane Doe", email: "jane@example.com" };
}

function* Spinner() {
  const id = yield* $id();
  return (
    <p id={id} data-testid="loading-message" style={{ color: "#888", fontStyle: "italic" }}>
      Loading user data…
    </p>
  );
}

function* ErrorMessage() {
  const id = yield* $id();
  return (
    <p id={id} data-testid="error-message" style={{ color: "#c00" }}>
      Failed to load data. Please try again.
    </p>
  );
}

export function* DataFetcher() {
  const userDataId = yield* $id();

  const user = yield* $resolve<User>(
    {
      fn: fetchUser,
      loading: <Spinner />,
      error: <ErrorMessage />,
    },
    [],
  );

  return (
    <section aria-label="Data fetcher example">
      <h2>Data Fetcher</h2>
      <p>
        <code>yield* $resolve</code> suspends rendering while a promise is pending and automatically
        resumes when it resolves.
      </p>
      <div
        id={userDataId}
        data-testid="user-data"
        style={{
          padding: "0.75rem",
          background: "#f5f5f5",
          borderRadius: "4px",
          fontFamily: "monospace",
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

// ---------------------------------------------------------------------------
// $resolveRaw demo
// ---------------------------------------------------------------------------

async function fetchPost(id: number): Promise<{ id: number; title: string; body: string }> {
  await new Promise((resolve) => setTimeout(resolve, 800));
  if (id === 0) throw new Error("Invalid post ID");
  return { id, title: `Post #${id}`, body: `This is the content of post number ${id}.` };
}

export function* ResolveRawDemo() {
  const [postId, setPostId] = yield* $state(1);
  const promise = yield* $memo(() => fetchPost(postId), [postId]);
  const { data, loading, error } = yield* $resolveRaw<
    { id: number; title: string; body: string },
    Error
  >(promise);

  return (
    <section aria-label="$resolveRaw demo" style={{ marginTop: "2rem" }}>
      <h2>
        <code>$resolveRaw</code>
      </h2>
      <p>
        Low-level async hook — returns <code>{`{ data, loading, error }`}</code> directly so the
        component controls rendering at each stage.
      </p>
      <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1rem" }}>
        {[1, 2, 3, 0].map((id) => (
          <button
            $key={id}
            data-testid={`post-btn-${id}`}
            onClick={() => setPostId(id)}
            style={{ fontWeight: postId === id ? "bold" : "normal" }}
          >
            {id === 0 ? "Error" : `Post ${id}`}
          </button>
        ))}
      </div>
      <p $shown={loading} data-testid="raw-loading" style={{ color: "#888", fontStyle: "italic" }}>
        Loading…
      </p>
      <p $shown={!!error} data-testid="raw-error" style={{ color: "#c00" }}>
        Error: {error?.message}
      </p>
      <div
        $shown={!!data}
        data-testid="raw-data"
        style={{ padding: "0.75rem", background: "#f5f5f5", borderRadius: "4px" }}
      >
        <strong>{data?.title}</strong>
        <p style={{ margin: "0.4rem 0 0" }}>{data?.body}</p>
      </div>
    </section>
  );
}

export function mountDataFetcher(container: HTMLElement): void {
  render(<DataFetcher />, container);
}
