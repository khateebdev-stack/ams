import { useEffect, useRef } from 'react';

const AUTO_LOCK_TIMEOUT = 5 * 60 * 1000; // 5 minutes

export function useAutoLock(isEnabled: boolean, onLock: () => void) {
    const timeoutRef = useRef<NodeJS.Timeout | null>(null);

    const resetTimer = () => {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (isEnabled) {
            timeoutRef.current = setTimeout(() => {
                console.log('Inactivity detected. Locking vault...');
                onLock();
            }, AUTO_LOCK_TIMEOUT);
        }
    };

    useEffect(() => {
        if (isEnabled) {
            // Events that signify activity
            const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];

            const handleActivity = () => resetTimer();

            events.forEach(event => window.addEventListener(event, handleActivity));

            // Initial start
            resetTimer();

            return () => {
                if (timeoutRef.current) clearTimeout(timeoutRef.current);
                events.forEach(event => window.removeEventListener(event, handleActivity));
            };
        }
    }, [isEnabled]);
}
