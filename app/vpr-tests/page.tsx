"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { supabaseAdmin } from "@/hooks/supabase"; // Используем клиентский supabase!
import { useAppContext } from "@/contexts/AppContext"; // Для информации о пользователе, если нужно
import { debugLogger } from "@/lib/debugLogger";
import { Loader2, Trophy, BookOpen } from "lucide-react";
import type { Database } from '@/types/database.types'; // Импорт типов БД

// Типы данных для страницы
type Subject = Database['public']['Tables']['subjects']['Row'];
type LeaderboardEntry = {
    user_id: string;
    username: string | null;
    avatar_url: string | null;
    total_score: number | null; // Сумма очков по всем завершенным тестам
    // Дополнительно можно добавить:
    // subjects_attempted: number | null;
    // total_attempts: number | null;
};

// Компонент для отображения одного предмета
const SubjectCard = ({ subject }: { subject: Subject }) => (
    <Link href={`/vpr-test/${subject.id}`} passHref legacyBehavior>
        <motion.a
            className="block bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow duration-300 overflow-hidden border border-gray-200 group p-5 text-center"
            whileHover={{ y: -5, scale: 1.03 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 15 }}
        >
            <BookOpen className="w-12 h-12 mx-auto text-indigo-500 mb-3 group-hover:text-indigo-600 transition-colors" />
            <h3 className="text-lg font-semibold text-gray-800 group-hover:text-indigo-700 transition-colors">
                {subject.name}
            </h3>
            {/* Можно добавить краткое описание, если нужно */}
            {/* <p className="text-sm text-gray-500 mt-1 line-clamp-2">{subject.description?.substring(0, 50)}...</p> */}
        </motion.a>
    </Link>
);

// Компонент Лидерборда
const Leaderboard = ({ entries }: { entries: LeaderboardEntry[] }) => (
    <div className="bg-white rounded-xl shadow-md border border-gray-200 p-5 md:p-6">
        <h2 className="text-xl font-bold text-center text-indigo-700 mb-5 flex items-center justify-center gap-2">
            <Trophy className="w-6 h-6 text-yellow-500" />
            Доска Почета ВПР
        </h2>
        {entries.length === 0 ? (
            <p className="text-center text-gray-500 py-4">Пока никто не завершил тесты.</p>
        ) : (
            <ol className="space-y-3">
                {entries.map((entry, index) => (
                    <motion.li
                        key={entry.user_id}
                        className="flex items-center gap-3 p-2.5 bg-gray-50 rounded-lg border border-gray-100"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                    >
                        <span className={`font-bold text-lg w-6 text-center ${index < 3 ? 'text-yellow-600' : 'text-gray-500'}`}>
                            {index + 1}
                        </span>
                        <Image
                            src={entry.avatar_url || '/default-avatar.png'} // Замените на путь к аватару по умолчанию
                            alt={entry.username || 'Аноним'}
                            width={36}
                            height={36}
                            className="rounded-full border border-gray-300"
                        />
                        <span className="flex-grow font-medium text-gray-700 truncate">
                            {entry.username || `Ученик #${entry.user_id.substring(0, 4)}`}
                        </span>
                        <span className="font-bold text-indigo-600 bg-indigo-100 px-2 py-0.5 rounded-md text-sm">
                            {entry.total_score ?? 0} <span className="text-xs">очков</span>
                        </span>
                    </motion.li>
                ))}
            </ol>
        )}
    </div>
);


export default function VprTestsListPage() {
    const [subjects, setSubjects] = useState<Subject[]>([]);
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            setError(null);
            try {
                // 1. Fetch Subjects
                const { data: subjectsData, error: subjectsError } = await supabaseAdmin
                    .from('subjects')
                    .select('*')
                    .order('name', { ascending: true });

                if (subjectsError) throw subjectsError;
                setSubjects(subjectsData || []);

                // 2. Fetch Leaderboard Data
                // Используем RPC функцию для агрегации (нужно будет ее создать)
                const { data: leaderboardData, error: leaderboardError } = await supabaseAdmin
                     .rpc('get_vpr_leaderboard', { limit_count: 10 }); // Пример RPC вызова

                // // --- ИЛИ --- Прямой запрос с агрегацией (если нет RPC)
                // const { data: leaderboardAggData, error: leaderboardAggError } = await supabaseAdmin
                //     .from('vpr_test_attempts')
                //     .select(`
                //         score,
                //         users ( user_id, username, avatar_url )
                //     `)
                //     .neq('score', null) // Учитываем только завершенные с оценкой
                //     .is('completed_at', true) // Уточнение условия завершенности

                // // Агрегация на клиенте (менее эффективно для больших данных)
                // if (leaderboardAggError) throw leaderboardAggError;
                // const userScores: { [key: string]: LeaderboardEntry } = {};
                // leaderboardAggData?.forEach(attempt => {
                //     const user = attempt.users;
                //     if (!user) return;
                //     const userId = user.user_id;
                //     if (!userScores[userId]) {
                //         userScores[userId] = {
                //             user_id: userId,
                //             username: user.username,
                //             avatar_url: user.avatar_url,
                //             total_score: 0
                //         };
                //     }
                //     userScores[userId].total_score = (userScores[userId].total_score || 0) + (attempt.score || 0);
                // });
                // const leaderboardEntries = Object.values(userScores)
                //                              .sort((a, b) => (b.total_score || 0) - (a.total_score || 0))
                //                              .slice(0, 10); // Лимит на клиенте

                if (leaderboardError) throw leaderboardError;
                setLeaderboard((leaderboardData as LeaderboardEntry[]) || []);


            } catch (err: any) {
                debugLogger.error("Ошибка загрузки данных:", err);
                setError("Не удалось загрузить список тестов или лидерборд.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, []);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center">
                <Loader2 className="h-12 w-12 animate-spin text-indigo-600" />
                <span className="ml-4 text-lg text-gray-700">Загружаем тесты...</span>
            </div>
        );
    }

     if (error) {
         // Отображение ошибки
         return <div className="min-h-screen bg-gray-100 flex items-center justify-center text-red-600 p-5 text-center">{error}</div>;
     }

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-50 to-indigo-100 py-10 px-4 md:px-8">
            <div className="max-w-6xl mx-auto">
                <h1 className="text-3xl md:text-4xl font-bold text-center text-indigo-800 mb-8">
                    Тренажеры ВПР (6 класс)
                </h1>

                {/* Сетка предметов */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 md:gap-6 mb-10">
                    {subjects.map(subject => (
                        <SubjectCard key={subject.id} subject={subject} />
                    ))}
                </div>

                {/* Лидерборд */}
                 <Leaderboard entries={leaderboard} />

            </div>
        </div>
    );
}