"use client";

import { useEffect, useRef, useCallback } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { useAppContext } from '@/contexts/AppContext';
import { logCyberFitnessAction } from './cyberFitnessSupabase';
import useInactivityTimer from './useInactivityTimer';
import er as logger } from '@/lib/debugLogger';

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
            accumulatedFocusTimeMsRef.current = 0; // Reset if too short or no user
            return;
        }

        const minutesToLog = Math.floor(accumulatedFocusTimeMsRef.current / (60 * 1000));
        if (minutesToLog > 0) {
            logger.log(`[FocusTimeTracker - ${componentName}] Logging ${minutesToLog} minutes of focus time for user ${dbUser.user_id}. Is unload: ${isUnload}`);
            try {
                // Pass the Supabase user_id (string)
                await logCyberFitnessAction(dbUser.user_id, 'focusTimeAdded', { minutes: minutesToLog });
                accumulatedFocusTimeMsRef.current -= minutesToLog * 60 * 1000; // Subtract logged time
                 logger.info(`[FocusTimeTracker - ${componentName}] Successfully logged ${minutesToLog} focus minutes. Remaining accumulated: ${accumulatedFocusTimeMsRef.current}ms`);
            } catch (error) {
                logger.error(`[FocusTimeTracker - ${componentName}] Error logging focus time:`, error);
            }
        } else {
            logger.log(`[FocusTimeTracker - ${componentName}] Not enough accumulated minutes to log (less than 1 minute). Accumulated: ${accumulatedFocusTimeMsRef.current}ms`);
        }
    }, [dbUser?.user_id, componentName]);

    const debouncedLogFocusTime = useDebouncedCallback(
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
    }, [componentName, debouncedLogFocusTime]);

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

    useEffect(() => {
        if (!enabled) {
            // If disabled, attempt to log any pending time and clear refs
            if (activityStartTimeRef.current && dbUser?.user_id) {
                 const sessionDuration = Date.now() - activityStartTimeRef.current;
                 accumulatedFocusTimeMsRef.current += sessionDuration;
            }
            if (accumulatedFocusTimeMsRef.current > 0 && dbUser?.user_id) {
                logAccumulatedFocusTime(true); // Force log on disable
            }
            activityStartTimeRef.current = null;
            accumulatedFocusTimeMsRef.current = 0;
            debouncedLogFocusTime.cancel(); // Cancel any pending debounced calls
            return;
        }

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                logger.log(`[FocusTimeTracker - ${componentName}] Tab became hidden.`);
                if (activityStartTimeRef.current) {
                    const sessionDuration = Date.now() - activityStartTimeRef.current;
                     if (sessionDuration >= MIN_FOCUS_SESSION_MS / 2 ) { 
                        accumulatedFocusTimeMsRef.current += sessionDuration;
                         logger.log(`[FocusTimeTracker - ${componentName}] Tab hidden during active session. Duration: ${sessionDuration}ms. Total accumulated: ${accumulatedFocusTimeMsRef.current}ms`);
                         logAccumulatedFocusTime(true); // Log immediately
                     } else {
                        logger.log(`[FocusTimeTracker - ${componentName}] Tab hidden, active session too short (${sessionDuration}ms) to accumulate.`);
                     }
                    activityStartTimeRef.current = null; 
                } else {
                     if(accumulatedFocusTimeMsRef.current > 0 && dbUser?.user_id) { // Check dbUser as well
                        logAccumulatedFocusTime(true); // Log any pending on hide
                     }
                }
            } else if (document.visibilityState === 'visible') {
                logger.log(`[FocusTimeTracker - ${componentName}] Tab became visible. Activity session can restart on interaction.`);
                activityStartTimeRef.current = null; 
            }
        };
        
        const handleBeforeUnload = () => {
            logger.log(`[FocusTimeTracker - ${componentName}] beforeunload triggered.`);
             if (activityStartTimeRef.current && dbUser?.user_id) {
                 const sessionDuration = Date.now() - activityStartTimeRef.current;
                 accumulatedFocusTimeMsRef.current += sessionDuration;
                 activityStartTimeRef.current = null;
             }
            if (dbUser?.user_id) logAccumulatedFocusTime(true); // Force log on unload
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('beforeunload', handleBeforeUnload);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('beforeunload', handleBeforeUnload);
            debouncedLogFocusTime.cancel(); // Cancel debounced calls on unmount
            // Log any remaining time on unmount if enabled and user exists
            if(enabled && dbUser?.user_id) {
                if (activityStartTimeRef.current) {
                    const sessionDuration = Date.now() - activityStartTimeRef.current;
                    accumulatedFocusTimeMsRef.current += sessionDuration;
                }
                logAccumulatedFocusTime(true);
            }
        };
    }, [enabled, dbUser?.user_id, logAccumulatedFocusTime, debouncedLogFocusTime, componentName]);
};