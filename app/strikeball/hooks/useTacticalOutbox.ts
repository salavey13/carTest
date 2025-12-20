"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';

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

    useEffect(() => {
        const saved = localStorage.getItem('tactical_outbox');
        if (saved) setQueue(JSON.parse(saved));
    }, []);

    useEffect(() => {
        localStorage.setItem('tactical_outbox', JSON.stringify(queue));
    }, [queue]);

    const addToOutbox = useCallback((type: OutboxAction['type'], payload: any) => {
        const newAction: OutboxAction = {
            id: Math.random().toString(36).substring(7),
            type,
            payload,
            timestamp: Date.now(),
            attempts: 0
        };
        setQueue(prev => [...prev, newAction]);
    }, []);

    const flushQueue = useCallback(async (processFunc: (action: OutboxAction) => Promise<{success: boolean, error?: string}>) => {
        if (queue.length === 0 || syncLock.current) return;
        
        syncLock.current = true;
        setIsSyncing(true);
        
        const action = queue[0];

        try {
            const res = await processFunc(action);
            
            // If server responds (even with error), we remove it to unblock the queue
            // Unless it's a specific "Retry later" error
            if (res.success || (res.error && !res.error.includes('fetch'))) {
                setQueue(prev => prev.slice(1));
                if (!res.success) console.error(`[Outbox] Action ${action.type} rejected by server:`, res.error);
            } else {
                // Network failure - move to back of queue to try others or just wait
                setQueue(prev => {
                    const updated = [...prev];
                    const item = updated.shift()!;
                    item.attempts += 1;
                    return [...updated, item];
                });
            }
        } catch (e) {
            console.error("[Outbox] Fatal sync error:", e);
        } finally {
            setIsSyncing(false);
            syncLock.current = false;
        }
    }, [queue]);

    return { queue, addToOutbox, flushQueue, isSyncing };
}