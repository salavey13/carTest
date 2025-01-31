// src/components/ProgressIndicator.tsx
interface ProgressIndicatorProps {
  current: number;
  total: number;
}

export const ProgressIndicator = ({ current, total }: ProgressIndicatorProps) => {
  const progress = (current / total) * 100;
  
  return (
    <div className="w-full bg-gray-800 rounded-full h-2.5 mb-8">
      <div 
        className="bg-cyan-500 h-2.5 rounded-full transition-all duration-500" 
        style={{ width: `${progress}%` }}
      />
    </div>
  );
};

