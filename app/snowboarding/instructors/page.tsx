"use client";

import React, { useEffect, useState } from "react";
import { getSnowboardInstructors } from "../actions";
import { FaPersonSkiing, FaMapLocationDot, FaClock, FaPhone, FaStar } from "react-icons/fa6";
import { cn } from "@/lib/utils";
import Link from "next/link";
import Image from "next/image";

export default function SnowboardInstructorsPage() {
    const [instructors, setInstructors] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        getSnowboardInstructors().then(res => {
            if (res.success) setInstructors(res.data);
            setLoading(false);
        });
    }, []);

    if (loading) return (
        <div className="pt-28 pb-32 px-4 min-h-screen text-white font-orbitron">
            <div className="max-w-4xl mx-auto">
                <div className="p-8 text-center">
                    <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
                    <p className="mt-4 text-zinc-400">Загрузка инструкторов...</p>
                </div>
            </div>
        </div>
    );

    return (
        <div className="pt-28 pb-32 px-4 min-h-screen text-white font-orbitron">
            <div className="max-w-4xl mx-auto">
                <div className="text-center mb-10">
                    <h1 className="text-4xl font-black text-blue-400 tracking-tighter uppercase drop-shadow-lg">
                        СНОУБОРД-ИНСТРУКТОРЫ
                    </h1>
                    <p className="text-sm font-mono text-zinc-500 mt-2">
                        Найдите идеального инструктора для обучения катанию на сноуборде
                    </p>
                </div>

                <div className="space-y-6">
                    {instructors.map(instructor => (
                        <div key={instructor.id} className="bg-zinc-900/80 border border-zinc-800 p-6 flex gap-6 hover:border-blue-500/50 transition-colors">
                            <div className="w-24 h-24 bg-zinc-800 border border-zinc-700 relative flex-shrink-0">
                                {instructor.logo_url ? (
                                    <Image src={instructor.logo_url} alt={instructor.name} fill className="object-cover" />
                                ) : (
                                    <div className="flex items-center justify-center h-full text-zinc-700">
                                        <FaPersonSkiing className="text-3xl" />
                                    </div>
                                )}
                            </div>
                            
                            <div className="flex-1">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h2 className="text-2xl font-bold text-white">{instructor.name}</h2>
                                        <div className="flex items-center gap-1 mt-1">
                                            {[...Array(5)].map((_, i) => (
                                                <FaStar key={i} className={cn(i < instructor.rating ? "text-yellow-500" : "text-zinc-700")} />
                                            ))}
                                            <span className="text-sm text-zinc-500 ml-2">({instructor.reviews || 0} отзывов)</span>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-lg font-black text-blue-400">
                                            от {instructor.min_price} ₽/час
                                        </div>
                                        <div className="text-xs text-zinc-500">
                                            {instructor.experience} опыта
                                        </div>
                                    </div>
                                </div>
                                
                                <p className="text-zinc-400 mt-3 text-sm">{instructor.description}</p>
                                
                                <div className="flex items-center gap-4 mt-4 text-xs text-zinc-500">
                                    <span className="flex items-center gap-1">
                                        <FaMapLocationDot /> {instructor.location}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <FaClock /> {instructor.working_hours}
                                    </span>
                                    {instructor.contacts?.primary_phone && (
                                        <span className="flex items-center gap-1">
                                            <FaPhone /> {instructor.contacts.primary_phone}
                                        </span>
                                    )}
                                </div>
                                
                                <div className="flex gap-2 mt-4">
                                    <Link 
                                        href={`/crews/${instructor.slug}`}
                                        className="px-4 py-2 bg-blue-600 text-white text-xs font-black uppercase tracking-wider hover:bg-blue-500 transition-colors"
                                    >
                                        Посмотреть профиль
                                    </Link>
                                    <button className="px-4 py-2 border border-zinc-700 text-zinc-400 text-xs font-black uppercase tracking-wider hover:text-white hover:border-zinc-600 transition-colors">
                                        Записаться на урок
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
                
                {instructors.length === 0 && (
                    <div className="text-center py-12">
                        <FaPersonSkiing className="text-6xl text-zinc-800 mx-auto mb-4" />
                        <p className="text-zinc-500">Инструкторы не найдены</p>
                        <p className="text-zinc-600 text-sm mt-2">
                            Станьте первым инструктором на нашей платформе!
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}