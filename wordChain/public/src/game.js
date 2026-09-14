import { db, serverTimestamp } from './firebase.js';
import { doc, updateDoc, getDoc, collection, onSnapshot, addDoc, query, orderBy, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let wordsUnsubscribe = null;

export async function startGame(roomId, players) {
    if (players.length < 2) { // Allow 2 for testing, realistically 3+
        throw new Error("ต้องมีผู้เล่นอย่างน้อย 2 คน");
    }
    
    const roomRef = doc(db, "rooms", roomId);
    
    // Reset all players status just in case
    for (const p of players) {
        await updateDoc(doc(db, `rooms/${roomId}/players`, p.id), {
            eliminated: false,
            score: 0
        });
    }
    
    // Calculate timer end (e.g., current time + 3 seconds)
    // We use serverTimestamp in actual update, but to get exactly 3 seconds, 
    // it's tricky without a cloud function. We'll set a timestamp offset.
    // In a fully robust app, a backend would set this.
    
    const firstPlayer = players[0];
    
    await updateDoc(roomRef, {
        status: "playing",
        round: 1,
        currentTurn: firstPlayer.id,
        timerEnd: new Date(Date.now() + 5000), // Give 5 seconds for the first turn to be safe
        lastWord: null
    });
}

export async function nextTurn(roomId, currentPlayerId, playersList, isEliminated = true) {
    // Treat current player as eliminated if specified (due to race condition with onSnapshot)
    const updatedPlayersList = playersList.map(p => 
        p.id === currentPlayerId && isEliminated ? { ...p, eliminated: true } : p
    );

    const currentIndex = updatedPlayersList.findIndex(p => p.id === currentPlayerId);
    let nextIndex = (currentIndex + 1) % updatedPlayersList.length;
    
    let loops = 0;
    while (updatedPlayersList[nextIndex].eliminated && loops < updatedPlayersList.length) {
        nextIndex = (nextIndex + 1) % updatedPlayersList.length;
        loops++;
    }
    
    const activePlayers = updatedPlayersList.filter(p => !p.eliminated);
    if (activePlayers.length <= 1) {
        await handleRoundOver(roomId);
        return;
    }
    
    const nextPlayer = updatedPlayersList[nextIndex];
    
    await updateDoc(doc(db, "rooms", roomId), {
        currentTurn: nextPlayer.id,
        timerEnd: new Date(Date.now() + 4000) 
    });
}

export async function eliminatePlayer(roomId, playerId) {
    await updateDoc(doc(db, `rooms/${roomId}/players`, playerId), {
        eliminated: true
    });
}

async function handleRoundOver(roomId) {
    const roomRef = doc(db, "rooms", roomId);
    const roomSnap = await getDoc(roomRef);
    const data = roomSnap.data();
    
    const nextRound = data.round + 1;
    if (nextRound > data.totalRounds) {
        await updateDoc(roomRef, { status: "finished" });
    } else {
        // Just advance round, don't auto start, wait for next round trigger
        // Or auto start after delay
        await updateDoc(roomRef, {
            round: nextRound,
            // Reset state here...
        });
    }
}

export async function submitWord(roomId, playerId, wordData) {
    // wordData = { word: "โรงเรียน", syllables: ["โรง", "เรียน"] }
    
    const wordsRef = collection(db, `rooms/${roomId}/words`);
    
    // Check local duplicate (though should check server)
    const q = query(wordsRef, orderBy("createdAt", "asc"));
    const snap = await getDocs(q);
    const usedSyllables = new Set();
    
    snap.forEach(doc => {
        const data = doc.data();
        data.syllables.forEach(s => usedSyllables.add(s));
    });
    
    // Check duplicates
    const isDuplicate = wordData.syllables.some(s => usedSyllables.has(s));
    
    if (isDuplicate) {
        throw new Error("คำนี้มีพยางค์ซ้ำกับที่เคยพูดไปแล้ว");
    }
    
    // Add word
    await addDoc(wordsRef, {
        word: wordData.word,
        syllables: wordData.syllables,
        playerId: playerId,
        createdAt: serverTimestamp()
    });
    
    // Update score
    const playerRef = doc(db, `rooms/${roomId}/players`, playerId);
    const playerSnap = await getDoc(playerRef);
    await updateDoc(playerRef, {
        score: playerSnap.data().score + 1
    });
    
    // Update room latest word
    await updateDoc(doc(db, "rooms", roomId), {
        lastWord: wordData.word
    });
}

export function listenToWords(roomId, callback) {
    if (wordsUnsubscribe) wordsUnsubscribe();
    
    const wordsRef = collection(db, `rooms/${roomId}/words`);
    const q = query(wordsRef, orderBy("createdAt", "asc"));
    
    wordsUnsubscribe = onSnapshot(q, (snapshot) => {
        const words = [];
        snapshot.forEach(doc => {
            words.push({ id: doc.id, ...doc.data() });
        });
        callback(words);
    });
}
