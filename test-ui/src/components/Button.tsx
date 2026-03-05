export function Button({
  children,
  onClick,
  disabled,
  variant = 'default',
  testId,
}: {
  children: unknown;
  onClick?: () => void;
  disabled?: boolean;
  variant?: 'default' | 'primary' | 'danger';
  testId?: string;
}) {
  const base =
    'px-3 py-1.5 border rounded cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 text-sm';
  const variants: Record<string, string> = {
    default: 'bg-white text-gray-800 border-gray-300 hover:bg-gray-50',
    primary: 'bg-blue-500 text-white border-blue-500 hover:bg-blue-600',
    danger: 'bg-red-600 text-white border-red-600 hover:bg-red-700',
  };
  return (
    <button
      className={`${base} ${variants[variant]}`}
      data-testid={testId}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
