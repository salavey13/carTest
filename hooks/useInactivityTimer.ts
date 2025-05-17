import { useState, useEffect, useCallback, useRef } from 'react';
import { debugLogger as logger } from '@/lib/debugLogger';

const useInactivityTimer = (
    inactiveTimeout: number,
    onInactive: () => void,
    onActive?: () => void,
    componentName: string = "UnnamedComponent"
) => {
    const [isCurrentlyInactive, setIsCurrentlyInactive] = useState(false);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    
    const onInactiveRef = useRef(onInactive);
    const onActiveRef = useRef(onActive);

    useEffect(() => {
        onInactiveRef.current = onInactive;
    }, [onInactive]);

    useEffect(() => {
        onActiveRef.current = onActive;
    }, [onActive]);

    const resetTimer = useCallback(() => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
        }

        // Only call onActive if state is transitioning from inactive to active
        if (isCurrentlyInactive) {
            setIsCurrentlyInactive(false);
            logger.log(`[useInactivityTimer - ${componentName}] Activity resumed.`);
            if (onActiveRef.current) {
                onActiveRef.current();
            }
        }

        if (inactiveTimeout > 0) {
            timerRef.current = setTimeout(() => {
                setIsCurrentlyInactive(true); // Set inactive state before calling the callback
                logger.log(`[useInactivityTimer - ${componentName}] Inactivity detected after ${inactiveTimeout}ms.`);
                if (onInactiveRef.current) {
                    onInactiveRef.current();
                }
            }, inactiveTimeout);
        }
    }, [inactiveTimeout, isCurrentlyInactive, componentName]); 

    useEffect(() => {
        const events: Array<keyof WindowEventMap> = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
        
        const handleActivity = () => {
            // No need to check inactiveTimeout here, resetTimer handles it
            resetTimer();
        };

        if (inactiveTimeout > 0) {
            logger.log(`[useInactivityTimer - ${componentName}] Initializing timer with ${inactiveTimeout}ms.`);
            resetTimer(); // Initial timer start

            events.forEach(event => window.addEventListener(event, handleActivity, { passive: true }));
        } else {
            logger.log(`[useInactivityTimer - ${componentName}] Inactivity timer disabled (timeout <= 0). Clearing existing timer if any.`);
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
            // No listeners should be active if timeout is <= 0
        }

        return () => {
            if (timerRef.current) {
                clearTimeout(timerRef.current);
            }
            if (inactiveTimeout > 0) { // Only remove listeners if they were added
                events.forEach(event => window.removeEventListener(event, handleActivity));
                logger.log(`[useInactivityTimer - ${componentName}] Cleaned up event listeners.`);
            }
        };
    }, [resetTimer, inactiveTimeout, componentName]); // resetTimer is stable, inactiveTimeout and componentName are key dependencies

    return { isInactive: isCurrentlyInactive }; // isInactive reflects the current state
};

export default useInactivityTimer;