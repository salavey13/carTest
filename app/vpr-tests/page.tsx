// /app/vpr-tests/page.tsx
"use client";

"use client";
import { useEffect, useState, useMemo } from "react"; // Добавлен useMemo
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { supabaseAdmin } from "@/hooks/supabase";
import { useAppContext } from "@/contexts/AppContext"; // Keep if needed for user context
import { debugLogger } from "@/lib/debugLogger";
import { Loader2, Trophy, BookOpen } from "lucide-react";
import type { Database } from '@/types/database.types';

// --- Types ---
// Убедитесь, что ваш тип Subject включает grade_level
type Subject = Database['public']['Tables']['subjects']['Row'] & {
    grade_level?: number | null; // Добавляем поле для класса (если его нет в Database['...']['Row'])
};
type LeaderboardEntry = {
    user_id: string;
    username: string | null;
    avatar_url: string | null;
    total_score: number | null;
};
// --- End Types ---

// --- SubjectCard Component (Без изменений) ---
const SubjectCard = ({ subject }: { subject: Subject }) => (
    <Link href={`/vpr-test/${subject.id}`} passHref legacyBehavior>
        <motion.a
            className="block bg-gradient-to-br from-dark-card to-gray-800 rounded-2xl shadow-lg hover:shadow-xl shadow-brand-blue/20 hover:shadow-brand-blue/30 transition-all duration-300 overflow-hidden border-2 border-brand-blue/30 group p-6 text-center"
            whileHover={{ y: -6, scale: 1.04 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 15 }}
        >
            <div className="mb-4 w-16 h-16 mx-auto rounded-full bg-brand-blue/20 flex items-center justify-center border-2 border-brand-blue/50 group-hover:scale-110 transition-transform">
                 <BookOpen className="w-8 h-8 text-brand-blue group-hover:text-neon-lime transition-colors" />
            </div>
            <h3 className="text-lg font-semibold text-light-text group-hover:text-brand-green transition-colors">
                {subject.name}
            </h3>
            {/* Можно опционально добавить класс, если нужно */}
            {/* <p className="text-sm text-gray-400 mt-1">{subject.grade_level} класс</p> */}
        </motion.a>
    </Link>
);
// --- End SubjectCard ---

// --- Leaderboard Component (Без изменений) ---
const Leaderboard = ({ entries }: { entries: LeaderboardEntry[] }) => (
    <div className="bg-gradient-to-b from-dark-card to-dark-bg rounded-xl shadow-xl border border-brand-purple/30 p-5 md:p-6">
        <h2 className="text-xl font-bold text-center text-brand-orange mb-5 flex items-center justify-center gap-2">
            <Trophy className="w-6 h-6 text-yellow-400" />
            Доска Почета ВПР
        </h2>
        {entries.length === 0 ? (
            <p className="text-center text-gray-400 py-4">Пока никто не завершил тесты.</p>
        ) : (
            <ol className="space-y-3">
                {entries.map((entry, index) => (
                    <motion.li
                        key={entry.user_id}
                        className={`flex items-center gap-3 p-3 rounded-lg border ${index < 3 ? 'border-yellow-400/50 bg-gradient-to-r from-yellow-500/10 to-dark-card' : 'border-gray-700 bg-dark-card/60'}`}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                    >
                        <span className={`font-bold text-lg w-6 text-center ${index < 3 ? 'text-yellow-400' : 'text-gray-400'}`}>
                            {index + 1}
                        </span>
                         <Image
                            src={entry.avatar_url || '/default-avatar.png'}
                            alt={entry.username || 'Аноним'}
                            width={36}
                            height={36}
                            className="rounded-full border border-gray-600"
                        />
                        <span className="flex-grow font-medium text-light-text/90 truncate">
                            {entry.username || `Ученик #${entry.user_id.substring(0, 4)}`}
                        </span>
                        <span className="font-bold text-brand-green bg-brand-green/10 px-2.5 py-1 rounded-md text-sm border border-brand-green/30">
                            {entry.total_score ?? 0} <span className="text-xs opacity-80">очк.</span>
                        </span>
                    </motion.li>
                ))}
            </ol>
        )}
    </div>
);
// --- End Leaderboard ---


