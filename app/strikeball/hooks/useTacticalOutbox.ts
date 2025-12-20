"use client";

import { useState, useEffect, useCallback, useRef } from 'react';

type OutboxAction = {
    id: string;
    type: 'HIT' | 'RESPAWN' | 'CAPTURE' | 'BASE_INTERACT';
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
        
        console.log(`[UPLINK] Синхронизация... Пакетов: ${queueRef.current.length}`);

        // Используем локальную копию для управления циклом во избежание Race Condition
        let currentQueue = [...queueRef.current];

        while (currentQueue.length > 0) {
            const action = currentQueue[0];
            try {
                const res = await processFunc(action);
                if (res.success) {
                    console.log(`[ACK] Пакет ${action.id} подтвержден.`);
                    currentQueue.shift();
                    updateQueue([...currentQueue]); // Обновляем состояние и Ref
                } else {
                    console.warn(`[NACK] Пакет ${action.id} отклонен: ${res.error}`);
                    if (res.error && !res.error.includes('fetch')) {
                        currentQueue.shift();
                        updateQueue([...currentQueue]);
                        continue;
                    }
                    break; 
                }
            } catch (e) {
                console.error("[UPLINK_ERROR] Сбой канала.");
                break;
            }
        }

        setIsSyncing(false);
        syncLock.current = false;
    }, []);

    const addToOutbox = useCallback((type: OutboxAction['type'], payload: any) => {
        const newAction: OutboxAction = {
            id: Math.random().toString(36).substring(7).toUpperCase(),
            type, payload, timestamp: Date.now()
        };
        updateQueue([...queueRef.current, newAction]);
    }, []);

    return { queue, addToOutbox, burstSync, isSyncing };
}