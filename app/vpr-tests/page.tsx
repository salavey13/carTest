"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils"
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { supabaseAdmin } from "@/hooks/supabase";
import { debugLogger } from "@/lib/debugLogger";
import { 
  Loader2, Trophy, BookOpen, Info, 
  GraduationCap, Terminal, Calculator, 
  Cpu, Zap, ShieldCheck, Activity 
} from "lucide-react";
import { VibeContentRenderer } from "@/components/VibeContentRenderer"; 
import type { Database } from '@/types/database.types';
import { AdBreak } from "@/components/AdBreak";
import { Button } from "@/components/ui/button";


type Subject = Database['public']['Tables']['subjects']['Row'] & {
    grade_level?: number | null;
};
type LeaderboardEntry = {
    user_id: string;
    username: string | null;
    avatar_url: string | null;
    total_score: number | null;
};

const SubjectCard = ({ subject }: { subject: Subject }) => (
    <Link href={`/vpr-test/${subject.id}`} passHref legacyBehavior>
        <motion.a
            className="block bg-black rounded-xl border border-zinc-800 hover:border-brand-cyan/50 transition-all duration-300 overflow-hidden group p-6 relative"
            whileHover={{ scale: 1.02, backgroundColor: "rgba(0, 194, 255, 0.02)" }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
        >
            <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded bg-zinc-900 flex items-center justify-center border border-zinc-800 group-hover:border-brand-cyan group-hover:shadow-[0_0_15px_rgba(0,194,255,0.3)] transition-all">
                    <BookOpen className="w-6 h-6 text-zinc-600 group-hover:text-brand-cyan" />
                </div>
                <div className="text-left">
                    <h3 className="text-lg font-bold text-white group-hover:text-brand-cyan transition-colors">
                        {subject.name}
                    </h3>
                    <p className="text-[10px] text-zinc-600 font-mono uppercase tracking-widest">
                        Status: Operational // Lvl {subject.grade_level || 'X'}
                    </p>
                </div>
            </div>
        </motion.a>
    </Link>
);

export default function VprTestsListPage() {
    const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
    const [selectedGrade, setSelectedGrade] = useState<number>(8); // Default to our new "Gold"
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            setIsLoading(true);
            try {
                const { data: subjectsData } = await supabaseAdmin
                    .from('subjects')
                    .select('*')
                    .in('grade_level', [6, 7, 8])
                    .order('grade_level', { ascending: true });

                setAllSubjects(subjectsData as Subject[] || []);
                const { data: leaderboardData } = await supabaseAdmin.rpc('get_vpr_leaderboard', { limit_count: 5 });
                setLeaderboard((leaderboardData as LeaderboardEntry[]) || []);
            } catch (err) {
                debugLogger.error("Uplink Error:", err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchData();
    }, []);

    const displayedSubjects = useMemo(() => {
        return allSubjects.filter(subject => subject.grade_level === selectedGrade);
    }, [allSubjects, selectedGrade]);

    if (isLoading) return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center font-mono">
            <Loader2 className="h-10 w-10 animate-spin text-brand-cyan mb-4" />
            <span className="text-[10px] text-zinc-500 tracking-[0.4em] animate-pulse">RECONSTRUCTING_DATABASE_GRID...</span>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#000000] py-12 px-4 md:px-8 text-zinc-300 font-mono selection:bg-brand-cyan/30">
            <div className="max-w-6xl mx-auto relative">
                 
                 {/* 1. TACTICAL HEADER */}
                 <header className="text-center mb-16 border-b border-zinc-900 pb-10">
                     <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center gap-2 mb-4">
                        <Activity className="w-4 h-4 text-brand-green animate-pulse" />
                        <span className="text-[10px] text-zinc-500 font-bold tracking-[0.3em] uppercase">SYSTEM_ONLINE // COGNITIVE_ASSETS_V4.2</span>
                     </motion.div>
                     <h1 className="text-5xl md:text-7xl font-black text-white mb-4 tracking-tighter italic uppercase">
                        VPR_<span className="text-brand-cyan">MASTER</span>
                     </h1>
                     <p className="text-zinc-500 text-sm max-w-lg mx-auto uppercase tracking-tighter">
                        Тренажеры для подготовки к ВПР. <br/>Прокачка логики через реальные алгоритмы.
                     </p>
                 </header>

                 {/* 2. FREQUENCY SELECTOR (GRADES) */}
                 <div className="flex justify-center gap-2 mb-16 flex-wrap">
                     {[6, 7, 8].map((grade) => (
                         <button
                             key={grade}
                             onClick={() => setSelectedGrade(grade)}
                             className={cn(
                                 "px-10 py-3 font-black text-xs tracking-widest transition-all border-2 uppercase italic",
                                 selectedGrade === grade
                                     ? 'bg-brand-cyan text-black border-white shadow-[0_0_20px_rgba(0,194,255,0.4)]'
                                     : 'bg-black border-zinc-800 text-zinc-600 hover:border-zinc-500'
                             )}
                         >
                             Lvl_{grade}
                         </button>
                     ))}
                 </div>

                 {/* 3. CHEATSHEETS (The Trojan Horse) */}
                 <AnimatePresence mode="wait">
                    <motion.div
                        key={`grade-${selectedGrade}-cheats`}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 10 }}
                        className="mb-20"
                    >
                        <div className="p-1 bg-gradient-to-r from-zinc-800 via-brand-cyan/20 to-zinc-800 rounded-none">
                            <div className="bg-black p-8">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                                    <div className="flex items-center gap-3">
                                        <Terminal className="w-6 h-6 text-brand-cyan" />
                                        <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic">Protocols_Available // Lvl_{selectedGrade}</h2>
                                    </div>
                                    <div className="bg-zinc-900 border border-zinc-800 px-3 py-1 rounded text-[9px] text-zinc-500">
                                        Handshake: <span className="text-brand-green">ENCRYPTED</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                     {selectedGrade === 8 && (
                                         <Link href="/vpr/algebra/8/cheatsheet" className="group">
                                             <div className="p-4 border-2 border-dashed border-brand-cyan/30 bg-brand-cyan/5 hover:bg-brand-cyan/10 hover:border-brand-cyan transition-all cursor-pointer">
                                                 <div className="flex justify-between items-start mb-3">
                                                     <Calculator className="w-8 h-8 text-brand-cyan group-hover:scale-110 transition-transform" />
                                                     <Zap className="w-4 h-4 text-brand-yellow animate-pulse" />
                                                 </div>
                                                 <h4 className="font-black text-white uppercase italic text-lg mb-1">Algebra 8.0: Roots</h4>
                                                 <p className="text-[10px] text-zinc-500 leading-tight">Протокол извлечения корней. Дешифровка дискриминанта.</p>
                                             </div>
                                         </Link>
                                     )}
                                     
                                     {selectedGrade === 7 && (
                                         <Link href="/vpr/informatics/7/cheatsheet" className="group">
                                             <div className="p-4 border-2 border-dashed border-brand-green/30 bg-brand-green/5 hover:bg-brand-green/10 hover:border-brand-green transition-all cursor-pointer">
                                                 <div className="flex justify-between items-start mb-3">
                                                     <Terminal className="w-8 h-8 text-brand-green" />
                                                     <Activity className="w-4 h-4 text-brand-cyan" />
                                                 </div>
                                                 <h4 className="font-black text-white uppercase italic text-lg mb-1">Net Architect 7.0</h4>
                                                 <p className="text-[10px] text-zinc-500 leading-tight">Маршрутизация пакетов. Логика Эйлера.</p>
                                             </div>
                                         </Link>
                                     )}
                                     
                                     {/* Simple standard items for 6 */}
                                     {selectedGrade === 6 && ['History', 'Geo', 'Biology'].map(s => (
                                         <div key={s} className="p-4 border border-zinc-800 text-zinc-600 opacity-50 cursor-not-allowed">
                                             <div className="w-8 h-8 bg-zinc-900 rounded mb-3" />
                                             <h4 className="font-bold uppercase text-xs">Protocol: {s}</h4>
                                             <p className="text-[9px]">Awaiting Uplink...</p>
                                         </div>
                                     ))}
                                </div>
                                
                                {/* 4. THE RICKROLL MOMENT (Studio Mention) */}
                                <div className="mt-10 pt-6 border-t border-zinc-900 flex flex-col md:flex-row items-center justify-between gap-4">
                                    <div className="text-left">
                                        <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest mb-1">
                                            Built_with: <span className="text-brand-cyan">SuperVibe_Studio</span>
                                        </p>
                                        <p className="text-xs text-zinc-400 max-w-md">
                                            Эти страницы были созданы полностью через AI-Ассистента на мобильном телефоне. Мы не писали код. Мы просто "Вайбили".
                                        </p>
                                    </div>
                                    <Link href="/repo-xml">
                                        <Button className="bg-white text-black font-black uppercase italic px-6 py-4 rounded-none hover:bg-brand-cyan transition-all">
                                            Try_Vibe_Coding
                                        </Button>
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                 </AnimatePresence>

                {/* 5. MAIN MISSION GRID */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-20">
                    {displayedSubjects.length > 0 ? (
                         displayedSubjects.map(subject => (
                             <SubjectCard key={subject.id} subject={subject} />
                         ))
                     ) : (
                        <div className="col-span-full py-20 text-center border-2 border-dashed border-zinc-900 opacity-30 italic text-sm">
                            NO_MISSIONS_IN_THIS_SECTOR...
                        </div>
                     )}
                </div>

                <AdBreak/>

                {/* 6. LEADERBOARD (Hardened Styling) */}
                <div className="bg-zinc-950 border-t-2 border-zinc-800 p-8">
                    <h2 className="text-xl font-black text-white mb-8 flex items-center gap-3 uppercase italic">
                        <Trophy className="text-brand-gold w-6 h-6" /> Hall_Of_Fame // Top_Operators
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {leaderboard.map((entry, index) => (
                            <div key={index} className="flex items-center justify-between p-4 bg-black border border-zinc-900 group hover:border-brand-cyan transition-all">
                                <div className="flex items-center gap-4">
                                    <span className="text-zinc-700 font-black italic">#{index+1}</span>
                                    <div className="w-10 h-10 bg-zinc-900 border border-zinc-800 rounded flex items-center justify-center overflow-hidden">
                                        {entry.avatar_url ? <img src={entry.avatar_url} className="w-full h-full object-cover" /> : <Terminal className="w-4 h-4 text-zinc-700" />}
                                    </div>
                                    <div className="text-left">
                                        <div className="text-sm font-bold text-zinc-300 group-hover:text-white">{entry.username || 'ANON_OP'}</div>
                                        <div className="text-[9px] text-zinc-700 uppercase">Deployed</div>
                                    </div>
                                </div>
                                <div className="text-brand-cyan font-black text-sm">{entry.total_score} XP</div>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
}