export function RenderBadge({ count }: { count: number }) {
  return (
    <span
      style={{
        display: "inline-block",
        padding: "1px 6px",
        borderRadius: "9999px",
        background: "#0070f3",
        color: "#fff",
        fontSize: "0.75rem",
        marginLeft: "0.4rem",
      }}
    >
      {count}
    </span>
  );
}
