import { loginAnonymously, setupAuthListener, getCurrentUser } from './auth.js';
import { createRoom, joinRoom, listenToRoom, listenToPlayers } from './room.js';
import { startGame, nextTurn, eliminatePlayer, submitWord, listenToWords } from './game.js';
import { requestMicrophonePermission, speechToTextLive, stopRecognition, speechToText, checkWordAPI } from './speech.js';
import { startClientTimer, stopClientTimer } from './timer.js';
import { showScreen, updateLobbyUI, updateRoomUI, updateGameTopBar, updateGamePlayersList, updateTimerUI, setVoiceIndicator, updateWordHistory } from './ui.js';

let currentUser = null;
let currentRoom = null;
let playersList = [];
let wordsList = [];
let isMyTurn = false;
let isRecording = false;

// DOM Elements
const loginBtn = document.getElementById('login-btn');
const playerNameInput = document.getElementById('player-name-input');
const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomBtn = document.getElementById('join-room-btn');
const roomCodeInput = document.getElementById('room-code-input');
const startGameBtn = document.getElementById('start-game-btn');
const leaveRoomBtn = document.getElementById('leave-room-btn');
const authStatus = document.getElementById('auth-status');

// Initialize
function init() {
    setupAuthListener((user) => {
        if (user) {
            currentUser = user;
            showScreen('lobby-screen');
            updateLobbyUI(user);
        } else {
            showScreen('auth-screen');
        }
    });

    loginBtn.addEventListener('click', async () => {
        try {
            authStatus.innerText = "กำลังเข้าสู่ระบบ...";
            const user = await loginAnonymously(playerNameInput.value);
            currentUser = { uid: user.uid, name: playerNameInput.value.trim() };
            showScreen('lobby-screen');
            updateLobbyUI(currentUser);
        } catch (e) {
            authStatus.innerText = e.message;
        }
    });

    createRoomBtn.addEventListener('click', async () => {
        try {
            const roomId = await createRoom(currentUser);
            setupRoomListeners(roomId);
            showScreen('room-screen');
        } catch (e) {
            alert(e.message);
        }
    });

    joinRoomBtn.addEventListener('click', async () => {
        try {
            const roomId = roomCodeInput.value.trim();
            if (!roomId) return alert("กรุณากรอกรหัสห้อง");
            await joinRoom(roomId, currentUser);
            setupRoomListeners(roomId);
            showScreen('room-screen');
        } catch (e) {
            alert(e.message);
        }
    });

    startGameBtn.addEventListener('click', async () => {
        try {
            await requestMicrophonePermission(); // Ask permission before game starts
            await startGame(currentRoom.id, playersList);
        } catch (e) {
            alert(e.message);
        }
    });

    // ===== Mic Test Logic =====
    const micTestBtn = document.getElementById('mic-test-btn');
    const micTestLabel = document.getElementById('mic-test-label');
    const micTestResult = document.getElementById('mic-test-result');
    let micTestRecording = false;
    let micTestAborted = false;

    // กดปุ่ม → เริ่มฟังเสียงทันที (เหมือนเกมจริง)
    async function onMicTestStart() {
        if (micTestRecording) return;
        micTestRecording = true;
        micTestAborted = false;

        micTestBtn.classList.add('recording');
        micTestLabel.textContent = '🔴 กำลังฟัง... (ปล่อยเมื่อพูดเสร็จ)';
        micTestResult.className = 'mic-test-result';
        micTestResult.innerHTML = '<span class="placeholder-text">พูดคำที่ต้องการทดสอบ...</span>';

        try {
            // เริ่มฟังเสียงทันที เหมือนเกมจริง
            const text = await speechToTextLive(6000);

            if (micTestAborted) return; // ถ้าถูกยกเลิกก่อน ไม่ต้องแสดงผล

            micTestBtn.classList.remove('recording');
            micTestBtn.classList.add('processing');
            micTestLabel.textContent = '⏳ กำลังประมวลผล...';

            if (!text || text.trim() === '') {
                micTestResult.className = 'mic-test-result error';
                micTestResult.innerHTML = `<span class="result-word">🔇 ฟังไม่รู้เรื่อง</span><span class="result-hint">ลองพูดให้ชัดขึ้น หรือเพิ่มระดับเสียง</span>`;
            } else {
                micTestResult.className = 'mic-test-result success';
                micTestResult.innerHTML = `<span class="result-word">"${text}"</span><span class="result-hint">✅ ไมค์ทำงานปกติ พร้อมเล่นเกมแล้ว!</span>`;
            }
        } catch (e) {
            if (!micTestAborted) {
                micTestResult.className = 'mic-test-result error';
                micTestResult.innerHTML = `<span class="result-word">❌ ${e.message}</span>`;
            }
        } finally {
            micTestRecording = false;
            micTestBtn.classList.remove('recording', 'processing');
            micTestLabel.textContent = '🎙️ กดแล้วพูด';
        }
    }

    // ปล่อยปุ่ม → หยุดฟัง (ถ้ายังฟังอยู่)
    function onMicTestStop() {
        if (!micTestRecording) return;
        micTestAborted = false; // ไม่ abort แค่หยุดฟัง ให้แสดงผลที่ได้
        stopRecognition();      // บอก Web Speech API ให้หยุดฟัง → จะ trigger onresult/onend
    }

    micTestBtn.addEventListener('mousedown', onMicTestStart);
    micTestBtn.addEventListener('mouseup', onMicTestStop);
    micTestBtn.addEventListener('touchstart', (e) => { e.preventDefault(); onMicTestStart(); });
    micTestBtn.addEventListener('touchend', (e) => { e.preventDefault(); onMicTestStop(); });
}

