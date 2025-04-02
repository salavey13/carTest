"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { supabaseAdmin } from "@/hooks/supabase";
import { useAppContext } from "@/contexts/AppContext"; // Keep if needed for user context
import { debugLogger } from "@/lib/debugLogger";
import { Loader2, Trophy, BookOpen } from "lucide-react";
import type { Database } from '@/types/database.types';

// --- Types (Kept from current context) ---
type Subject = Database['public']['Tables']['subjects']['Row'];
type LeaderboardEntry = {
    user_id: string;
    username: string | null;
    avatar_url: string | null;
    total_score: number | null;
};
// --- End Types ---

// --- SubjectCard Component (Updated with new styles) ---
const SubjectCard = ({ subject }: { subject: Subject }) => (
    <Link href={`/vpr-test/${subject.id}`} passHref legacyBehavior>
        <motion.a
            // New classes for dark theme gradient, border, shadow, hover effects
            className="block bg-gradient-to-br from-dark-card to-gray-800 rounded-2xl shadow-lg hover:shadow-xl shadow-brand-blue/20 hover:shadow-brand-blue/30 transition-all duration-300 overflow-hidden border-2 border-brand-blue/30 group p-6 text-center"
            // New hover animation
            whileHover={{ y: -6, scale: 1.04 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 15 }}
        >
            {/* Updated icon wrapper style */}
            <div className="mb-4 w-16 h-16 mx-auto rounded-full bg-brand-blue/20 flex items-center justify-center border-2 border-brand-blue/50 group-hover:scale-110 transition-transform">
                 {/* Updated icon color, hover color */}
                 <BookOpen className="w-8 h-8 text-brand-blue group-hover:text-neon-lime transition-colors" />
            </div>
            {/* Updated text color, hover color */}
            <h3 className="text-lg font-semibold text-light-text group-hover:text-brand-green transition-colors">
                {subject.name}
            </h3>
        </motion.a>
    </Link>
);
// --- End SubjectCard ---

// --- Leaderboard Component (Updated with new styles) ---
const Leaderboard = ({ entries }: { entries: LeaderboardEntry[] }) => (
    // New classes for dark card, gradient, border
    <div className="bg-gradient-to-b from-dark-card to-dark-bg rounded-xl shadow-xl border border-brand-purple/30 p-5 md:p-6">
        {/* Updated title style */}
        <h2 className="text-xl font-bold text-center text-brand-orange mb-5 flex items-center justify-center gap-2">
            <Trophy className="w-6 h-6 text-yellow-400" />
            Доска Почета ВПР
        </h2>
        {entries.length === 0 ? (
            // Updated empty state text color
            <p className="text-center text-gray-400 py-4">Пока никто не завершил тесты.</p>
        ) : (
            <ol className="space-y-3">
                {entries.map((entry, index) => (
                    <motion.li
                        key={entry.user_id}
                        // New list item styling: gradient, border based on rank
                        className={`flex items-center gap-3 p-3 rounded-lg border ${index < 3 ? 'border-yellow-400/50 bg-gradient-to-r from-yellow-500/10 to-dark-card' : 'border-gray-700 bg-dark-card/60'}`}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                    >
                        {/* Updated rank number styling */}
                        <span className={`font-bold text-lg w-6 text-center ${index < 3 ? 'text-yellow-400' : 'text-gray-400'}`}>
                            {index + 1}
                        </span>
                        {/* Image remains the same, ensure default avatar path is correct */}
                         <Image
                            src={entry.avatar_url || '/default-avatar.png'}
                            alt={entry.username || 'Аноним'}
                            width={36}
                            height={36}
                            className="rounded-full border border-gray-600" // Darker border for avatar
                        />
                        {/* Updated username text style */}
                        <span className="flex-grow font-medium text-light-text/90 truncate">
                            {entry.username || `Ученик #${entry.user_id.substring(0, 4)}`}
                        </span>
                        {/* Updated score badge style */}
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
    // --- State and Fetching Logic (Kept from current context) ---
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    // const { user } = useAppContext(); // Keep if needed

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                // 1. Fetch Subjects (from current context)
                const { data: subjectsData, error: subjectsError } = await supabaseAdmin
                    .from('subjects')
                    .select('*')
                    .order('name', { ascending: true });

                if (subjectsError) throw subjectsError;
                setSubjects(subjectsData || []);

                // 2. Fetch Leaderboard Data using RPC (from current context)
                const { data: leaderboardData, error: leaderboardError } = await supabaseAdmin
                     .rpc('get_vpr_leaderboard', { limit_count: 10 });

                if (leaderboardError) throw leaderboardError;
                setLeaderboard((leaderboardData as LeaderboardEntry[]) || []); // Type assertion might be needed

            } catch (err: any) {
                debugLogger.error("Ошибка загрузки данных:", err);
                setError("Не удалось загрузить список тестов или лидерборд.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);
    // --- End State and Fetching ---

    // --- Loading State (styled for dark theme) ---
    if (isLoading) {
        return (
            <div className="min-h-screen bg-dark-bg flex items-center justify-center"> {/* Dark bg */}
                <Loader2 className="h-12 w-12 animate-spin text-brand-blue" /> {/* Brand color */}
                <span className="ml-4 text-lg text-light-text">Загружаем тесты...</span> {/* Light text */}
            </div>
        );
    }

    // --- Error State (styled for dark theme) ---
     if (error) {
         return (
            <div className="min-h-screen bg-dark-bg flex items-center justify-center text-brand-pink p-5 text-center"> {/* Dark bg, Brand color */}
                {error}
            </div>
         );
     }

    // --- Main Page Render (Updated with new styles/components) ---
    return (
        // Updated page background and text color
        <div className="min-h-screen bg-page-gradient py-10 px-4 md:px-8 text-light-text">
            <div className="max-w-6xl mx-auto">
                 {/* Updated heading style */}
                 <motion.h1
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    // New bright text color, added emoji
                    className="text-3xl md:text-4xl font-bold text-center text-brand-green mb-8 md:mb-12"
                 >
                    Тренажеры ВПР (6 класс) 🚀
                 </motion.h1>


                {/* Subject Grid (using updated SubjectCard) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-8 mb-10 md:mb-12">
                    {subjects.map(subject => (
                        <SubjectCard key={subject.id} subject={subject} />
                    ))}
                </div>

                {/* Leaderboard (using updated Leaderboard component) */}
                 <Leaderboard entries={leaderboard} />

            </div>
             {/* Optional particles mentioned in new version */}
             {/* <ParticlesComponent /> */}
        </div>
    );
}