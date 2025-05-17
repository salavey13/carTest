"use client";

import { useEffect, useRef, useCallback, useState } from 'react';
import { debugLogger as logger } from '@/lib/debugLogger';

const useInactivityTimer = (
    inactiveTimeoutMs: number,
    onInactive: () => void,
    onActive?: () => void,
    componentName: string = "UnnamedComponent"
) => {
    const timerIdRef = useRef<NodeJS.Timeout | null>(null);
    // Use a ref to track the "inactive" status internally for logic,
    // to avoid making the event handler callback dependent on state for its identity.
    const internalIsInactiveRef = useRef(false); 

    // State to return to the consumer if they need to know (optional)
    // This state is updated by the stableEventHandler.
    const [consumerFacingIsInactive, setConsumerFacingIsInactive] = useState(false);

    const onInactiveCallbackRef = useRef(onInactive);
    const onActiveCallbackRef = useRef(onActive);

    useEffect(() => { onInactiveCallbackRef.current = onInactive; }, [onInactive]);
    useEffect(() => { onActiveCallbackRef.current = onActive; }, [onActive]);

    const stableEventHandler = useCallback(() => {
        if (timerIdRef.current) {
            clearTimeout(timerIdRef.current);
        }

        if (internalIsInactiveRef.current) { // User was inactive, now active
            internalIsInactiveRef.current = false;
            setConsumerFacingIsInactive(false);
            logger.log(`[useInactivityTimer - ${componentName}] Activity resumed.`);
            if (onActiveCallbackRef.current) {
                onActiveCallbackRef.current();
            }
        }
        
        if (inactiveTimeoutMs > 0) {
            timerIdRef.current = setTimeout(() => {
                internalIsInactiveRef.current = true;
                setConsumerFacingIsInactive(true);
                logger.log(`[useInactivityTimer - ${componentName}] Inactivity detected after ${inactiveTimeoutMs}ms.`);
                if (onInactiveCallbackRef.current) {
                    onInactiveCallbackRef.current();
                }
            }, inactiveTimeoutMs);
        }
    }, [inactiveTimeoutMs, componentName]); // This handler is now stable as its deps don't include internal state.

    useEffect(() => {
        const events: Array<keyof WindowEventMap> = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
        
        if (inactiveTimeoutMs > 0) {
            logger.log(`[useInactivityTimer - ${componentName}] Initializing. Timeout: ${inactiveTimeoutMs}ms.`);
            
            // Initial setup: assume user is active, reset ref, and start the first timer.
            internalIsInactiveRef.current = false; 
            setConsumerFacingIsInactive(false);
            stableEventHandler(); // Call to set the first timer based on current (active) state.

            events.forEach(event => window.addEventListener(event, stableEventHandler, { passive: true }));
            logger.log(`[useInactivityTimer - ${componentName}] Event listeners ADDED.`);

            return () => {
                events.forEach(event => window.removeEventListener(event, stableEventHandler));
                if (timerIdRef.current) {
                    clearTimeout(timerIdRef.current);
                }
                logger.log(`[useInactivityTimer - ${componentName}] Event listeners REMOVED and timer cleared.`);
            };
        } else {
            // If timer is disabled (timeout <= 0)
            if (timerIdRef.current) {
                clearTimeout(timerIdRef.current);
            }
            // Optionally set a default state when disabled
            // internalIsInactiveRef.current = false; // Or true, depending on definition
            // setConsumerFacingIsInactive(false);
            logger.log(`[useInactivityTimer - ${componentName}] Disabled (timeout: ${inactiveTimeoutMs}ms). Timer cleared.`);
            return () => {}; // No listeners were added if inactiveTimeoutMs <= 0
        }
    }, [inactiveTimeoutMs, componentName, stableEventHandler]); // stableEventHandler is stable.

    return { isInactive: consumerFacingIsInactive }; 
};

export default useInactivityTimer;