"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';

interface TimerDisplayProps {
    initialTime: number; // Время в секундах
    onTimeUp: () => void; // Колбэк при истечении времени
    isRunning: boolean;   // Запущен ли таймер
}

const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
};

export const TimerDisplay = ({ initialTime, onTimeUp, isRunning }: TimerDisplayProps) => {
    const [timeLeft, setTimeLeft] = useState(initialTime);

    useEffect(() => {
        setTimeLeft(initialTime); // Сброс при изменении initialTime (например, новый тест)
    }, [initialTime]);

    useEffect(() => {
        if (!isRunning || timeLeft <= 0) {
            return; // Не запускаем интервал, если не нужно или время вышло
        }

        const timerInterval = setInterval(() => {
            setTimeLeft((prevTime) => {
                if (prevTime <= 1) {
                    clearInterval(timerInterval);
                    onTimeUp(); // Время вышло
                    return 0;
                }
                return prevTime - 1;
            });
        }, 1000);

        // Очистка интервала при размонтировании или остановке
        return () => clearInterval(timerInterval);
    }, [isRunning, timeLeft, onTimeUp]);

    const timePercentage = initialTime > 0 ? (timeLeft / initialTime) * 100 : 0; // Avoid division by zero
    const colorClass = timeLeft < 10 ? 'text-red-500' : timeLeft < 30 ? 'text-yellow-500' : 'text-accent-text'; // Используем accent-text из конфига

    return (
        <motion.div
            className={`flex items-center justify-center gap-2 font-mono px-3 py-1.5 rounded-full border bg-dark-card/50 backdrop-blur-sm shadow-md ${timeLeft < 10 ? 'border-red-500/50' : 'border-brand-blue/30'}`}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.5 }} // Появляется чуть позже
        >
            <Clock className={`w-4 h-4 ${colorClass}`} />
            <span className={`text-sm font-semibold ${colorClass}`}>
                {formatTime(timeLeft)}
            </span>
            {/* Индикатор оставшегося времени */}
            <div className="w-10 h-1 bg-gray-600 rounded-full overflow-hidden ml-1">
                 <motion.div
                     className={`h-full rounded-full ${timeLeft < 10 ? 'bg-red-500' : timeLeft < 30 ? 'bg-yellow-500' : 'bg-brand-green'}`}
                     initial={{ width: '100%' }}
                     animate={{ width: `${timePercentage}%` }}
                     transition={{ duration: 0.5 }}
                 />
            </div>
        </motion.div>
    );
};