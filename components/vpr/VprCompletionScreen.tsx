"use client";

import { motion } from "framer-motion";
import { CheckCircle, RotateCcw, BookOpen, Lock, Unlock, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { getVprCheatsheetHref } from "@/lib/vprCheatsheet";
import {
  VPR_ROADMAP_ORDER,
  VPR_PASS_RATIO,
  VPR_ROADMAP_LABELS,
} from "@/lib/vprRoadmap";

interface VprCompletionScreenProps {
  subjectName: string | undefined;
  variantNumber?: number | null; // <<< Added prop
  finalScore: number;
  totalQuestions: number;
  onReset: () => void;
  onGoToList: () => void;
  subjectSlug?: string;
  roadmapUnlock?: { passed: boolean; newlyUnlocked: string | null; earnedAchievements?: string[] } | null; // task212c/214
}

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

  // task213: «почти» — порог не пройден, но близко (60-69%)
  const currentSlug = isRoadmapSubject ? subjectSlug.replace(/-8$/, "") : null;
  const roadmapIdx = currentSlug ? VPR_ROADMAP_ORDER.indexOf(currentSlug as (typeof VPR_ROADMAP_ORDER)[number]) : -1;
  const nextRoadmapSlug = roadmapIdx >= 0 ? VPR_ROADMAP_ORDER[roadmapIdx + 1] ?? null : null;
  const isAlmost = isRoadmapSubject && roadmapUnlock && !roadmapUnlock.passed && scoreInt >= 60 && scoreInt < Math.round(VPR_PASS_RATIO * 100);
  const answersNeeded = totalQuestions > 0
    ? Math.max(1, Math.ceil(VPR_PASS_RATIO * totalQuestions) - finalScore)
    : 0;


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

        {/* task212c/213: баннер дорожки разблокировки */}
        {isRoadmapSubject && roadmapUnlock && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className={`mb-4 p-4 rounded-xl border text-left ${
              roadmapUnlock.newlyUnlocked
                ? "border-green-500/40 bg-green-950/30"
                : roadmapUnlock.passed
                  ? "border-brand-cyan/30 bg-cyan-950/20"
                  : isAlmost
                    ? "border-yellow-500/40 bg-yellow-950/20"
                    : "border-red-500/30 bg-red-950/20"
            }`}
          >
            {roadmapUnlock.newlyUnlocked ? (
              <div className="flex items-start gap-3">
                <Unlock className="w-6 h-6 text-green-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-green-400 text-sm">Новый уровень открыт!</div>
                  <div className="text-sm text-zinc-300 mt-1">
                    Предмет <b>{VPR_ROADMAP_LABELS[roadmapUnlock.newlyUnlocked] ?? roadmapUnlock.newlyUnlocked}</b> разблокирован на дорожке 8 класса.
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
            ) : isAlmost ? (
              <div className="flex items-start gap-3">
                <Zap className="w-6 h-6 text-yellow-400 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-yellow-400 text-sm">Почти! Не хватило {answersNeeded} {answersNeeded === 1 ? "ответа" : "ответов"}</div>
                  <div className="text-sm text-zinc-300 mt-1">
                    До разблокировки следующего предмета{nextRoadmapSlug ? ` (${VPR_ROADMAP_LABELS[nextRoadmapSlug]})` : ""} — один шаг.
                    Перечитай шпаргалку по слабым местам и возьми другой вариант: второй заход всегда точнее.
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

        {/* task213: мини-дорожка 6 уровней — наглядный прогресс после теста */}
        {isRoadmapSubject && roadmapUnlock && (
          <div className="mb-6 flex items-center justify-center gap-1.5">
            {VPR_ROADMAP_ORDER.map((s, i) => {
              const isCurrent = s === currentSlug;
              const isNext = s === roadmapUnlock.newlyUnlocked;
              const doneBefore = i < roadmapIdx;
              return (
                <motion.div
                  key={s}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.4 + i * 0.08 }}
                  title={VPR_ROADMAP_LABELS[s]}
                  className={`w-8 h-8 rounded-lg border flex items-center justify-center text-[10px] font-bold ${
                    isNext
                      ? "border-green-400 bg-green-500/20 text-green-300"
                      : isCurrent
                        ? roadmapUnlock.passed
                          ? "border-brand-cyan bg-cyan-500/20 text-cyan-300"
                          : isAlmost
                            ? "border-yellow-500 bg-yellow-500/20 text-yellow-300"
                            : "border-red-500/60 bg-red-500/10 text-red-300"
                        : doneBefore
                          ? "border-zinc-700 bg-zinc-800/60 text-zinc-400"
                          : "border-zinc-800 bg-zinc-900/40 text-zinc-600"
                  }`}
                >
                  {isNext ? "🔓" : isCurrent ? (roadmapUnlock.passed ? "✓" : scoreInt) : doneBefore ? "✓" : i + 1}
                </motion.div>
              );
            })}
          </div>
        )}

        {/* task214: полученные ачивки — золотой блок над кнопками */}
        {isRoadmapSubject && roadmapUnlock?.earnedAchievements && roadmapUnlock.earnedAchievements.length > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.9, type: "spring" }}
            className="mb-6 p-4 rounded-xl border border-yellow-500/40 bg-gradient-to-r from-yellow-950/40 to-amber-950/30"
          >
            <div className="font-bold text-yellow-400 text-sm mb-2 text-center uppercase tracking-wider">
              🏅 Новая ачивка
            </div>
            <div className="space-y-1.5">
              {roadmapUnlock.earnedAchievements.map((ach, i) => (
                <motion.div
                  key={ach}
                  initial={{ x: -20, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 1.1 + i * 0.15 }}
                  className="text-sm text-yellow-200 font-semibold text-center"
                >
                  {ach}
                </motion.div>
              ))}
            </div>
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
            К дорожке уровней
          </button>
        </div>
      </motion.div>
    </div>
  );
}