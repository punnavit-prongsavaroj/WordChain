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
            <span>${p.name} ${p.eliminated ? '💀' : ''}</span>
            <span>Score: ${p.score || 0} | Wins: ${p.wins || 0}</span>
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
        li.innerHTML = `<span class="word">${w.word}</span> <small>(${w.syllables?.join('-') || ''})</small>`;
        list.appendChild(li);
    });
    
    if (words.length > 0) {
        const latest = words[words.length - 1];
        document.getElementById('latest-word').innerText = latest.word;
    } else {
        document.getElementById('latest-word').innerText = '-';
    }
}

// ===== Challenge & Vote UI =====

export function showChallengeButton(show, isMyWord) {
    const overlay = document.getElementById('challenge-overlay');
    if (!overlay) return;

    if (show && !isMyWord) {
        overlay.classList.remove('hidden');
        // Start countdown bar animation
        const bar = document.getElementById('challenge-countdown-bar');
        if (bar) {
            bar.style.transition = 'none';
            bar.style.width = '100%';
            requestAnimationFrame(() => {
                bar.style.transition = 'width 3s linear';
                bar.style.width = '0%';
            });
        }
    } else {
        overlay.classList.add('hidden');
    }
}

export function hideChallengeButton() {
    const overlay = document.getElementById('challenge-overlay');
    if (overlay) overlay.classList.add('hidden');
}

export function showVoteModal(show, wordText, isVoter) {
    const modal = document.getElementById('vote-modal');
    if (!modal) return;

    if (show) {
        modal.classList.remove('hidden');
        document.getElementById('vote-word-display').innerText = `"${wordText}"`;
        
        const voteBtns = document.getElementById('vote-buttons');
        const voteWaiting = document.getElementById('vote-waiting');
        
        if (isVoter) {
            voteBtns.classList.remove('hidden');
            voteWaiting.classList.add('hidden');
        } else {
            // Speaker sees the modal but can't vote
            voteBtns.classList.add('hidden');
            voteWaiting.classList.remove('hidden');
            voteWaiting.innerText = '⏳ รอผู้เล่นอื่นโหวต...';
        }
    } else {
        modal.classList.add('hidden');
    }
}

export function hideVoteModal() {
    const modal = document.getElementById('vote-modal');
    if (modal) modal.classList.add('hidden');
}

export function updateVoteResults(validCount, invalidCount, totalEligible) {
    const validEl = document.getElementById('vote-valid-count');
    const invalidEl = document.getElementById('vote-invalid-count');
    const totalEl = document.getElementById('vote-total');
    
    if (validEl) validEl.innerText = validCount;
    if (invalidEl) invalidEl.innerText = invalidCount;
    if (totalEl) totalEl.innerText = `${validCount + invalidCount}/${totalEligible}`;
}

export function updateVoteTimer(remainingMs) {
    const display = document.getElementById('vote-timer-display');
    if (!display) return;
    
    const minutes = Math.floor(remainingMs / 60000);
    const seconds = Math.floor((remainingMs % 60000) / 1000);
    display.innerText = `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

export function disableVoteButtons() {
    const validBtn = document.getElementById('vote-valid-btn');
    const invalidBtn = document.getElementById('vote-invalid-btn');
    if (validBtn) validBtn.disabled = true;
    if (invalidBtn) invalidBtn.disabled = true;
}

export function enableVoteButtons() {
    const validBtn = document.getElementById('vote-valid-btn');
    const invalidBtn = document.getElementById('vote-invalid-btn');
    if (validBtn) validBtn.disabled = false;
    if (invalidBtn) invalidBtn.disabled = false;
}

export function showVoteResult(result, validCount, invalidCount) {
    const resultEl = document.getElementById('vote-result');
    if (!resultEl) return;
    
    resultEl.classList.remove('hidden');
    if (result === 'speaker_eliminated') {
        resultEl.innerHTML = `<span class="danger-text">❌ คำไม่ถูกต้อง (${invalidCount} vs ${validCount}) — คนพูดถูกตัดสิทธิ์!</span>`;
    } else {
        resultEl.innerHTML = `<span class="success-text">✅ คำถูกต้อง (${validCount} vs ${invalidCount}) — คน Challenge ถูกตัดสิทธิ์!</span>`;
    }
}

// ===== Round Transition =====

export function showRoundTransition(round, winnerName) {
    const overlay = document.getElementById('round-transition');
    if (!overlay) return;
    
    const roundNum = document.getElementById('transition-round');
    const winner = document.getElementById('transition-winner');
    
    if (roundNum) roundNum.innerText = round - 1; // show the round that just ended
    if (winner) winner.innerText = winnerName || 'ไม่มีผู้ชนะ';
    
    overlay.classList.remove('hidden');
    
    // Auto-hide after 3 seconds
    setTimeout(() => {
        overlay.classList.add('hidden');
    }, 3000);
}

export function hideRoundTransition() {
    const overlay = document.getElementById('round-transition');
    if (overlay) overlay.classList.add('hidden');
}

// ===== Game Over =====

export function showGameOver(room, playersList, currentUser) {
    const winnerDisplay = document.getElementById('winner-display');
    const scoreboard = document.getElementById('final-scoreboard');
    const playAgainBtn = document.getElementById('play-again-btn');
    
    if (playAgainBtn && currentUser) {
        if (room.hostId === currentUser.uid) {
            playAgainBtn.classList.remove('hidden');
        } else {
            playAgainBtn.classList.add('hidden');
        }
    }
    
    // Use finalScores from room if available, otherwise use playersList
    const scores = room.finalScores || playersList.map(p => ({
        name: p.name,
        wins: p.wins || 0,
        score: p.score || 0
    }));
    
    // Sort by wins descending
    scores.sort((a, b) => (b.wins || 0) - (a.wins || 0));
    
    // Display winner
    if (winnerDisplay) {
        const winner = scores[0];
        winnerDisplay.innerHTML = `
            <div class="winner-crown">👑</div>
            <div class="winner-name">${room.winnerName || winner?.name || 'ไม่มี'}</div>
            <div class="winner-stats">${winner?.wins || 0} wins</div>
        `;
    }
    
    // Display scoreboard
    if (scoreboard) {
        scoreboard.innerHTML = '';
        scores.forEach((p, index) => {
            const li = document.createElement('li');
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `#${index + 1}`;
            li.innerHTML = `
                <span>${medal} ${p.name}</span>
                <span>Wins: ${p.wins || 0} | Score: ${p.score || 0}</span>
            `;
            if (index === 0) li.classList.add('winner-row');
            scoreboard.appendChild(li);
        });
    }
}
