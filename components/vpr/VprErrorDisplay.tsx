import { XCircle } from "lucide-react";

interface VprErrorDisplayProps {
  error: string | null;
  onRetry?: () => void; // Optional retry function
}

export function VprErrorDisplay({ error, onRetry }: VprErrorDisplayProps) {
  if (!error) return null;

  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center p-4">
      <div className="bg-dark-card rounded-lg shadow-xl p-6 text-center max-w-md border border-red-500/50">
        <XCircle className="h-12 w-12 text-brand-pink mx-auto mb-4" />
        <h2 className="text-xl font-semibold text-brand-pink mb-2">Ошибка</h2>
        <p className="text-light-text/80 mb-4">{error}</p>
        <button
          // Use onRetry if provided, otherwise default to reload
          onClick={onRetry ? onRetry : () => window.location.reload()}
          className="bg-brand-pink text-white px-4 py-2 rounded hover:bg-brand-pink/80 transition-colors"
        >
          {onRetry ? "Попробовать снова" : "Обновить страницу"}
        </button>
      </div>
    </div>
  );
}