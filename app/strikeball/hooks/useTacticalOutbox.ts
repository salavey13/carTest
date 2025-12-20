"use client";

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

type OutboxAction = {
    id: string;
    type: 'HIT' | 'RESPAWN' | 'CAPTURE';
    payload: any;
    timestamp: number;
};

export function useTacticalOutbox() {
    const [queue, setQueue] = useState<OutboxAction[]>([]);
    const [isSyncing, setIsSyncing] = useState(false);

    // Load from LocalStorage on mount (Persistence Alibi)
    useEffect(() => {
        const saved = localStorage.getItem('tactical_outbox');
        if (saved) setQueue(JSON.parse(saved));
    }, []);

    // Save to LocalStorage on change
    useEffect(() => {
        localStorage.setItem('tactical_outbox', JSON.stringify(queue));
    }, [queue]);

    const addToOutbox = useCallback((type: OutboxAction['type'], payload: any) => {
        const newAction: OutboxAction = {
            id: Math.random().toString(36).substring(7),
            type,
            payload,
            timestamp: Date.now()
        };
        setQueue(prev => [...prev, newAction]);
        return newAction.id;
    }, []);

    const flushQueue = useCallback(async (processFunc: (action: OutboxAction) => Promise<{success: boolean}>) => {
        if (queue.length === 0 || isSyncing) return;
        
        setIsSyncing(true);
        const action = queue[0];

        try {
            const res = await processFunc(action);
            if (res.success) {
                setQueue(prev => prev.filter(a => a.id !== action.id));
                // toast.success(`SIGNAL_SYNCED: ${action.type}`);
            }
        } catch (e) {
            console.warn("Sync failed, retrying in next cycle...", e);
        } finally {
            setIsSyncing(false);
        }
    }, [queue, isSyncing]);

    return { queue, addToOutbox, flushQueue, isSyncing };
}