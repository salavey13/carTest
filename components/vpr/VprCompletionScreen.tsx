import { motion } from "framer-motion";
import { CheckCircle, RotateCcw, BookOpen } from "lucide-react";

interface VprCompletionScreenProps {
  subjectName: string | undefined;
  finalScore: number;
  totalQuestions: number;
  onReset: () => void;
  onGoToList: () => void;
}

export function VprCompletionScreen({
  subjectName,
  finalScore,
  totalQuestions,
  onReset,
  onGoToList,
}: VprCompletionScreenProps) {
  const percentage = totalQuestions > 0 ? ((finalScore / totalQuestions) * 100).toFixed(0) : 0;
  const scoreInt = parseInt(percentage);
  const resultColor = scoreInt >= 80 ? 'text-brand-green' : scoreInt >= 50 ? 'text-yellow-500' : 'text-brand-pink';
  const resultBg = scoreInt >= 80 ? 'bg-green-900/30' : scoreInt >= 50 ? 'bg-yellow-900/30' : 'bg-red-900/30';
  const resultBorder = scoreInt >= 80 ? 'border-brand-green' : scoreInt >= 50 ? 'border-yellow-500' : 'border-brand-pink';


  return (
    <div className="min-h-screen bg-gradient-to-br from-dark-bg to-dark-card flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className={`bg-dark-card rounded-xl shadow-xl p-6 md:p-10 text-center max-w-md w-full border-t-4 ${resultBorder}`}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
        >
          <CheckCircle className={`h-16 w-16 ${resultColor} mx-auto mb-5`} />
        </motion.div>

        <h2 className="text-2xl md:text-3xl font-bold text-light-text mb-3">
          Тест "{subjectName || 'Тест'}" завершен!
        </h2>
        <p className={`text-xl md:text-2xl font-semibold mb-6 p-3 rounded-lg ${resultBg} ${resultColor}`}>
          {finalScore} из {totalQuestions} ({percentage}%)
        </p>
        <div className="space-y-4">
          <button
            onClick={onReset}
            className="w-full bg-brand-blue text-white px-6 py-3 rounded-lg font-semibold text-lg hover:bg-brand-blue/80 transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg flex items-center justify-center gap-2"
          >
            <RotateCcw className="h-5 w-5" />
            Пройти еще раз
          </button>
          <button
            onClick={onGoToList}
            className="w-full bg-gray-600 text-light-text/90 px-6 py-3 rounded-lg font-semibold text-lg hover:bg-gray-700 transition-colors flex items-center justify-center gap-2"
          >
            <BookOpen className="h-5 w-5" />
            К списку тестов
          </button>
        </div>
      </motion.div>
    </div>
  );
}