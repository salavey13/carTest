import { Loader2 } from "lucide-react";

export function VprLoadingIndicator() {
  return (
    <div className="min-h-screen bg-dark-bg flex items-center justify-center">
      <Loader2 className="h-12 w-12 animate-spin text-brand-blue" />
      <span className="ml-4 text-lg text-light-text">Загрузка теста...</span>
    </div>
  );
}