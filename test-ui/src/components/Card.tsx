export function Card({ children, testId }: { children: unknown; testId?: string }) {
  return (
    <div className="border border-gray-200 rounded-md p-4" data-testid={testId}>
      {children}
    </div>
  );
}
