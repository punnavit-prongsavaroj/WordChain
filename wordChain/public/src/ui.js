export function showScreen(screenId) {
    document.querySelectorAll('.screen').forEach(s => {
        if (s.id !== screenId) {
            s.classList.remove('active');
            setTimeout(() => s.classList.add('hidden'), 50);
        }
    });
    
    const target = document.getElementById(screenId);
    target.classList.remove('hidden');
    setTimeout(() => target.classList.add('active'), 50);
}

export function updateLobbyUI(player) {
    document.getElementById('player-name-display').innerText = player.name;
}

export function updateRoomUI(room, players, currentUser) {
    document.getElementById('current-room-code').innerText = room.id;
    document.getElementById('player-count').innerText = players.length;
    
    const hostBadge = document.getElementById('room-host-badge');
    const startBtn = document.getElementById('start-game-btn');
    const settings = document.getElementById('host-settings');
    
    const isHost = room.hostId === currentUser.uid;
    
    if (isHost) {
        hostBadge.classList.remove('hidden');
        startBtn.classList.remove('hidden');
        settings.style.pointerEvents = 'auto';
        settings.style.opacity = '1';
    } else {
        hostBadge.classList.add('hidden');
        startBtn.classList.add('hidden');
        settings.style.pointerEvents = 'none';
        settings.style.opacity = '0.5';
    }
    
    const list = document.getElementById('waiting-players-list');
    list.innerHTML = '';
    
    players.forEach(p => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span>${p.name} ${p.id === room.hostId ? '👑' : ''}</span>
            <span class="${p.online ? 'success-text' : 'danger-text'}">${p.online ? 'Online' : 'Offline'}</span>
        `;
        list.appendChild(li);
    });
}

export function updateGameTopBar(room, playersList) {
    document.getElementById('current-round').innerText = room.round || 1;
    document.getElementById('total-rounds').innerText = room.totalRounds || 5;
    
    if (room.currentTurn) {
        const player = playersList.find(p => p.id === room.currentTurn);
        document.getElementById('current-turn-name').innerText = player ? player.name : "Unknown";
    }
}

export function updateGamePlayersList(room, playersList) {
    const list = document.getElementById('game-players-list');
    list.innerHTML = '';
    
    playersList.forEach(p => {
        const li = document.createElement('li');
        if (p.id === room.currentTurn) li.classList.add('current-turn');
        if (p.eliminated) li.classList.add('eliminated');
        
        li.innerHTML = `
            <span>${p.name}</span>
            <span>Score: ${p.score}</span>
        `;
        list.appendChild(li);
    });
}

export function updateTimerUI(remainingMs) {
    const display = document.getElementById('timer-display');
    const seconds = (Math.max(0, remainingMs) / 1000).toFixed(1);
    display.innerText = seconds;
    
    if (remainingMs <= 1000) {
        display.style.color = 'var(--danger)';
    } else {
        display.style.color = 'var(--text-primary)';
    }
}

export function setVoiceIndicator(state, message) {
    const indicator = document.getElementById('voice-indicator');
    const text = document.getElementById('voice-status-text');
    
    if (state === 'listening') {
        indicator.classList.add('listening');
        text.innerText = message || "กำลังฟัง...";
    } else if (state === 'processing') {
        indicator.classList.remove('listening');
        text.innerText = message || "กำลังประมวลผล...";
    } else {
        indicator.classList.remove('listening');
        text.innerText = message || "รอถึงตาของคุณ...";
    }
}

export function updateWordHistory(words) {
    const list = document.getElementById('word-history-list');
    list.innerHTML = '';
    
    // Show latest 10 words
    const recentWords = words.slice(-10).reverse();
    
    recentWords.forEach(w => {
        const li = document.createElement('li');
        li.innerHTML = `<span class="word">${w.word}</span> <small>(${w.syllables.join('-')})</small>`;
        list.appendChild(li);
    });
    
    if (words.length > 0) {
        const latest = words[words.length - 1];
        document.getElementById('latest-word').innerText = latest.word;
        document.getElementById('challenge-area').classList.remove('hidden');
    } else {
        document.getElementById('latest-word').innerText = '-';
        document.getElementById('challenge-area').classList.add('hidden');
    }
}
