interface DataSectionProps {
  title: string;
  data: unknown;
}

export function DataSection({ title, data }: DataSectionProps) {
  return (
    <div className="glass-card p-6">
      <h2 className="text-lg font-semibold text-white mb-4">{title}</h2>
      <pre className="bg-dark-950/50 p-4 rounded-lg overflow-auto text-sm font-mono text-dark-200 border border-dark-700/50">
        {JSON.stringify(data, null, 2)}
      </pre>
    </div>
  );
}
