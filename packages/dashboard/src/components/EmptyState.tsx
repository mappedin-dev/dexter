interface EmptyStateProps {
  icon?: React.ReactNode;
  message: string;
}

const defaultIcon = (
  <svg className="w-8 h-8 text-dark-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
  </svg>
);

export function EmptyState({ icon = defaultIcon, message }: EmptyStateProps) {
  return (
    <div className="glass-card p-12 text-center">
      <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-dark-800 flex items-center justify-center">
        {icon}
      </div>
      <p className="text-dark-400">{message}</p>
    </div>
  );
}
