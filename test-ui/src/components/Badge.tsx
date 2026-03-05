export function Badge({ children, testId }: { children: unknown; testId?: string }) {
  return (
    <span className="px-2 py-0.5 bg-green-100 text-green-800 rounded text-sm" data-testid={testId}>
      {children}
    </span>
  );
}
