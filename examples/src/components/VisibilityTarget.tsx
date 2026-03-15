export function* VisibilityTarget({ id }: { id: string }) {
  return (
    <span data-testid={id} style={{ padding: "0.2rem 0.5rem", background: "#d4edda" }}>
      visible
    </span>
  );
}
