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

    // Initialize from LocalStorage
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

        // Burst Mode: Process all packets in one loop if network is fast
        while (queueRef.current.length > 0) {
            const action = queueRef.current[0];
            console.log(`[HANDSHAKE] Отправка пакета ${action.type} (UID: ${action.id})`);
            
            try {
                const res = await processFunc(action);
                
                if (res.success) {
                    console.log(`[ACK] Пакет ${action.id} доставлен.`);
                    const updated = queueRef.current.slice(1);
                    updateQueue(updated);
                } else {
                    console.error(`[NACK] Пакет ${action.id} отклонен:`, res.error);
                    // If it's a logic error (not network), drop it to unblock the queue
                    if (res.error && !res.error.includes('fetch')) {
                        updateQueue(queueRef.current.slice(1));
                    }
                    break; // Stop burst on network error
                }
            } catch (e) {
                console.error(`[UPLINK_FATAL] Ошибка соединения при передаче ${action.id}`);
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
        console.log(`[QUEUE] Добавлен пакет: ${newAction.id}`);
        updateQueue([...queueRef.current, newAction]);
    }, []);

    return { queue, addToOutbox, burstSync, isSyncing };
}