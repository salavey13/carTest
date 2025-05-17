"use client";

import { useEffect, useRef, useCallback } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { useAppContext } from '@/contexts/AppContext';
import { logCyberFitnessAction } from './cyberFitnessSupabase';
import useInactivityTimer from './useInactivityTimer';
import { debugLogger as logger } from '@/lib/debugLogger';

const MIN_FOCUS_SESSION_MS = 30 * 1000; // 30 seconds to count as a focus block
const FOCUS_LOG_INTERVAL_MS = 5 * 60 * 1000; // Log accumulated focus time every 5 minutes if continuously active

interface UseFocusTimeTrackerProps {
    inactiveTimeout: number; // Timeout to consider user inactive
    componentName?: string;
    enabled?: boolean; // Allow enabling/disabling the tracker
}

export const useFocusTimeTracker = ({
    inactiveTimeout,
    componentName = "FocusTracker",
    enabled = true,
}: UseFocusTimeTrackerProps) => {
    const { dbUser } = useAppContext();
    const activityStartTimeRef = useRef<number | null>(null);
    const accumulatedFocusTimeMsRef = useRef<number>(0);

    const logAccumulatedFocusTime = useCallback(async (isUnload: boolean = false) => {
        if (!dbUser?.user_id || accumulatedFocusTimeMsRef.current < MIN_FOCUS_SESSION_MS) {
            if (accumulatedFocusTimeMsRef.current > 0 && accumulatedFocusTimeMsRef.current < MIN_FOCUS_SESSION_MS && dbUser?.user_id) {
                logger.log(`[FocusTimeTracker - ${componentName}] Accumulated focus time (${accumulatedFocusTimeMsRef.current}ms) for user ${dbUser.user_id} is less than minimum (${MIN_FOCUS_SESSION_MS}ms). Not logging. Resetting.`);
            }
            accumulatedFocusTimeMsRef.current = 0; 
            return;
        }

        const minutesToLog = Math.floor(accumulatedFocusTimeMsRef.current / (60 * 1000));
        if (minutesToLog > 0) {
            logger.log(`[FocusTimeTracker - ${componentName}] Logging ${minutesToLog} minutes of focus time for user ${dbUser.user_id}. Is unload: ${isUnload}`);
            try {
                await logCyberFitnessAction(dbUser.user_id, 'focusTimeAdded', { minutes: minutesToLog });
                accumulatedFocusTimeMsRef.current -= minutesToLog * 60 * 1000; 
                logger.info(`[FocusTimeTracker - ${componentName}] Successfully logged ${minutesToLog} focus minutes. Remaining accumulated: ${accumulatedFocusTimeMsRef.current}ms`);
            } catch (error) {
                logger.error(`[FocusTimeTracker - ${componentName}] Error logging focus time:`, error);
            }
        } else {
            logger.log(`[FocusTimeTracker - ${componentName}] Not enough accumulated minutes to log (less than 1 minute). Accumulated: ${accumulatedFocusTimeMsRef.current}ms`);
        }
    }, [dbUser?.user_id, componentName]);

    const debouncedLogFocusTime = useDebouncedCallback(
        // Purposefully not including logAccumulatedFocusTime in deps, it's called directly.
        // The debounced function itself doesn't change, its execution calls the latest logAccumulatedFocusTime.
        () => logAccumulatedFocusTime(false),
        FOCUS_LOG_INTERVAL_MS,
        { leading: false, trailing: true }
    );

    const handleBecameInactive = useCallback(() => {
        if (activityStartTimeRef.current) {
            const sessionDuration = Date.now() - activityStartTimeRef.current;
            if (sessionDuration >= MIN_FOCUS_SESSION_MS) {
                accumulatedFocusTimeMsRef.current += sessionDuration;
                logger.log(`[FocusTimeTracker - ${componentName}] User became inactive. Active session duration: ${sessionDuration}ms. Total accumulated: ${accumulatedFocusTimeMsRef.current}ms`);
                debouncedLogFocusTime();
            } else {
                logger.log(`[FocusTimeTracker - ${componentName}] User became inactive. Active session (${sessionDuration}ms) too short. Not added to accumulation.`);
            }
            activityStartTimeRef.current = null;
        }
    }, [componentName, debouncedLogFocusTime]); // debouncedLogFocusTime is stable

    const handleBecameActive = useCallback(() => {
        if (!activityStartTimeRef.current) {
            activityStartTimeRef.current = Date.now();
            logger.log(`[FocusTimeTracker - ${componentName}] User became active. Session started at ${new Date(activityStartTimeRef.current).toLocaleTimeString()}`);
        }
    }, [componentName]);

    useInactivityTimer(
        enabled ? inactiveTimeout : 0, 
        handleBecameInactive,
        handleBecameActive,
        componentName
    );
    
    const handleVisibilityChange = useCallback(() => {
        if (document.visibilityState === 'hidden') {
            logger.log(`[FocusTimeTracker - ${componentName}] Tab became hidden.`);
            if (activityStartTimeRef.current) {
                const sessionDuration = Date.now() - activityStartTimeRef.current;
                 if (sessionDuration >= MIN_FOCUS_SESSION_MS / 2 ) { 
                    accumulatedFocusTimeMsRef.current += sessionDuration;
                     logger.log(`[FocusTimeTracker - ${componentName}] Tab hidden during active session. Duration: ${sessionDuration}ms. Total accumulated: ${accumulatedFocusTimeMsRef.current}ms`);
                     logAccumulatedFocusTime(true); 
                 } else {
                    logger.log(`[FocusTimeTracker - ${componentName}] Tab hidden, active session too short (${sessionDuration}ms) to accumulate.`);
                 }
                activityStartTimeRef.current = null; 
            } else {
                 if(accumulatedFocusTimeMsRef.current > 0 && dbUser?.user_id) { 
                    logAccumulatedFocusTime(true); 
                 }
            }
        } else if (document.visibilityState === 'visible') {
            logger.log(`[FocusTimeTracker - ${componentName}] Tab became visible. Activity session can restart on interaction.`);
        }
    }, [componentName, logAccumulatedFocusTime, dbUser?.user_id]); // logAccumulatedFocusTime is stable

    const handleBeforeUnload = useCallback(() => {
        logger.log(`[FocusTimeTracker - ${componentName}] beforeunload triggered.`);
         if (activityStartTimeRef.current && dbUser?.user_id) {
             const sessionDuration = Date.now() - activityStartTimeRef.current;
             accumulatedFocusTimeMsRef.current += sessionDuration;
             activityStartTimeRef.current = null;
         }
        if (dbUser?.user_id) logAccumulatedFocusTime(true);
    }, [dbUser?.user_id, logAccumulatedFocusTime]); // logAccumulatedFocusTime is stable

    useEffect(() => {
        if (!enabled) {
            if (activityStartTimeRef.current && dbUser?.user_id) {
                 const sessionDuration = Date.now() - activityStartTimeRef.current;
                 accumulatedFocusTimeMsRef.current += sessionDuration;
            }
            if (accumulatedFocusTimeMsRef.current > 0 && dbUser?.user_id) {
                logAccumulatedFocusTime(true); 
            }
            activityStartTimeRef.current = null;
            accumulatedFocusTimeMsRef.current = 0;
            debouncedLogFocusTime.cancel(); 
            // Remove listeners if they were added by this effect when it was enabled
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('beforeunload', handleBeforeUnload);
            return;
        }

        // Add listeners only if enabled
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            // Always try to remove listeners on cleanup, regardless of current `enabled` state
            // because they might have been added when `enabled` was true.
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('beforeunload', handleBeforeUnload);
            debouncedLogFocusTime.cancel(); 

            // Log any remaining time on unmount if tracker was enabled and user exists
            if(enabled && dbUser?.user_id) { // Check 'enabled' here to reflect its state during the effect's active period
                if (activityStartTimeRef.current) {
                    const sessionDuration = Date.now() - activityStartTimeRef.current;
                    accumulatedFocusTimeMsRef.current += sessionDuration;
                }
                logAccumulatedFocusTime(true);
            }
        };
    }, [enabled, dbUser?.user_id, componentName, handleVisibilityChange, handleBeforeUnload, logAccumulatedFocusTime, debouncedLogFocusTime]);
};