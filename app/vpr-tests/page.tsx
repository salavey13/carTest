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
  Cpu, Zap, ShieldCheck, Activity,
  Map as MapIcon, Leaf, Bug, Atom, Ruler,
  Globe, Landmark, ChevronRight, Hash
} from "lucide-react";
import { VibeContentRenderer } from "@/components/VibeContentRenderer"; 
import type { Database } from '@/types/database.types';
import { AdBreak } from "@/components/AdBreak";

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

const CheatItem = ({ href, icon: Icon, title, desc, colorClass, status = "Ready" }: any) => (
    <Link href={href} className="group">
        <div className={cn(
            "p-4 border-2 border-dashed transition-all cursor-pointer h-full flex flex-col",
            colorClass.border, colorClass.bg, colorClass.hoverBorder
        )}>
            <div className="flex justify-between items-start mb-3">
                <Icon className={cn("w-8 h-8 transition-transform group-hover:scale-110", colorClass.text)} />
                <span className="text-[8px] font-mono text-zinc-600 uppercase tracking-tighter">Sig_Status: {status}</span>
            </div>
            <h4 className="font-black text-white uppercase italic text-sm mb-1">{title}</h4>
            <p className="text-[9px] text-zinc-500 leading-tight flex-grow">{desc}</p>
        </div>
    </Link>
);

