"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { supabaseAdmin } from "@/hooks/supabase";
import { useAppContext } from "@/contexts/AppContext"; // Keep if needed for user context
import { debugLogger } from "@/lib/debugLogger";
import { Loader2, Trophy, BookOpen, Info } from "lucide-react"; // Added Info icon
import { FaMap, FaBookOpen as FaBookOpenFa } from "react-icons/fa6"; // Use FaBookOpenFa to avoid name clash
import type { Database } from '@/types/database.types';

// --- Types ---
type Subject = Database['public']['Tables']['subjects']['Row'] & {
    grade_level?: number | null;
};
type LeaderboardEntry = {
    user_id: string;
    username: string | null;
    avatar_url: string | null;
    total_score: number | null;
};
// --- End Types ---

// --- SubjectCard Component ---
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
                 {/* Using Lucide BookOpen here */}
                 <BookOpen className="w-8 h-8 text-brand-blue group-hover:text-neon-lime transition-colors" />
            </div>
            <h3 className="text-lg font-semibold text-light-text group-hover:text-brand-green transition-colors">
                {subject.name} {subject.grade_level ? `(${subject.grade_level} кл)` : ''}
            </h3>
        </motion.a>
    </Link>
);
// --- End SubjectCard ---

// --- Leaderboard Component ---
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
    const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
    const [selectedGrade, setSelectedGrade] = useState<number>(6);
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const { data: subjectsData, error: subjectsError } = await supabaseAdmin
                    .from('subjects')
                    .select('*')
                    .in('grade_level', [6, 7])
                    .order('grade_level', { ascending: true })
                    .order('name', { ascending: true });

                if (subjectsError) throw subjectsError;
                const subjectsWithGrade = subjectsData?.map(s => ({ ...s, grade_level: s.grade_level })) || [];
                setAllSubjects(subjectsWithGrade as Subject[]);

                const { data: leaderboardData, error: leaderboardError } = await supabaseAdmin
                     .rpc('get_vpr_leaderboard', { limit_count: 10 });

                if (leaderboardError) throw leaderboardError;
                setLeaderboard((leaderboardData as LeaderboardEntry[]) || []);

            } catch (err: any) {
                debugLogger.error("Ошибка загрузки данных ВПР:", err);
                let errorMessage = "Не удалось загрузить данные для тестов ВПР.";
                if (err.message?.includes('column "grade_level" does not exist')) {
                     errorMessage = "Ошибка: В базе данных отсутствует колонка 'grade_level' в таблице 'subjects'. Невозможно отфильтровать по классу.";
                }
                setError(errorMessage);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);
    // --- End State and Fetching ---

    // --- Фильтрация предметов для отображения ---
    const displayedSubjects = useMemo(() => {
        return allSubjects.filter(subject => subject.grade_level === selectedGrade);
    }, [allSubjects, selectedGrade]);

    // --- Loading State ---
    if (isLoading) {
        return (
            <div className="min-h-screen bg-dark-bg flex items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-brand-blue" />
                <span className="ml-4 text-lg text-light-text">Загружаем тесты...</span>
            </div>
        );
    }

    // --- Error State ---
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
                 <motion.h1
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-3xl md:text-4xl font-bold text-center text-brand-green mb-4 md:mb-6"
                 >
                    Тренажеры ВПР ({selectedGrade} класс) 🚀
                 </motion.h1>

                 {/* Блок переключения классов */}
                 <div className="flex justify-center items-center gap-4 mb-6 md:mb-8">
                     {[6, 7].map((grade) => (
                         <button
                             key={grade}
                             onClick={() => setSelectedGrade(grade)}
                             className={`px-6 py-2 rounded-lg font-medium transition-all duration-200 border-2 ${
                                 selectedGrade === grade
                                     ? 'bg-brand-blue border-brand-blue/80 text-white shadow-md shadow-brand-blue/30'
                                     : 'bg-dark-card border-gray-700 text-gray-300 hover:bg-gray-700 hover:border-gray-500 hover:text-white'
                             }`}
                         >
                             {grade} класс
                         </button>
                     ))}
                 </div>

                 {/* NEW: Cheatsheet Links Section */}
                 {selectedGrade === 6 && ( // Показываем только для 6 класса
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="mb-8 md:mb-10 p-5 bg-gradient-to-r from-indigo-900/30 via-purple-900/20 to-indigo-900/30 border-2 border-purple-500/40 rounded-xl shadow-lg shadow-purple-500/10"
                    >
                         <h2 className="text-xl font-semibold text-center text-purple-300 mb-4 flex items-center justify-center gap-2">
                             <Info className="w-5 h-5 text-purple-400"/>
                             Подготовка к ВПР (6 класс)
                         </h2>
                         <p className="text-center text-gray-300 mb-5 text-sm md:text-base">
                            Нужна быстрая помощь? Загляни в наши шпаргалки с самым важным!
                         </p>
                         <div className="flex flex-col sm:flex-row justify-center items-center gap-4">
                             <Link href="/vpr/history/6/cheatsheet" passHref legacyBehavior>
                                 <motion.a
                                     className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200 border border-blue-500 shadow-md hover:shadow-lg w-full sm:w-auto justify-center"
                                     whileHover={{ scale: 1.05 }}
                                 >
                                     <FaBookOpenFa className="w-4 h-4"/>
                                     История (Шпаргалка)
                                 </motion.a>
                             </Link>
                             <Link href="/vpr/geography/6/cheatsheet" passHref legacyBehavior>
                                 <motion.a
                                     className="flex items-center gap-2 px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg transition-colors duration-200 border border-teal-500 shadow-md hover:shadow-lg w-full sm:w-auto justify-center"
                                     whileHover={{ scale: 1.05 }}
                                 >
                                     <FaMap className="w-4 h-4"/>
                                     География (Шпаргалка)
                                 </motion.a>
                             </Link>
                         </div>
                    </motion.div>
                 )}
                 {/* END: Cheatsheet Links Section */}

                {/* Subject Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-8 mb-10 md:mb-12">
                    {displayedSubjects.length > 0 ? (
                         displayedSubjects.map(subject => (
                             <SubjectCard key={subject.id} subject={subject} />
                         ))
                     ) : (
                        <p className="text-center text-gray-400 col-span-full py-8">
                            Тренажеры для {selectedGrade} класса пока не добавлены.
                        </p>
                     )}
                </div>

                {/* Leaderboard */}
                 <Leaderboard entries={leaderboard} />

            </div>
        </div>
    );
}