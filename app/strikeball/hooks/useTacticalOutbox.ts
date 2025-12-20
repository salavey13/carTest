"use client";

import { useState, useEffect, useCallback, useRef } from 'react';

type OutboxAction = {
    id: string;
    type: 'HIT' | 'RESPAWN' | 'CAPTURE';
    payload: any;
    timestamp: number;
    attempts: number;
};

export function useTacticalOutbox() {
    const [queue, setQueue] = useState<OutboxAction[]>([]);
    const [isSyncing, setIsSyncing] = useState(false);
    const syncLock = useRef(false);
    
    // Alibi: Ref-based queue to avoid dependency-looping the sync logic
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

    // BURST_SYNC: Recursively clears the queue as fast as the network allows
    const burstSync = useCallback(async (processFunc: (action: OutboxAction) => Promise<{success: boolean, error?: string}>) => {
        if (syncLock.current || queueRef.current.length === 0) return;
        
        syncLock.current = true;
        setIsSyncing(true);

        while (queueRef.current.length > 0) {
            const action = queueRef.current[0];
            try {
                const res = await processFunc(action);
                
                if (res.success || (res.error && !res.error.includes('fetch'))) {
                    // Success or Server-side rejection: Remove from queue
                    const updated = queueRef.current.slice(1);
                    updateQueue(updated);
                } else {
                    // Network Failure (2G pit): Stop burst and wait for next heartbeat
                    break; 
                }
            } catch (e) {
                console.error("[Watchdog] Uplink Error:", e);
                break;
            }
        }

        setIsSyncing(false);
        syncLock.current = false;
    }, []);

    const addToOutbox = useCallback((type: OutboxAction['type'], payload: any) => {
        const newAction: OutboxAction = {
            id: Math.random().toString(36).substring(7),
            type, payload, timestamp: Date.now(), attempts: 0
        };
        updateQueue([...queueRef.current, newAction]);
    }, []);

    return { queue, addToOutbox, burstSync, isSyncing };
}