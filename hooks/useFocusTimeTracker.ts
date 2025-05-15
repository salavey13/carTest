import { useEffect, useRef, useCallback } from 'react';
import { useDebouncedCallback } from 'use-debounce';
import { useAppContext } from '@/contexts/AppContext';
import { logCyberFitnessAction } from './cyberFitnessSupabase';
import useInactivityTimer from './useInactivityTimer';
import { debugLogger as logger } from '@/lib/debugLogger';

const MIN_FOCUS_SESSION_MS = 30 * 1000; // 30 seconds
const FOCUS_LOG_INTERVAL_MS = 5 * 60 * 1000; // Log accumulated focus time every 5 minutes

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
            if (accumulatedFocusTimeMsRef.current > 0 && accumulatedFocusTimeMsRef.current < MIN_FOCUS_SESSION_MS) {
                logger.log(`[FocusTimeTracker - ${componentName}] Accumulated focus time (${accumulatedFocusTimeMsRef.current}ms) is less than minimum (${MIN_FOCUS_SESSION_MS}ms). Not logging. Resetting.`);
            }
            accumulatedFocusTimeMsRef.current = 0; // Reset if too short or no user
            return;
        }

        const minutesToLog = Math.floor(accumulatedFocusTimeMsRef.current / (60 * 1000));
        if (minutesToLog > 0) {
            logger.log(`[FocusTimeTracker - ${componentName}] Logging ${minutesToLog} minutes of focus time for user ${dbUser.user_id}. Is unload: ${isUnload}`);
            try {
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

    // Debounce the logging function to avoid too frequent DB calls
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
                debouncedLogFocusTime(); // Attempt to log (will only log if interval passed or enough time accumulated)
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
        // If already active, the inactivity timer's reset will handle it.
    }, [componentName]);

    useInactivityTimer(
        enabled ? inactiveTimeout : 0, // Disable timer if not enabled
        handleBecameInactive,
        handleBecameActive,
        componentName
    );

    // Handle tab visibility changes
    useEffect(() => {
        if (!enabled) return;

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                logger.log(`[FocusTimeTracker - ${componentName}] Tab became hidden.`);
                if (activityStartTimeRef.current) {
                    const sessionDuration = Date.now() - activityStartTimeRef.current;
                     if (sessionDuration >= MIN_FOCUS_SESSION_MS / 2 ) { // Log even shorter sessions if tab hides
                        accumulatedFocusTimeMsRef.current += sessionDuration;
                         logger.log(`[FocusTimeTracker - ${componentName}] Tab hidden during active session. Duration: ${sessionDuration}ms. Total accumulated: ${accumulatedFocusTimeMsRef.current}ms`);
                         // Immediately attempt to log, as the tab is closing / user is leaving
                         logAccumulatedFocusTime(true);
                     } else {
                        logger.log(`[FocusTimeTracker - ${componentName}] Tab hidden, active session too short (${sessionDuration}ms) to accumulate.`);
                     }
                    activityStartTimeRef.current = null; // Stop current session
                } else {
                     // If tab becomes hidden and there was no active session, but there's accumulated time, try logging it.
                     if(accumulatedFocusTimeMsRef.current > 0) {
                        logAccumulatedFocusTime(true);
                     }
                }
            } else if (document.visibilityState === 'visible') {
                logger.log(`[FocusTimeTracker - ${componentName}] Tab became visible. Resetting activity start time.`);
                // When tab becomes visible, user needs to interact to start a new session
                activityStartTimeRef.current = null; 
                // Consider resetting the inactivity timer here as well via a manual call if useInactivityTimer doesn't handle it
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('beforeunload', () => logAccumulatedFocusTime(true)); // Log on unload

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('beforeunload', () => logAccumulatedFocusTime(true));
            // Ensure any remaining time is logged when the component unmounts if enabled
            if(enabled && dbUser?.user_id) {
                logAccumulatedFocusTime(true);
            }
        };
    }, [enabled, dbUser?.user_id, logAccumulatedFocusTime, componentName]);
};

// Example of how to use it in a top-level client component (e.g., ClientLayout.tsx)
//
// import { useFocusTimeTracker } from '@/hooks/useFocusTimeTracker';
//
// const ClientLayout = ({ children }) => {
//   useFocusTimeTracker({
//     inactiveTimeout: 60000, // 1 minute for inactivity
//     componentName: "GlobalAppFocus",
//     enabled: true // Or conditionally enable based on user login, etc.
//   });
//
//   return <>{children}</>;
// };