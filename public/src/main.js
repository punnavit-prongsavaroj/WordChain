import { loginAnonymously, setupAuthListener, getCurrentUser } from './auth.js';
import { createRoom, joinRoom, listenToRoom, listenToPlayers } from './room.js';
import { startGame, nextTurn, eliminatePlayer, submitWord, listenToWords, startChallengeWindow, endChallengeWindow, initiateChallenge, deleteWord, undoScore } from './game.js';
import { requestMicrophonePermission, speechToTextLive, stopRecognition, speechToText, checkWordAPI } from './speech.js';
import { startClientTimer, stopClientTimer } from './timer.js';
import { submitVote, listenToVotes, stopListeningVotes, resolveChallenge, allVotesIn } from './vote.js';
import {
    showScreen, updateLobbyUI, updateRoomUI, updateGameTopBar,
    updateGamePlayersList, updateTimerUI, setVoiceIndicator, updateWordHistory,
    showChallengeButton, hideChallengeButton,
    showVoteModal, hideVoteModal, updateVoteResults, updateVoteTimer,
    disableVoteButtons, enableVoteButtons, showVoteResult,
    showRoundTransition, hideRoundTransition, showGameOver
} from './ui.js';
import { db } from './firebase.js';
import { doc, deleteDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let currentUser = null;
let currentRoom = null;
let playersList = [];
let wordsList = [];
let isMyTurn = false;
let isRecording = false;
let currentTurnId = 0; // Track turn changes to prevent stale timer fires
let challengeTimer = null;
let voteTimer = null;
let hasVoted = false;

// DOM Elements
const loginBtn = document.getElementById('login-btn');
const playerNameInput = document.getElementById('player-name-input');
const createRoomBtn = document.getElementById('create-room-btn');
const joinRoomBtn = document.getElementById('join-room-btn');
const roomCodeInput = document.getElementById('room-code-input');
const startGameBtn = document.getElementById('start-game-btn');
const leaveRoomBtn = document.getElementById('leave-room-btn');
const authStatus = document.getElementById('auth-status');
const backToLobbyBtn = document.getElementById('back-to-lobby-btn');
const challengeBtn = document.getElementById('challenge-btn');
const voteValidBtn = document.getElementById('vote-valid-btn');
const voteInvalidBtn = document.getElementById('vote-invalid-btn');

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
            await requestMicrophonePermission();
            // Get totalRounds from select
            const roundsSelect = document.getElementById('rounds-select');
            const totalRounds = parseInt(roundsSelect.value) || 5;
            await updateDoc(doc(db, "rooms", currentRoom.id), { totalRounds });
            await startGame(currentRoom.id, playersList);
        } catch (e) {
            alert(e.message);
        }
    });

    // Leave room
    leaveRoomBtn.addEventListener('click', async () => {
        try {
            if (currentRoom && currentUser) {
                await deleteDoc(doc(db, `rooms/${currentRoom.id}/players`, currentUser.uid));
            }
            currentRoom = null;
            playersList = [];
            showScreen('lobby-screen');
        } catch (e) {
            alert(e.message);
        }
    });

    // Back to lobby from game over
    backToLobbyBtn.addEventListener('click', () => {
        currentRoom = null;
        playersList = [];
        wordsList = [];
        isMyTurn = false;
        isRecording = false;
        stopClientTimer();
        clearChallengeTimers();
        showScreen('lobby-screen');
    });

    const playAgainBtn = document.getElementById('play-again-btn');
    if (playAgainBtn) {
        playAgainBtn.addEventListener('click', async () => {
            if (!currentRoom || currentRoom.hostId !== currentUser.uid) return;
            try {
                // Keep players, but reset room state to waiting
                await updateDoc(doc(db, "rooms", currentRoom.id), {
                    status: "waiting",
                    round: 1,
                    currentTurn: null,
                    timerEnd: null,
                    finalScores: null,
                    winnerName: null,
                    lastWord: null,
                    challengePhase: null,
                    challengeWordId: null,
                    challengeWord: null,
                    challengeSpeakerId: null,
                    challengerId: null,
                    challengeEndTime: null
                });
                // All clients will hear the 'waiting' status and go back to room-screen
            } catch (e) {
                alert("Error playing again: " + e.message);
            }
        });
    }

    // Challenge button
    challengeBtn.addEventListener('click', async () => {
        if (!currentRoom || !currentRoom.challengeWordId) return;
        try {
            hideChallengeButton();
            clearTimeout(challengeTimer);
            await initiateChallenge(currentRoom.id, currentUser.uid);
        } catch (e) {
            console.error("Challenge error:", e);
        }
    });

    // Vote buttons
    voteValidBtn.addEventListener('click', async () => {
        if (hasVoted || !currentRoom?.challengeWordId) return;
        try {
            hasVoted = true;
            disableVoteButtons();
            await submitVote(currentRoom.id, currentRoom.challengeWordId, currentUser.uid, true);
        } catch (e) {
            console.error("Vote error:", e);
        }
    });

    voteInvalidBtn.addEventListener('click', async () => {
        if (hasVoted || !currentRoom?.challengeWordId) return;
        try {
            hasVoted = true;
            disableVoteButtons();
            await submitVote(currentRoom.id, currentRoom.challengeWordId, currentUser.uid, false);
        } catch (e) {
            console.error("Vote error:", e);
        }
    });

    // ===== Mic Test Logic =====
    const micTestBtn = document.getElementById('mic-test-btn');
    const micTestLabel = document.getElementById('mic-test-label');
    const micTestResult = document.getElementById('mic-test-result');
    let micTestRecording = false;
    let micTestAborted = false;

    async function onMicTestStart() {
        if (micTestRecording) return;
        micTestRecording = true;
        micTestAborted = false;

        micTestBtn.classList.add('recording');
        micTestLabel.textContent = '🔴 กำลังฟัง... (ปล่อยเมื่อพูดเสร็จ)';
        micTestResult.className = 'mic-test-result';
        micTestResult.innerHTML = '<span class="placeholder-text">พูดคำที่ต้องการทดสอบ...</span>';

        try {
            const text = await speechToTextLive(6000);

            if (micTestAborted) return;

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

    function onMicTestStop() {
        if (!micTestRecording) return;
        micTestAborted = false;
        stopRecognition();
    }

    micTestBtn.addEventListener('mousedown', onMicTestStart);
    micTestBtn.addEventListener('mouseup', onMicTestStop);
    micTestBtn.addEventListener('touchstart', (e) => { e.preventDefault(); onMicTestStart(); });
    micTestBtn.addEventListener('touchend', (e) => { e.preventDefault(); onMicTestStop(); });
}

function setupRoomListeners(roomId) {
    listenToRoom(roomId, (roomData) => {
        const prevStatus = currentRoom?.status;
        const prevChallengePhase = currentRoom?.challengePhase;
        currentRoom = roomData;
        
        if (roomData.status === "waiting") {
            if (prevStatus === "finished" || prevStatus === "playing") {
                showScreen('room-screen');
                clearChallengeTimers();
                stopClientTimer();
            }
            updateRoomUI(roomData, playersList, currentUser);
        } else if (roomData.status === "playing") {
            if (prevStatus !== "playing") {
                showScreen('game-screen');
            }
            handleGameStateChange();
            handleChallengeState(prevChallengePhase);
        } else if (roomData.status === "round_transition") {
            stopClientTimer();
            clearChallengeTimers();
            // Show round transition overlay
            const winnerPlayer = playersList.find(p => p.id === roomData.roundWinner);
            showRoundTransition(roomData.round, winnerPlayer?.name);
        } else if (roomData.status === "finished") {
            stopClientTimer();
            clearChallengeTimers();
            showScreen('game-over-screen');
            showGameOver(roomData, playersList, currentUser);
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
    currentTurnId++;
    const myTurnId = currentTurnId;
    
    // Timer Logic — only run if not in challenge phase
    if (currentRoom.timerEnd && !currentRoom.challengePhase) {
        startClientTimer(currentRoom.timerEnd, 
            () => {
                // Time up — primary responsibility is the player whose turn it is
                if (myTurnId === currentTurnId && isMyTurn) {
                    handleTimeUp();
                } else if (currentRoom.hostId === currentUser.uid && myTurnId === currentTurnId) {
                    // Host fallback: if the active player disconnected and didn't trigger handleTimeUp
                    // wait an extra 65 seconds (to allow for maximum 60s Render API cold start), then force eliminate them
                    const targetPlayer = currentRoom.currentTurn;
                    setTimeout(() => {
                        // Check if the turn hasn't changed yet
                        if (currentRoom && currentRoom.currentTurn === targetPlayer) {
                            console.log("Host forcing timeout for disconnected player");
                            forceFailTurn(targetPlayer);
                        }
                    }, 65000);
                }
            },
            (remaining) => updateTimerUI(remaining)
        );
    } else if (currentRoom.challengePhase) {
        // Pause turn timer during challenge
        stopClientTimer();
    }
    
    // Handle Turn Start
    if (isMyTurn && !currentRoom.challengePhase) {
        if (!isRecording) {
            startMyTurn(myTurnId);
        }
    } else {
        setVoiceIndicator('idle', currentRoom.challengePhase ? 'กำลังโหวต Challenge...' : 'รอถึงตาของคุณ...');
        // Hide PTT area
        document.getElementById('ptt-area').classList.add('hidden');
    }
}

function handleChallengeState(prevPhase) {
    const phase = currentRoom.challengePhase;
    const myPlayerInfo = playersList.find(p => p.id === currentUser.uid);
    const amIEliminated = myPlayerInfo?.eliminated;
    
    if (phase === "voting" && prevPhase !== "voting") {
        // Vote phase started
        hideChallengeButton();
        hasVoted = false;
        enableVoteButtons();
        
        const isSpeaker = currentRoom.challengeSpeakerId === currentUser.uid;
        const isChallenger = currentRoom.challengerId === currentUser.uid;
        // Show vote modal, allow voting if not speaker, not challenger, and not eliminated
        showVoteModal(true, currentRoom.challengeWord, !isSpeaker && !isChallenger && !amIEliminated);
        
        // Listen to votes in real-time
        listenToVotes(currentRoom.id, currentRoom.challengeWordId, (votes) => {
            const activePlayers = playersList.filter(p => !p.eliminated);
            const eligibleVoters = Math.max(0, activePlayers.length - 2); // minus speaker and challenger
            
            const validCount = votes.filter(v => v.isValid === true).length;
            const invalidCount = votes.filter(v => v.isValid === false).length;
            updateVoteResults(validCount, invalidCount, eligibleVoters);
            
            // Check if all votes are in → resolve early
            if (allVotesIn(votes, activePlayers.length)) {
                handleVoteResolution(votes, activePlayers);
            }
        });
        
        // Start vote timer (5 minutes)
        const voteEndTime = currentRoom.challengeEndTime;
        clearInterval(voteTimer);
        voteTimer = setInterval(() => {
            const endMs = voteEndTime.toMillis ? voteEndTime.toMillis() : new Date(voteEndTime).getTime();
            const remaining = endMs - Date.now();
            
            if (remaining <= 0) {
                clearInterval(voteTimer);
                updateVoteTimer(0);
                // Time's up — host resolves
                if (currentRoom.hostId === currentUser.uid) {
                    handleVoteTimeout();
                }
            } else {
                updateVoteTimer(remaining);
            }
        }, 1000);
        
    } else if (!phase) {
        // Not in challenge/voting phase
        hideVoteModal();
        stopListeningVotes();
        clearInterval(voteTimer);
        
        // Show challenge button to active players who are not the one who spoke the last word
        // Requires at least 3 active players (1 speaker, 1 challenger, 1+ voters)
        const activePlayersCount = playersList.filter(p => !p.eliminated).length;
        if (activePlayersCount > 2 && currentRoom.challengeWordId && currentRoom.challengeSpeakerId !== currentUser.uid && !amIEliminated) {
            showChallengeButton(true, false);
        } else {
            hideChallengeButton();
        }
    }
}

async function handleVoteResolution(votes, activePlayers) {
    // Only host resolves to prevent double execution
    if (currentRoom.hostId !== currentUser.uid) return;
    
    clearInterval(voteTimer);
    stopListeningVotes();
    
    const roomId = currentRoom.id;
    const speakerId = currentRoom.challengeSpeakerId;
    const wordId = currentRoom.challengeWordId;
    const challengerId = currentRoom.challengerId;
    const turnId = currentRoom.currentTurn;

    const result = resolveChallenge(votes, activePlayers.length, speakerId);
    showVoteResult(result.result, result.validCount, result.invalidCount);
    
    // Wait 2.5 seconds for players to see result
    setTimeout(async () => {
        hideVoteModal();
        
        if (result.result === "speaker_eliminated") {
            // Speaker loses — eliminate speaker, delete word, undo score
            await eliminatePlayer(roomId, speakerId);
            await deleteWord(roomId, wordId);
            await undoScore(roomId, speakerId);
            // Go to the player after the speaker (which is actually turnId, unless turnId was eliminated)
            await nextTurn(roomId, speakerId, playersList, true);
        } else {
            // Challenger loses — eliminate challenger
            await eliminatePlayer(roomId, challengerId);
            
            // Resume the interrupted turn (turnId) with a fresh timer
            const { doc, updateDoc } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
            await updateDoc(doc(db, "rooms", roomId), {
                timerEnd: new Date(Date.now() + 5000), // Give them a fresh 5 seconds
                challengePhase: null,
                challengerId: null,
                challengeEndTime: null
            });
        }
    }, 2500);
}

async function handleVoteTimeout() {
    // Time's up for voting — resolve with whatever votes we have
    // Non-voters count as "valid" (word stands)
    const activePlayers = playersList.filter(p => !p.eliminated);
    
    // We need to get current votes — the listener should have the latest
    // Use a simple timeout-based resolution
    stopListeningVotes();
    clearInterval(voteTimer);
    
    // Get votes from Firestore one more time
    const { getDocs, query, where, collection } = await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
    const votesRef = collection(db, `rooms/${currentRoom.id}/votes`);
    const q = query(votesRef, where("wordId", "==", currentRoom.challengeWordId));
    const snap = await getDocs(q);
    const votes = [];
    snap.forEach(d => votes.push({ id: d.id, ...d.data() }));
    
    await handleVoteResolution(votes, activePlayers);
}

function clearChallengeTimers() {
    clearTimeout(challengeTimer);
    clearInterval(voteTimer);
    challengeTimer = null;
    voteTimer = null;
    stopListeningVotes();
}

async function startMyTurn(turnId) {
    setVoiceIndicator('listening', '🎤 ถึงตาคุณแล้ว! กดปุ่มด้านล่าง');
    isRecording = false;

    const pttArea = document.getElementById('ptt-area');
    const pttBtn  = document.getElementById('ptt-btn');
    const pttLabel = pttBtn.querySelector('.ptt-label');

    pttArea.classList.remove('hidden');
    pttBtn.classList.remove('listening');
    pttLabel.textContent = 'กดเพื่อพูด';

    pttBtn.onclick = async () => {
        if (isRecording) return;
        if (turnId !== currentTurnId) return; // Stale turn
        isRecording = true;

        pttBtn.classList.add('listening');
        pttLabel.textContent = 'กำลังฟัง...';
        setVoiceIndicator('listening', '🔴 กำลังฟัง...');

        try {
            const text = await speechToTextLive(3500);
            isRecording = false;
            pttArea.classList.add('hidden');
            pttBtn.onclick = null;

            if (turnId !== currentTurnId) return; // Turn changed while recording

            if (!text || text.trim() === '') {
                setVoiceIndicator('idle', '🔇 ฟังไม่รู้เรื่อง');
                failTurn("ไม่ได้ยินเสียง");
                return;
            }

            stopClientTimer(); // หยุดเวลาไว้ก่อนระหว่างรอตรวจสอบคำ

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
    if (isRecording) {
        stopRecognition();
        isRecording = false;
    }
    document.getElementById('ptt-area').classList.add('hidden');
    setVoiceIndicator('idle', '⏰ หมดเวลา!');
    failTurn("หมดเวลา");
}

async function processVoice(text) {
    try {
        // 1. Check if noun
        const checkResult = await checkWordAPI(text);
        
        if (!checkResult.isNoun) {
            throw new Error(`"${text}" ไม่ใช่คำนาม`);
        }
        
        // 2. Submit Word (returns wordId)
        const wordId = await submitWord(currentRoom.id, currentUser.uid, {
            word: text,
            syllables: checkResult.syllables
        });
        
        // 3. Stop turn timer
        stopClientTimer();
        setVoiceIndicator('idle', `✅ "${text}" ถูกต้อง!`);
        
        // 4. Update challengeable word and go to next turn immediately
        await updateDoc(doc(db, "rooms", currentRoom.id), {
            challengeWordId: wordId,
            challengeWord: text,
            challengeSpeakerId: currentUser.uid
        });
        
        await nextTurn(currentRoom.id, currentUser.uid, playersList, false);
        
    } catch (e) {
        console.error("Turn failed:", e);
        setVoiceIndicator('idle', '❌ ' + e.message);
        failTurn(e.message);
    }
}

async function forceFailTurn(playerId) {
    if (currentRoom.hostId !== currentUser.uid) return;
    try {
        await eliminatePlayer(currentRoom.id, playerId);
        await nextTurn(currentRoom.id, playerId, playersList);
    } catch (e) {
        console.error("Host force fail error:", e);
    }
}

async function failTurn(reason) {
    stopClientTimer();
    await eliminatePlayer(currentRoom.id, currentUser.uid);
    await nextTurn(currentRoom.id, currentUser.uid, playersList);
}

// Start
init();
