// เปลี่ยน URL ให้ตรงกับ Server ของคุณ
const socket = io('http://localhost:3000'); 
let myId = '';
let currentRoom = '';
let challengeState = null;

// --- Web Speech API (รับเสียงภาษาไทย) ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const recognition = new SpeechRecognition();
recognition.lang = 'th-TH';
recognition.interimResults = false;

recognition.onresult = (event) => {
    const word = event.results[0][0].transcript.trim().replace(/\s+/g, ''); // ตัดช่องว่างทิ้ง
    console.log("พูดว่า:", word);
    socket.emit('submit_word', { roomId: currentRoom, word });
};

// --- ฟังก์ชันช่วยเหลือ (แปลงไฟล์รูปเป็น Base64) ---
async function getAvatarBase64() {
    const fileInput = document.getElementById('avatarUpload');
    if (!fileInput.files[0]) return 'assets/default-avatar.png'; // ใช้รูป Default ถ้าไม่มี
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(fileInput.files[0]);
    });
}

// --- ฟังก์ชันหลักของผู้เล่น ---
async function joinGame() {
    currentRoom = document.getElementById('roomIdInput').value;
    const name = document.getElementById('playerName').value || 'ไม่ระบุชื่อ';
    const avatar = await getAvatarBase64();
    
    socket.emit('join_room', { roomId: currentRoom, name, avatar });
    document.getElementById('roomInfo').classList.remove('hidden');
}

function startGame() {
    socket.emit('start_game', { roomId: currentRoom });
}

function startSpeaking() {
    document.getElementById('micBtn').innerText = "🎙️ กำลังฟัง...";
    recognition.start();
}

function stopSpeaking() {
    document.getElementById('micBtn').innerText = "🎤 กดค้างเพื่อพูด";
    recognition.stop();
}

function initiateChallenge() {
    socket.emit('challenge_turn', { roomId: currentRoom });
}

function submitVote(choice) {
    if (!challengeState) return;
    const voteForId = choice === 'challenger' ? challengeState.challengerId : challengeState.challengedId;
    socket.emit('submit_vote', { roomId: currentRoom, voteFor: voteForId });
    document.getElementById('voteButtons').innerHTML = "<p>บันทึกผลโหวตแล้ว รอเวลาหมด...</p>";
}

// --- Socket.io Listeners (ฟังข้อมูลจาก Server) ---

socket.on('connect', () => { myId = socket.id; });

// อัปเดตรายชื่อคนใน Lobby
socket.on('room_update', ({ players }) => {
    const container = document.getElementById('playersInLobby');
    container.innerHTML = players.map(p => `
        <div class="player-card">
            <img src="${p.avatar}" alt="avatar">
            <p>${p.name} ${p.isHost ? '(Host)' : ''}</p>
        </div>
    `).join('');

    // เช็คว่าเราเป็น Host และมีคน >= 3 คน ค่อยเปิดปุ่มเริ่มเกม
    const me = players.find(p => p.id === myId);
    if (me && me.isHost && players.length >= 3) {
        document.getElementById('startGameBtn').classList.remove('hidden');
    } else {
        document.getElementById('startGameBtn').classList.add('hidden');
    }
});

// เริ่มเกม -> เปลี่ยนหน้าจอ
socket.on('game_started', () => {
    document.getElementById('lobbyUI').classList.add('hidden');
    document.getElementById('gameUI').classList.remove('hidden');
});

// เริ่มเทิร์นของใครบางคน
let timerInterval;
socket.on('turn_start', ({ playerId, timeLimit }) => {
    const isMyTurn = (playerId === myId);
    document.getElementById('micBtn').disabled = !isMyTurn;
    document.getElementById('turnDisplay').innerText = isMyTurn ? "ตาของคุณแล้ว! กดไมค์เลย" : "รอคนอื่นพูด...";
    document.getElementById('turnDisplay').style.color = isMyTurn ? "green" : "black";
    
    // จัดการเวลา UI
    clearInterval(timerInterval);
    let timeLeft = timeLimit / 1000;
    document.getElementById('timerDisplay').innerText = `${timeLeft.toFixed(1)}s`;
    
    timerInterval = setInterval(() => {
        timeLeft -= 0.1;
        document.getElementById('timerDisplay').innerText = `${Math.max(0, timeLeft).toFixed(1)}s`;
        if (timeLeft <= 0) clearInterval(timerInterval);
    }, 100);
});

// มีคนพูดคำที่ถูกยอมรับ (โชว์ให้กด Challenge ได้ 1.5 วินาที)
socket.on('word_accepted', ({ playerId, word }) => {
    document.getElementById('lastWordsDisplay').innerText = word;
    // เปิดปุ่ม Challenge ให้คนอื่นที่ไม่ใช่คนพูด
    if (playerId !== myId) {
        document.getElementById('challengeBtn').disabled = false;
        setTimeout(() => { document.getElementById('challengeBtn').disabled = true; }, 1500);
    }
});

// มีคนถูกคัดออก
socket.on('elimination', ({ playerId, reason }) => {
    if (playerId === myId) alert(`คุณถูกคัดออก! สาเหตุ: ${reason}`);
});

// เริ่มการ Debate
socket.on('debate_start', ({ challengerId, challengedId, words, debateTimeLimit }) => {
    challengeState = { challengerId, challengedId };
    clearInterval(timerInterval); // หยุดเวลาปกติ
    document.getElementById('timerDisplay').innerText = "PAUSED";
    document.getElementById('micBtn').disabled = true;
    document.getElementById('challengeBtn').disabled = true;
    
    document.getElementById('debateUI').classList.remove('hidden');
    document.getElementById('debateMessage').innerText = 
        `คำว่า "${words[1].word}" เชื่อมกับคำว่า "${words[0].word}" หรือไม่? ให้เวลาเถียงกัน!`;
});

// เริ่มการโหวต
socket.on('voting_start', () => {
    const isDebater = (myId === challengeState.challengerId || myId === challengeState.challengedId);
    if (!isDebater) {
        // ให้คนที่ไม่ได้เถียงโหวต
        document.getElementById('voteButtons').classList.remove('hidden');
    } else {
        document.getElementById('voteButtons').innerHTML = "<p>คุณคือผู้ที่มีส่วนได้ส่วนเสีย รอดูผลโหวต...</p>";
        document.getElementById('voteButtons').classList.remove('hidden');
    }
});

// สรุปผลโหวต
socket.on('challenge_result', ({ challengerWon, challengerVotes, challengedVotes }) => {
    alert(`ผลโหวต: ท้วงถูก (${challengerVotes}) - ท้วงผิด (${challengedVotes}) \n${challengerWon ? 'คนโดนท้วงถูกคัดออก' : 'คนท้วงถูกคัดออก'}`);
    document.getElementById('debateUI').classList.add('hidden');
    document.getElementById('voteButtons').classList.add('hidden');
    challengeState = null;
});

// จบรอบ (เหลือคนเดียว)
socket.on('round_end', ({ winnerId }) => {
    alert(winnerId === myId ? "คุณเป็นผู้ชนะในรอบนี้! 🎉" : "จบรอบ! เตรียมตัวเริ่มรอบใหม่...");
});

// เริ่มรอบใหม่
socket.on('round_start', ({ round }) => {
    document.getElementById('roundDisplay').innerText = `รอบที่ ${round}`;
    document.getElementById('lastWordsDisplay').innerText = "-";
});