export default function VprTestsListPage() {
    const [allSubjects, setAllSubjects] = useState<Subject[]>([]);
    const [selectedGrade, setSelectedGrade] = useState<number>(8); 
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
            <span className="text-[10px] text-zinc-500 tracking-[0.4em] animate-pulse">SYNCHRONIZING_COGNITIVE_GRID...</span>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#000000] py-12 px-4 md:px-8 text-zinc-300 font-mono selection:bg-brand-cyan/30">
            <div className="max-w-6xl mx-auto relative">
                 
                 <header className="text-center mb-16 border-b border-zinc-900 pb-10">
                     <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center justify-center gap-2 mb-4">
                        <Activity className="w-4 h-4 text-brand-green animate-pulse" />
                        <span className="text-[10px] text-zinc-500 font-bold tracking-[0.3em] uppercase">ACCESS_LEVEL: GRANTED // VPR_PROTOCOL_v4.5</span>
                     </motion.div>
                     <h1 className="text-5xl md:text-8xl font-black text-white mb-4 tracking-tighter italic uppercase">
                        VPR_<span className="text-brand-cyan">CORE</span>
                     </h1>
                     <p className="text-zinc-500 text-sm max-w-lg mx-auto uppercase tracking-tighter">
                        Тренажеры когнитивной подготовки. <br/>Прошивка знаний для успешного деплоя в класс.
                     </p>
                 </header>

                 {/* GRADE SELECTOR */}
                 <div className="flex justify-center gap-2 mb-16 flex-wrap">
                     {[6, 7, 8].map((grade) => (
                         <button
                             key={grade}
                             onClick={() => setSelectedGrade(grade)}
                             className={cn(
                                 "px-10 py-3 font-black text-xs tracking-widest transition-all border-2 uppercase italic",
                                 selectedGrade === grade
                                     ? 'bg-brand-cyan text-black border-white shadow-[0_0_25px_rgba(0,194,255,0.4)]'
                                     : 'bg-black border-zinc-800 text-zinc-600 hover:border-zinc-500'
                             )}
                         >
                             LVL_{grade}
                         </button>
                     ))}
                 </div>

                 {/* CHEATSHEETS SECTION */}
                 <AnimatePresence mode="wait">
                    <motion.div
                        key={`grade-${selectedGrade}-cheats`}
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 1.02 }}
                        className="mb-20"
                    >
                        <div className="p-px bg-gradient-to-r from-zinc-800 via-brand-cyan/40 to-zinc-800 rounded-none shadow-[0_0_50px_rgba(0,0,0,1)]">
                            <div className="bg-black p-6 md:p-10">
                                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                                    <div className="flex items-center gap-3">
                                        <Terminal className="w-8 h-8 text-brand-cyan" />
                                        <h2 className="text-3xl font-black text-white uppercase tracking-tighter italic">Intelligence_Drops // Lvl_{selectedGrade}</h2>
                                    </div>
                                    <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-4 py-1 rounded text-[10px] text-zinc-500 uppercase">
                                        Encryption: <span className="text-brand-green font-bold">ACTIVE</span>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                                     {/* GRADE 8 DROPS */}
                                     {selectedGrade === 8 && (
                                         <CheatItem 
                                            href="/vpr/algebra/8/cheatsheet" 
                                            icon={Calculator} 
                                            title="Algebra 8.0: Roots"
                                            desc="Дешифровка дискриминанта. Протокол извлечения квадратных корней."
                                            colorClass={{ border: 'border-brand-cyan/30', bg: 'bg-brand-cyan/5', text: 'text-brand-cyan', hoverBorder: 'hover:border-brand-cyan' }}
                                         />
                                     )}
                                     
                                     {/* GRADE 7 DROPS */}
                                     {selectedGrade === 7 && (
                                         <>
                                            <CheatItem 
                                                href="/vpr/informatics/7/cheatsheet" icon={Terminal} title="Net Architect 7.0"
                                                desc="Маршрутизация пакетов. Логические круги Эйлера."
                                                colorClass={{ border: 'border-brand-green/30', bg: 'bg-brand-green/5', text: 'text-brand-green', hoverBorder: 'hover:border-brand-green' }}
                                            />
                                            <CheatItem 
                                                href="/vpr/biology/7/cheatsheet" icon={Bug} title="Bio_Scanner: Zoology"
                                                desc="Анализ многоклеточных систем. Реестр видов."
                                                colorClass={{ border: 'border-emerald-500/30', bg: 'bg-emerald-500/5', text: 'text-emerald-500', hoverBorder: 'hover:border-emerald-500' }}
                                            />
                                            <CheatItem 
                                                href="/vpr/algebra/7/cheatsheet" icon={Hash} title="Algebra_7: Functions"
                                                desc="Линейные зависимости. Графический синтаксис."
                                                colorClass={{ border: 'border-brand-blue/30', bg: 'bg-brand-blue/5', text: 'text-brand-blue', hoverBorder: 'hover:border-brand-blue' }}
                                            />
                                            <CheatItem 
                                                href="/vpr/physics/7/cheatsheet" icon={Atom} title="Physics: Gravity_Lab"
                                                desc="Законы механики. Плотность и давление."
                                                colorClass={{ border: 'border-brand-orange/30', bg: 'bg-brand-orange/5', text: 'text-brand-orange', hoverBorder: 'hover:border-brand-orange' }}
                                            />
                                            <CheatItem 
                                                href="/vpr/history/7/cheatsheet" icon={Landmark} title="Mechanics of Lies"
                                                desc="XX век. Анализ пропаганды и исторических цепочек."
                                                colorClass={{ border: 'border-brand-gold/30', bg: 'bg-brand-gold/5', text: 'text-brand-gold', hoverBorder: 'hover:border-brand-gold' }}
                                            />
                                         </>
                                     )}
                                     
                                     {/* GRADE 6 DROPS */}
                                     {selectedGrade === 6 && (
                                         <>
                                            <CheatItem 
                                                href="/vpr/history/6/cheatsheet" icon={Landmark} title="History_6: Archive"
                                                desc="Средневековые протоколы. Хроники государств."
                                                colorClass={{ border: 'border-brand-blue/30', bg: 'bg-brand-blue/5', text: 'text-brand-blue', hoverBorder: 'hover:border-brand-blue' }}
                                            />
                                            <CheatItem 
                                                href="/vpr/geography/6/cheatsheet" icon={MapIcon} title="Geo_Grid: Planet"
                                                desc="Картография. Масштабирование и координаты."
                                                colorClass={{ border: 'border-teal-500/30', bg: 'bg-teal-500/5', text: 'text-teal-500', hoverBorder: 'hover:border-teal-500' }}
                                            />
                                            <CheatItem 
                                                href="/vpr/biology/6/cheatsheet" icon={Leaf} title="Biology_6: Flora"
                                                desc="Ботанический код. Системы жизнеобеспечения растений."
                                                colorClass={{ border: 'border-brand-green/30', bg: 'bg-brand-green/5', text: 'text-brand-green', hoverBorder: 'hover:border-brand-green' }}
                                            />
                                         </>
                                     )}
                                </div>
                                
                                {/* THE RICKROLL / STUDIO CONVERSION */}
                                <div className="mt-12 pt-8 border-t border-zinc-900 flex flex-col lg:flex-row items-center justify-between gap-8">
                                    <div className="text-center lg:text-left">
                                        <p className="text-[10px] text-zinc-600 font-black uppercase tracking-[0.3em] mb-2 flex items-center justify-center lg:justify-start gap-2">
                                            <Zap className="w-3 h-3 text-brand-cyan" /> Engineering_Origin: <span className="text-white">SuperVibe_Studio</span>
                                        </p>
                                        <p className="text-xs text-zinc-500 max-w-xl leading-relaxed">
                                            Все эти протоколы были сгенерированы AI-Ассистентом на обычном смартфоне. Мы не тратили месяцы на разработку — мы просто "Вайбили". Твоя математика — это база для такого софта.
                                        </p>
                                    </div>
                                    <Link href="/repo-xml">
                                        <Button className="w-full sm:w-auto bg-white text-black font-black uppercase italic px-12 py-8 rounded-none hover:bg-brand-cyan transition-all shadow-[8px_8px_0_rgba(0,194,255,0.4)] hover:shadow-none hover:translate-x-1 hover:translate-y-1">
                                            Start_Vibe_Coding <ChevronRight className="ml-2 w-5 h-5" />
                                        </Button>
                                    </Link>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                 </AnimatePresence>

                {/* MAIN MISSION GRID */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-20">
                    {displayedSubjects.length > 0 ? (
                         displayedSubjects.map(subject => (
                             <SubjectCard key={subject.id} subject={subject} />
                         ))
                     ) : (
                        <div className="col-span-full py-24 text-center border-2 border-dashed border-zinc-900 rounded-xl">
                            <GraduationCap className="w-12 h-12 text-zinc-800 mx-auto mb-4" />
                            <p className="text-zinc-600 font-mono text-sm uppercase tracking-widest">
                                NO_ACTIVE_MISSIONS_FOUND_FOR_LVL_{selectedGrade}
                            </p>
                        </div>
                     )}
                </div>

                <AdBreak/>

                {/* LEADERBOARD */}
                <div className="bg-zinc-950 border-t-2 border-zinc-800 p-8 mb-20">
                    <h2 className="text-2xl font-black text-white mb-10 flex items-center gap-4 uppercase italic">
                        <Trophy className="text-brand-gold w-8 h-8" /> Operator_Leaderboard // Top_XP
                    </h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {leaderboard.map((entry, index) => (
                            <div key={index} className="flex items-center justify-between p-5 bg-black border border-zinc-900 hover:border-brand-cyan/40 transition-all group">
                                <div className="flex items-center gap-5">
                                    <span className="text-zinc-800 font-black italic text-xl">#{index+1}</span>
                                    <div className="w-12 h-12 bg-zinc-900 border border-zinc-800 rounded-none flex items-center justify-center overflow-hidden grayscale group-hover:grayscale-0 transition-all">
                                        {entry.avatar_url ? <img src={entry.avatar_url} className="w-full h-full object-cover" /> : <Terminal className="w-5 h-5 text-zinc-700" />}
                                    </div>
                                    <div className="text-left">
                                        <div className="text-base font-bold text-zinc-400 group-hover:text-white transition-colors">{entry.username || 'ANON_OPERATOR'}</div>
                                        <div className="text-[8px] text-zinc-700 font-mono uppercase tracking-widest">Sector_Active</div>
                                    </div>
                                </div>
                                <div className="text-brand-cyan font-black text-lg tabular-nums">{entry.total_score} <span className="text-[10px] text-zinc-600">XP</span></div>
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
}