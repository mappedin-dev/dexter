interface ErrorCardProps {
  message: string;
}

export function ErrorCard({ message }: ErrorCardProps) {
  return (
    <div className="glass-card p-6 border-red-500/30">
      <p className="text-red-400">{message}</p>
    </div>
  );
}
