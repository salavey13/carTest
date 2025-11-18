"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { supabaseAdmin } from "@/hooks/supabase";
import { debugLogger } from "@/lib/debugLogger";
import { Loader2, Trophy, BookOpen, Info, GraduationCap, Terminal } from "lucide-react";
import { VibeContentRenderer } from "@/components/VibeContentRenderer"; 
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

// --- SubjectCard Component ---
const SubjectCard = ({ subject }: { subject: Subject }) => (
    <Link href={`/vpr-test/${subject.id}`} passHref legacyBehavior>
        <motion.a
            className="block bg-gradient-to-br from-zinc-900 to-zinc-800 rounded-2xl shadow-lg hover:shadow-xl hover:shadow-indigo-500/20 transition-all duration-300 overflow-hidden border border-zinc-700 hover:border-indigo-500 group p-6 text-center relative"
            whileHover={{ y: -6, scale: 1.02 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
        >
            <div className="absolute inset-0 bg-indigo-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="mb-4 w-16 h-16 mx-auto rounded-full bg-zinc-800 flex items-center justify-center border border-zinc-600 group-hover:border-indigo-500 group-hover:scale-110 transition-transform shadow-inner">
                 <BookOpen className="w-8 h-8 text-zinc-400 group-hover:text-indigo-400 transition-colors" />
            </div>
            <h3 className="text-lg font-bold text-white group-hover:text-indigo-300 transition-colors relative z-10">
                {subject.name}
            </h3>
            <p className="text-xs text-zinc-500 font-mono mt-1 relative z-10">
                {subject.grade_level ? `${subject.grade_level} КЛАСС` : 'ОБЩИЙ'}
            </p>
        </motion.a>
    </Link>
);

// --- Leaderboard Component ---
const Leaderboard = ({ entries }: { entries: LeaderboardEntry[] }) => (
    <div className="bg-zinc-900/80 backdrop-blur-sm rounded-xl shadow-2xl border border-yellow-500/20 p-5 md:p-6 mt-12">
        <h2 className="text-xl font-bold text-center text-yellow-400 mb-6 flex items-center justify-center gap-2 tracking-wide uppercase">
            <Trophy className="w-6 h-6" />
            Доска Почета VIBE
        </h2>
        {entries.length === 0 ? (
            <p className="text-center text-zinc-500 py-8 font-mono">Данных пока нет. Стань первым!</p>
        ) : (
            <div className="space-y-3">
                {entries.map((entry, index) => (
                    <motion.div
                        key={entry.user_id}
                        className={`flex items-center gap-4 p-3 rounded-xl border transition-all ${
                            index < 3 
                                ? 'border-yellow-500/30 bg-gradient-to-r from-yellow-500/10 to-transparent' 
                                : 'border-zinc-800 bg-zinc-900 hover:border-zinc-700'
                        }`}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                    >
                        <span className={`font-black text-lg w-8 text-center ${
                            index === 0 ? 'text-yellow-400 text-2xl' : 
                            index === 1 ? 'text-gray-300 text-xl' : 
                            index === 2 ? 'text-orange-400 text-xl' : 'text-zinc-600'
                        }`}>
                            {index + 1}
                        </span>
                        
                        <div className="relative">
                             <Image
                                src={entry.avatar_url || '/default-avatar.png'}
                                alt={entry.username || 'User'}
                                width={40}
                                height={40}
                                className={`rounded-full border-2 ${index < 3 ? 'border-yellow-500/50' : 'border-zinc-700'}`}
                            />
                            {index === 0 && <div className="absolute -top-2 -right-2 text-lg">👑</div>}
                        </div>

                        <div className="flex-grow min-w-0">
                             <div className="font-bold text-white truncate">
                                {entry.username || `Агент #${entry.user_id.substring(0, 4)}`}
                            </div>
                        </div>

                        <div className="font-mono font-bold text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-lg border border-indigo-500/20">
                            {entry.total_score ?? 0} <span className="text-[10px] text-zinc-500 uppercase">XP</span>
                        </div>
                    </motion.div>
                ))}
            </div>
        )}
    </div>
);

export default function VprTestsListPage() {
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
                let errorMessage = "Не удалось загрузить данные.";
                if (err.message?.includes('column "grade_level" does not exist')) {
                     errorMessage = "Ошибка схемы БД: Нет колонки 'grade_level'.";
                }
                setError(errorMessage);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);

    const displayedSubjects = useMemo(() => {
        return allSubjects.filter(subject => subject.grade_level === selectedGrade);
    }, [allSubjects, selectedGrade]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-indigo-500" />
            </div>
        );
    }

    if (error) {
         return (
            <div className="min-h-screen bg-black flex items-center justify-center text-red-400 p-5 text-center font-mono">
                <span className="border border-red-500/50 bg-red-900/10 p-4 rounded-lg">{error}</span>
            </div>
         );
    }

    return (
        <div className="min-h-screen bg-zinc-950 py-12 px-4 md:px-8 text-zinc-200 font-sans selection:bg-indigo-500 selection:text-white">
            <div className="max-w-6xl mx-auto">
                 
                 <header className="text-center mb-12">
                     <motion.div 
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="inline-block mb-4"
                     >
                        <span className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 px-4 py-1 rounded-full text-xs font-bold tracking-widest uppercase">
                            CyberVibe Education
                        </span>
                     </motion.div>
                     <motion.h1
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight"
                     >
                        Тренажеры ВПР
                     </motion.h1>
                     <p className="text-zinc-500 max-w-lg mx-auto">
                        Выбери свой уровень доступа. Прокачивай мозги, собирай XP, попади в топ.
                     </p>
                 </header>

                 {/* GRADE SELECTOR */}
                 <div className="flex justify-center items-center gap-4 mb-12">
                     {[6, 7].map((grade) => (
                         <button
                             key={grade}
                             onClick={() => setSelectedGrade(grade)}
                             className={`px-8 py-3 rounded-xl font-bold text-lg transition-all duration-300 border-2 ${
                                 selectedGrade === grade
                                     ? 'bg-white text-black border-white shadow-[0_0_20px_rgba(255,255,255,0.3)] transform scale-105'
                                     : 'bg-zinc-900 border-zinc-800 text-zinc-500 hover:border-zinc-600 hover:text-zinc-300'
                             }`}
                         >
                             {grade} Класс
                         </button>
                     ))}
                 </div>

                 {/* --- CHEATSHEETS SECTION (Conditional by Grade) --- */}
                 <AnimatePresence mode="wait">
                    {/* GRADE 6 CHEATSHEETS */}
                    {selectedGrade === 6 && (
                        <motion.div
                            key="grade-6-cheats"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mb-12"
                        >
                            <div className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-2xl relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-500 to-purple-500" />
                                
                                <div className="flex items-center gap-3 mb-6">
                                    <Info className="w-5 h-5 text-indigo-400" />
                                    <h2 className="text-lg font-bold text-white uppercase tracking-wide">Шпаргалки (6 lvl)</h2>
                                </div>

                                <div className="flex flex-wrap gap-3">
                                     <Link href="/vpr/history/6/cheatsheet">
                                         <div className="flex items-center gap-2 px-5 py-3 bg-blue-900/20 hover:bg-blue-900/40 text-blue-300 rounded-lg border border-blue-500/30 transition-all cursor-pointer hover:scale-105">
                                             <VibeContentRenderer content="<FaBookOpen />" className="w-4 h-4" /> История
                                         </div>
                                     </Link>
                                     <Link href="/vpr/geography/6/cheatsheet">
                                         <div className="flex items-center gap-2 px-5 py-3 bg-teal-900/20 hover:bg-teal-900/40 text-teal-300 rounded-lg border border-teal-500/30 transition-all cursor-pointer hover:scale-105">
                                             <VibeContentRenderer content="<FaMap />" className="w-4 h-4" /> География
                                         </div>
                                     </Link>
                                     <Link href="/vpr/biology/6/cheatsheet">
                                         <div className="flex items-center gap-2 px-5 py-3 bg-emerald-900/20 hover:bg-emerald-900/40 text-emerald-300 rounded-lg border border-emerald-500/30 transition-all cursor-pointer hover:scale-105">
                                             <VibeContentRenderer content="<FaLeaf />" className="w-4 h-4" /> Биология
                                         </div>
                                     </Link>
                                     <Link href="/vpr/math/6/cheatsheet">
                                         <div className="flex items-center gap-2 px-5 py-3 bg-orange-900/20 hover:bg-orange-900/40 text-orange-300 rounded-lg border border-orange-500/30 transition-all cursor-pointer hover:scale-105">
                                             <VibeContentRenderer content="<FaCalculator />" className="w-4 h-4" /> Математика
                                         </div>
                                     </Link>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {/* GRADE 7 CHEATSHEETS (New!) */}
                    {selectedGrade === 7 && (
                        <motion.div
                            key="grade-7-cheats"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mb-12"
                        >
                            <div className="p-6 bg-zinc-900/50 border border-zinc-800 rounded-2xl relative overflow-hidden">
                                <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-green-500 to-emerald-500" />
                                
                                <div className="flex items-center gap-3 mb-6">
                                    <Terminal className="w-5 h-5 text-green-400" />
                                    <h2 className="text-lg font-bold text-white uppercase tracking-wide">Шпаргалки (7 lvl)</h2>
                                </div>

                                <div className="flex flex-wrap gap-3">
                                     {/* Informatics Interactive Lesson */}
                                     <Link href="/vpr/informatics/7/cheatsheet">
                                         <div className="flex items-center gap-2 px-6 py-4 bg-green-900/20 hover:bg-green-900/40 text-green-400 rounded-lg border border-green-500/50 transition-all cursor-pointer hover:scale-105 shadow-[0_0_15px_rgba(34,197,94,0.1)] font-mono">
                                             <VibeContentRenderer content="<FaTerminal />" className="w-4 h-4" /> Информатика: URL Decoder
                                         </div>
                                     </Link>
                                     
                                     {/* Placeholder for future Physics/Algebra if needed */}
                                     <div className="flex items-center gap-2 px-5 py-3 bg-zinc-800/50 text-zinc-600 rounded-lg border border-zinc-700 cursor-not-allowed">
                                        <GraduationCap className="w-4 h-4"/> Физика (Скоро)
                                     </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                 </AnimatePresence>

                {/* MAIN SUBJECT GRID */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {displayedSubjects.length > 0 ? (
                         displayedSubjects.map(subject => (
                             <SubjectCard key={subject.id} subject={subject} />
                         ))
                     ) : (
                        <div className="col-span-full py-12 text-center bg-zinc-900 rounded-2xl border border-zinc-800 border-dashed">
                            <GraduationCap className="w-12 h-12 text-zinc-700 mx-auto mb-3" />
                            <p className="text-zinc-500 font-mono">
                                Тренажеры для {selectedGrade} класса загружаются в матрицу...
                            </p>
                        </div>
                     )}
                </div>

                {/* Leaderboard Section */}
                <Leaderboard entries={leaderboard} />

            </div>
        </div>
    );
}