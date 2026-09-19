let timerInterval = null;

export function startClientTimer(timerEndTimestamp, onTimeUp, onTick) {
    if (timerInterval) clearInterval(timerInterval);
    
    if (!timerEndTimestamp) return;
    
    const endMs = timerEndTimestamp.toMillis ? timerEndTimestamp.toMillis() : timerEndTimestamp.getTime();
    
    timerInterval = setInterval(() => {
        const now = Date.now();
        const remaining = endMs - now;
        
        if (remaining <= 0) {
            clearInterval(timerInterval);
            onTick(0);
            onTimeUp();
        } else {
            onTick(remaining);
        }
    }, 100); // 100ms updates for smooth display
}

export function stopClientTimer() {
    if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
    }
}
