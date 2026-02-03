interface LoadingSpinnerProps {
  className?: string;
}

export function LoadingSpinner({ className = "h-64" }: LoadingSpinnerProps) {
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
