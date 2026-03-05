export function CodeLog({ lines }: { lines: string[] }) {
  return (
    <pre className="mt-3 text-xs bg-gray-900 text-green-300 p-2 rounded overflow-x-auto">
      {lines.join('\n')}
    </pre>
  );
}
