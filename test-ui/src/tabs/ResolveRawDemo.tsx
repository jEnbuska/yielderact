import { useState, useMemo, useResolveRaw } from 'yielderact';

async function fetchPost(id: number): Promise<{ id: number; title: string; body: string }> {
  await new Promise((resolve) => setTimeout(resolve, 800));
  if (id === 0) throw new Error('Invalid post ID');
  return { id, title: `Post #${id}`, body: `This is the content of post number ${id}.` };
}

export function* ResolveRawDemo() {
  const [postId, setPostId] = yield* useState(1);
  const promise = yield* useMemo(() => fetchPost(postId), [postId]);
  const { data, loading, error } = yield* useResolveRaw<
    { id: number; title: string; body: string },
    Error
  >(promise);

  return (
    <section aria-label="useResolveRaw demo" className="mt-8">
      <h2>
        <code>useResolveRaw</code>
      </h2>
      <p>
        Low-level async hook — returns <code>{`{ data, loading, error }`}</code> directly so the
        component controls rendering at each stage.
      </p>
      <div className="flex gap-2 mb-4">
        {[1, 2, 3, 0].map((id) => (
          <button
            key={id}
            data-testid={`post-btn-${id}`}
            onClick={() => setPostId(id)}
            style={{ fontWeight: postId === id ? 'bold' : 'normal' }}
          >
            {id === 0 ? 'Error' : `Post ${id}`}
          </button>
        ))}
      </div>
      {loading && (
        <p data-testid="raw-loading" style={{ color: '#888', fontStyle: 'italic' }}>
          Loading…
        </p>
      )}
      {error && (
        <p data-testid="raw-error" style={{ color: '#c00' }}>
          Error: {error.message}
        </p>
      )}
      {data && (
        <div data-testid="raw-data" className="p-3 rounded" style={{ background: '#f5f5f5' }}>
          <strong>{data.title}</strong>
          <p className="mt-1">{data.body}</p>
        </div>
      )}
    </section>
  );
}
