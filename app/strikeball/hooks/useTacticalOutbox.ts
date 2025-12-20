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
    const queueRef = useRef<OutboxAction[]>([]); // Alibi: Ref for consistent loop checks

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

    // BURST_MODE: Flushes as many as possible in one handshake cycle
    const burstSync = useCallback(async (processFunc: (action: OutboxAction) => Promise<{success: boolean, error?: string}>) => {
        if (syncLock.current || queueRef.current.length === 0) return;
        
        syncLock.current = true;
        setIsSyncing(true);

        console.log(`[UPLINK] Буфер_Связи: ${queueRef.current.length} пакетов. Начало передачи.`);

        while (queueRef.current.length > 0) {
            const action = queueRef.current[0];
            try {
                const res = await processFunc(action);
                
                if (res.success) {
                    console.log(`[ACK] Пакет ${action.id} доставлен.`);
                    const updated = queueRef.current.slice(1);
                    updateQueue(updated);
                } else {
                    console.warn(`[NACK] Пакет ${action.id} отклонен: ${res.error}`);
                    // If server error is fatal (not network), discard to unblock queue
                    if (res.error && !res.error.includes('fetch')) {
                        updateQueue(queueRef.current.slice(1));
                    }
                    break; // Stop burst on network drop
                }
            } catch (e) {
                console.error("[UPLINK_FATAL] Потеря несущей частоты.");
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