export default function VprTestsListPage() {
    // --- State and Fetching Logic ---
    // const [subjects, setSubjects] = useState<Subject[]>([]); // Старое состояние, больше не нужно в таком виде
    const [allSubjects, setAllSubjects] = useState<Subject[]>([]); // Храним ВСЕ загруженные предметы (6 и 7 класс)
    const [selectedGrade, setSelectedGrade] = useState<number>(6); // Состояние для выбранного класса, по умолчанию 6
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    // const { user } = useAppContext();

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                // 1. Fetch Subjects для 6 И 7 класса
                // Убедитесь, что в таблице 'subjects' есть колонка 'grade_level' или аналог
                const { data: subjectsData, error: subjectsError } = await supabaseAdmin
                    .from('subjects')
                    .select('*')
                    .in('grade_level', [6, 7]) // <-- Загружаем предметы для 6 и 7 класса
                    .order('grade_level', { ascending: true }) // Опционально: сначала 6, потом 7 класс
                    .order('name', { ascending: true });

                if (subjectsError) throw subjectsError;
                // Убедимся, что grade_level есть, хотя бы как null или undefined
                const subjectsWithGrade = subjectsData?.map(s => ({ ...s, grade_level: s.grade_level })) || [];
                setAllSubjects(subjectsWithGrade as Subject[]); // Сохраняем все предметы

                // 2. Fetch Leaderboard Data (без изменений, предполагаем общий лидерборд)
                const { data: leaderboardData, error: leaderboardError } = await supabaseAdmin
                     .rpc('get_vpr_leaderboard', { limit_count: 10 });

                if (leaderboardError) throw leaderboardError;
                setLeaderboard((leaderboardData as LeaderboardEntry[]) || []);

            } catch (err: any) {
                debugLogger.error("Ошибка загрузки данных ВПР:", err);
                setError("Не удалось загрузить данные для тестов ВПР.");
                // Добавим проверку на специфичную ошибку отсутствия колонки
                if (err.message?.includes('column "grade_level" does not exist')) {
                     setError("Ошибка: В базе данных отсутствует колонка 'grade_level' в таблице 'subjects'. Невозможно отфильтровать по классу.");
                }
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);
    // --- End State and Fetching ---

    // --- Фильтрация предметов для отображения ---
    // Используем useMemo для оптимизации, чтобы фильтрация не происходила при каждом рендере
    const displayedSubjects = useMemo(() => {
        return allSubjects.filter(subject => subject.grade_level === selectedGrade);
    }, [allSubjects, selectedGrade]); // Зависит от списка всех предметов и выбранного класса

    // --- Loading State (без изменений) ---
    if (isLoading) {
        return (
            <div className="min-h-screen bg-dark-bg flex items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-brand-blue" />
                <span className="ml-4 text-lg text-light-text">Загружаем тесты...</span>
            </div>
        );
    }

    // --- Error State (без изменений) ---
     if (error) {
         return (
            <div className="min-h-screen bg-dark-bg flex items-center justify-center text-brand-pink p-5 text-center">
                {error}
            </div>
         );
     }

    // --- Main Page Render ---
    return (
        <div className="min-h-screen bg-page-gradient py-10 px-4 md:px-8 text-light-text">
            <div className="max-w-6xl mx-auto">
                 {/* Заголовок теперь динамический */}
                 <motion.h1
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-3xl md:text-4xl font-bold text-center text-brand-green mb-4 md:mb-6" // Уменьшен нижний отступ
                 >
                    Тренажеры ВПР ({selectedGrade} класс) 🚀
                 </motion.h1>

                 {/* Блок переключения классов */}
                 <div className="flex justify-center items-center gap-4 mb-8 md:mb-12">
                     {[6, 7].map((grade) => (
                         <button
                             key={grade}
                             onClick={() => setSelectedGrade(grade)}
                             className={`px-6 py-2 rounded-lg font-medium transition-all duration-200 border-2 ${
                                 selectedGrade === grade
                                     ? 'bg-brand-blue border-brand-blue/80 text-white shadow-md shadow-brand-blue/30' // Стиль активной кнопки
                                     : 'bg-dark-card border-gray-700 text-gray-300 hover:bg-gray-700 hover:border-gray-500 hover:text-white' // Стиль неактивной кнопки
                             }`}
                         >
                             {grade} класс
                         </button>
                     ))}
                 </div>


                {/* Subject Grid (использует отфильтрованные displayedSubjects) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-8 mb-10 md:mb-12">
                    {displayedSubjects.length > 0 ? (
                         displayedSubjects.map(subject => (
                             <SubjectCard key={subject.id} subject={subject} />
                         ))
                     ) : (
                        // Сообщение, если для выбранного класса нет предметов
                        <p className="text-center text-gray-400 col-span-full">
                            Тренажеры для {selectedGrade} класса пока не добавлены.
                        </p>
                     )}
                </div>

                {/* Leaderboard (без изменений, показывает общую доску) */}
                 <Leaderboard entries={leaderboard} />

            </div>
             {/* <ParticlesComponent /> */}
        </div>
    );
}