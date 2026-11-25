"use client";

import { motion } from "framer-motion";
import { CheckCircle, RotateCcw, BookOpen, Lock, Unlock, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { getVprCheatsheetHref } from "@/lib/vprCheatsheet";

interface VprCompletionScreenProps {
  subjectName: string | undefined;
  variantNumber?: number | null; // <<< Added prop
  finalScore: number;
  totalQuestions: number;
  onReset: () => void;
  onGoToList: () => void;
  subjectSlug?: string;
  roadmapUnlock?: { passed: boolean; newlyUnlocked: string | null } | null; // task212c
}

const ROADMAP_LABELS: Record<string, string> = {
  algebra: "Алгебра",
  geometry: "Геометрия",
  probability: "Вероятность и статистика",
  russian: "Русский язык",
  history: "История",
  literature: "Литература",
};

export function VprCompletionScreen({
  subjectName,
  variantNumber, // <<< Destructure prop
  finalScore,
  totalQuestions,
  onReset,
  onGoToList,
  subjectSlug = "general",
  roadmapUnlock = null,
}: VprCompletionScreenProps) {
  const router = useRouter();
  const percentage = totalQuestions > 0 ? ((finalScore / totalQuestions) * 100).toFixed(0) : '0';
  const scoreInt = parseInt(percentage);
  const resultColor = scoreInt >= 80 ? 'text-brand-green' : scoreInt >= 50 ? 'text-yellow-500' : 'text-brand-pink';
  const resultBg = scoreInt >= 80 ? 'bg-green-900/30' : scoreInt >= 50 ? 'bg-yellow-900/30' : 'bg-red-900/30';
  const resultBorder = scoreInt >= 80 ? 'border-brand-green' : scoreInt >= 50 ? 'border-yellow-500' : 'border-brand-pink';
  const isRoadmapSubject = subjectSlug.endsWith("-8");


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

        <h2 className="text-2xl md:text-3xl font-bold text-light-text mb-1"> {/* Adjusted margin */}
          Тест «{subjectName || 'Тест'}» завершен!
        </h2>
        {/* Display variant number if available */}
        {variantNumber && (
            <p className="text-sm text-gray-400 mb-3">
                (Вариант {variantNumber})
            </p>
        )}
        <p className={`text-xl md:text-2xl font-semibold mb-6 p-3 rounded-lg ${resultBg} ${resultColor}`}>
          {finalScore} из {totalQuestions} ({percentage}%)
        </p>

        {/* task212c: баннер дорожки разблокировки */}
        {isRoadmapSubject && roadmapUnlock && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className={`mb-6 p-4 rounded-xl border text-left ${
              roadmapUnlock.newlyUnlocked
                ? "border-green-500/40 bg-green-950/30"
                : roadmapUnlock.passed
                  ? "border-brand-cyan/30 bg-cyan-950/20"
                  : "border-red-500/30 bg-red-950/20"
            }`}
          >
            {roadmapUnlock.newlyUnlocked ? (
              <div className="flex items-start gap-3">
                <Unlock className="w-6 h-6 text-green-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-green-400 text-sm">Новый уровень открыт!</div>
                  <div className="text-sm text-zinc-300 mt-1">
                    Предмет <b>{ROADMAP_LABELS[roadmapUnlock.newlyUnlocked] ?? roadmapUnlock.newlyUnlocked}</b> разблокирован на дорожке 8 класса.
                  </div>
                </div>
              </div>
            ) : roadmapUnlock.passed ? (
              <div className="flex items-start gap-3">
                <Zap className="w-6 h-6 text-brand-cyan shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-brand-cyan text-sm">Предмет сдан!</div>
                  <div className="text-sm text-zinc-300 mt-1">
                    Ты прошёл порог (не больше 30% ошибок). Это был последний или уже открытый уровень дорожки.
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-start gap-3">
                <Lock className="w-6 h-6 text-red-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-red-400 text-sm">Порог не пройден</div>
                  <div className="text-sm text-zinc-300 mt-1">
                    Нужно набрать минимум <b>70%</b> верных ответов, чтобы открыть следующий предмет. Проглоти шпаргалку и вернись сильнее.
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        )}

        <div className="space-y-4">
        <button
          onClick={() => router.push(getVprCheatsheetHref(subjectSlug))}
          className="w-full bg-brand-cyan text-white py-3 rounded-lg mt-1 font-semibold hover:bg-brand-cyan/80 transition-colors"
        >
          📖 Открыть шпаргалку по предмету
        </button>

          <button
            onClick={onReset}
            className="w-full bg-brand-blue text-white px-6 py-3 rounded-lg font-semibold text-lg hover:bg-brand-blue/80 transition-all duration-300 transform hover:scale-105 shadow-md hover:shadow-lg flex items-center justify-center gap-2"
          >
            <RotateCcw className="h-5 w-5" />
            {/* Updated button text */}
            Пройти другой вариант
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