function setupRoomListeners(roomId) {
    listenToRoom(roomId, (roomData) => {
        currentRoom = roomData;
        
        if (roomData.status === "waiting") {
            updateRoomUI(roomData, playersList, currentUser);
        } else if (roomData.status === "playing") {
            showScreen('game-screen');
            handleGameStateChange();
        } else if (roomData.status === "finished") {
            showScreen('game-over-screen');
            // Show winner logic here
        }
    });

    listenToPlayers(roomId, (players) => {
        playersList = players;
        if (currentRoom?.status === "waiting") {
            updateRoomUI(currentRoom, playersList, currentUser);
        } else if (currentRoom?.status === "playing") {
            updateGamePlayersList(currentRoom, playersList);
        }
    });

    listenToWords(roomId, (words) => {
        wordsList = words;
        updateWordHistory(words);
    });
}

function handleGameStateChange() {
    updateGameTopBar(currentRoom, playersList);
    updateGamePlayersList(currentRoom, playersList);
    
    const wasMyTurn = isMyTurn;
    isMyTurn = currentRoom.currentTurn === currentUser.uid;
    
    // Timer Logic
    if (currentRoom.timerEnd) {
        startClientTimer(currentRoom.timerEnd, 
            () => {
                // Time up
                if (isMyTurn) {
                    handleTimeUp();
                }
            },
            (remaining) => updateTimerUI(remaining)
        );
    }
    
    // Handle Turn Start
    if (isMyTurn && !wasMyTurn) {
        startMyTurn();
    } else if (!isMyTurn) {
        setVoiceIndicator('idle', 'รอถึงตาของคุณ...');
    }
}

async function startMyTurn() {
    setVoiceIndicator('listening', '🎤 ถึงตาคุณแล้ว! กดปุ่มด้านล่าง');
    isRecording = false;

    // แสดงปุ่ม Push-to-Talk ให้ผู้เล่นกดเอง (Browser บังคับ User Gesture)
    const pttArea = document.getElementById('ptt-area');
    const pttBtn  = document.getElementById('ptt-btn');
    const pttLabel = pttBtn.querySelector('.ptt-label');

    pttArea.classList.remove('hidden');
    pttBtn.classList.remove('listening');
    pttLabel.textContent = 'กดเพื่อพูด';

    // รอให้ผู้เล่นกดปุ่ม
    pttBtn.onclick = async () => {
        if (isRecording) return;
        isRecording = true;

        pttBtn.classList.add('listening');
        pttLabel.textContent = 'กำลังฟัง...';
        setVoiceIndicator('listening', '🔴 กำลังฟัง...');

        try {
            const text = await speechToTextLive(3500);
            isRecording = false;
            pttArea.classList.add('hidden');
            pttBtn.onclick = null;

            if (!text || text.trim() === '') {
                setVoiceIndicator('idle', '🔇 ฟังไม่รู้เรื่อง');
                failTurn("ไม่ได้ยินเสียง");
                return;
            }

            setVoiceIndicator('processing', `"${text}" กำลังตรวจสอบ...`);
            await processVoice(text);

        } catch (e) {
            isRecording = false;
            pttArea.classList.add('hidden');
            pttBtn.onclick = null;
            console.error("Mic error", e);
            setVoiceIndicator('idle', '❌ ' + e.message);
            failTurn(e.message);
        }
    };
}

async function handleTimeUp() {
    // หมดเวลา → หยุดฟังแล้วตัดสินแพ้
    if (isRecording) {
        stopRecognition();
        isRecording = false;
    }
    setVoiceIndicator('idle', '⏰ หมดเวลา!');
    failTurn("หมดเวลา");
}

async function processVoice(text) {
    try {
        // 1. ตรวจสอบคำนาม
        const checkResult = await checkWordAPI(text);
        
        if (!checkResult.isNoun) {
            throw new Error(`"${text}" ไม่ใช่คำนาม`);
        }
        
        // 2. Submit Word
        await submitWord(currentRoom.id, currentUser.uid, {
            word: text,
            syllables: checkResult.syllables
        });
        
        // 3. Next Turn
        setVoiceIndicator('idle', `✅ "${text}" ถูกต้อง!`);
        await nextTurn(currentRoom.id, currentUser.uid, playersList, false);
        
    } catch (e) {
        console.error("Turn failed:", e);
        setVoiceIndicator('idle', '❌ ' + e.message);
        failTurn(e.message);
    }
}

async function failTurn(reason) {
    // Current player eliminates themselves
    await eliminatePlayer(currentRoom.id, currentUser.uid);
    await nextTurn(currentRoom.id, currentUser.uid, playersList);
}

// Start
init();
