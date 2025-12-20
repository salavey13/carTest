"use client";

import { useState, useEffect, useCallback, useRef } from 'react';

type OutboxAction = {
    id: string;
    type: 'HIT' | 'RESPAWN' | 'CAPTURE';
    payload: any;
    timestamp: number;
};

export function useTacticalOutbox() {
    const [queue, setQueue] = useState<OutboxAction[]>([]);
    const [isSyncing, setIsSyncing] = useState(false);
    const syncLock = useRef(false);
    const queueRef = useRef<OutboxAction[]>([]);

    useEffect(() => {
        const saved = localStorage.getItem('tactical_outbox');
        if (saved) {
            const parsed = JSON.parse(saved);
            setQueue(parsed);
            queueRef.current = parsed;
            console.log(`[UPLINK] Реконструкция очереди: ${parsed.length} пакетов.`);
        }
    }, []);

    const updateQueue = (newQueue: OutboxAction[]) => {
        setQueue(newQueue);
        queueRef.current = newQueue;
        localStorage.setItem('tactical_outbox', JSON.stringify(newQueue));
    };

    const burstSync = useCallback(async (processFunc: (action: OutboxAction) => Promise<{success: boolean, error?: string}>) => {
        if (syncLock.current || queueRef.current.length === 0) return;
        
        syncLock.current = true;
        setIsSyncing(true);
        console.log(`[UPLINK] Начало передачи пакетов. Буфер: ${queueRef.current.length}`);

        while (queueRef.current.length > 0) {
            const action = queueRef.current[0];
            console.log(`[HANDSHAKE] Отправка пакета ${action.type} (UID: ${action.id})`);
            
            try {
                const res = await processFunc(action);
                
                if (res.success) {
                    console.log(`[ACK] Пакет ${action.id} доставлен успешно.`);
                    const updated = queueRef.current.slice(1);
                    updateQueue(updated);
                } else {
                    console.error(`[NACK] Сервер отклонил пакет ${action.id}:`, res.error);
                    // Если это не ошибка сети, удаляем "битый" пакет, чтобы не вешать очередь
                    if (res.error && !res.error.includes('fetch')) {
                        updateQueue(queueRef.current.slice(1));
                    }
                    break; // Прерываем цикл для повтора позже
                }
            } catch (e) {
                console.error(`[UPLINK_FATAL] Ошибка соединения при передаче ${action.id}`);
                break;
            }
        }

        console.log(`[UPLINK] Передача завершена. Осталось в буфере: ${queueRef.current.length}`);
        setIsSyncing(false);
        syncLock.current = false;
    }, []);

    const addToOutbox = useCallback((type: OutboxAction['type'], payload: any) => {
        const newAction: OutboxAction = {
            id: Math.random().toString(36).substring(7).toUpperCase(),
            type, payload, timestamp: Date.now()
        };
        console.log(`[QUEUE] Добавлен новый пакет: ${newAction.id} (${type})`);
        updateQueue([...queueRef.current, newAction]);
    }, []);

    return { queue, addToOutbox, burstSync, isSyncing };
}