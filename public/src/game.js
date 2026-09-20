import { db, serverTimestamp } from './firebase.js';
import { doc, updateDoc, getDoc, collection, onSnapshot, addDoc, query, orderBy, getDocs, deleteDoc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let wordsUnsubscribe = null;

export async function startGame(roomId, players) {
    if (players.length < 2) {
        throw new Error("ต้องมีผู้เล่นอย่างน้อย 2 คน");
    }
    
    const roomRef = doc(db, "rooms", roomId);
    
    // Reset all players status
    for (const p of players) {
        await updateDoc(doc(db, `rooms/${roomId}/players`, p.id), {
            eliminated: false,
            score: 0,
            wins: p.wins || 0
        });
    }

    // Clear any leftover words from previous games
    await clearWords(roomId);
    // Clear any leftover votes
    await clearVotes(roomId);
    
    const firstPlayer = players[0];
    
    await updateDoc(roomRef, {
        status: "playing",
        round: 1,
        currentTurn: firstPlayer.id,
        timerEnd: new Date(Date.now() + 10000), // Give first person 10 seconds
        lastWord: null,
        // Challenge fields
        challengePhase: null,
        challengeWordId: null,
        challengeWord: null,
        challengeSpeakerId: null,
        challengerId: null,
        challengeEndTime: null
    });
}

export async function nextTurn(roomId, currentPlayerId, playersList, isEliminated = true) {
    // Treat current player as eliminated if specified
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
        await handleRoundOver(roomId, activePlayers);
        return;
    }
    
    const nextPlayer = updatedPlayersList[nextIndex];
    
    await updateDoc(doc(db, "rooms", roomId), {
        currentTurn: nextPlayer.id,
        timerEnd: new Date(Date.now() + 5000),
        // Reset challenge phase but keep the word details so it can be challenged
        challengePhase: null,
        challengerId: null,
        challengeEndTime: null
    });
}

export async function eliminatePlayer(roomId, playerId, reason = "คัดออก") {
    await updateDoc(doc(db, `rooms/${roomId}/players`, playerId), {
        eliminated: true,
        deathReason: reason
    });
}

async function handleRoundOver(roomId, remainingPlayers) {
    const roomRef = doc(db, "rooms", roomId);
    const roomSnap = await getDoc(roomRef);
    const data = roomSnap.data();
    
    // Award win to the last standing player
    if (remainingPlayers.length === 1) {
        const winnerId = remainingPlayers[0].id;
        const winnerRef = doc(db, `rooms/${roomId}/players`, winnerId);
        const winnerSnap = await getDoc(winnerRef);
        const winnerData = winnerSnap.data();
        await updateDoc(winnerRef, {
            wins: (winnerData.wins || 0) + 1
        });
    }
    
    const nextRound = data.round + 1;
    
    if (nextRound > data.totalRounds) {
        // Game finished — get final scores
        const playersRef = collection(db, `rooms/${roomId}/players`);
        const playersSnap = await getDocs(playersRef);
        const finalScores = [];
        playersSnap.forEach(d => {
            finalScores.push({ id: d.id, ...d.data() });
        });
        finalScores.sort((a, b) => (b.wins || 0) - (a.wins || 0));

        await updateDoc(roomRef, {
            status: "finished",
            currentTurn: null,
            timerEnd: null,
            finalScores: finalScores.map(p => ({
                id: p.id,
                name: p.name,
                wins: p.wins || 0,
                score: p.score || 0
            })),
            winnerName: finalScores[0]?.name || "ไม่มีผู้ชนะ",
            challengePhase: null
        });
    } else {
        // Transition to next round
        await updateDoc(roomRef, {
            status: "round_transition",
            round: nextRound,
            currentTurn: null,
            timerEnd: null,
            roundWinner: remainingPlayers.length === 1 ? remainingPlayers[0].id : null,
            challengePhase: null
        });

        // Reset all players for next round (after short delay for UI)
        setTimeout(async () => {
            const playersRef = collection(db, `rooms/${roomId}/players`);
            const playersSnap = await getDocs(playersRef);
            const allPlayers = [];
            playersSnap.forEach(d => {
                allPlayers.push({ id: d.id, ...d.data() });
            });

            for (const p of allPlayers) {
                await updateDoc(doc(db, `rooms/${roomId}/players`, p.id), {
                    eliminated: false,
                    score: 0
                });
            }

            // Clear words for new round
            await clearWords(roomId);
            await clearVotes(roomId);

            // Start new round
            const sortedPlayers = allPlayers.sort((a, b) => 
                (a.joinedAt?.toMillis?.() || 0) - (b.joinedAt?.toMillis?.() || 0)
            );
            const firstPlayer = sortedPlayers[0];

            await updateDoc(roomRef, {
                status: "playing",
                currentTurn: firstPlayer.id,
                timerEnd: new Date(Date.now() + 10000), // Give first person 10 seconds
                lastWord: null,
                roundWinner: null,
                challengePhase: null,
                challengeWordId: null,
                challengeWord: null,
                challengeSpeakerId: null,
                challengerId: null,
                challengeEndTime: null
            });
        }, 3000);
    }
}

export async function submitWord(roomId, playerId, wordData) {
    const wordsRef = collection(db, `rooms/${roomId}/words`);
    
    // Check duplicate syllables
    const q = query(wordsRef, orderBy("createdAt", "asc"));
    const snap = await getDocs(q);
    const usedSyllables = new Set();
    
    snap.forEach(doc => {
        const data = doc.data();
        data.syllables.forEach(s => usedSyllables.add(s));
    });
    
    const isDuplicate = wordData.syllables.some(s => usedSyllables.has(s));
    
    if (isDuplicate) {
        throw new Error("คำนี้มีพยางค์ซ้ำกับที่เคยพูดไปแล้ว");
    }
    
    // Add word
    const wordDoc = await addDoc(wordsRef, {
        word: wordData.word,
        syllables: wordData.syllables,
        playerId: playerId,
        createdAt: serverTimestamp()
    });
    
    // Update score
    const playerRef = doc(db, `rooms/${roomId}/players`, playerId);
    const playerSnap = await getDoc(playerRef);
    await updateDoc(playerRef, {
        score: (playerSnap.data().score || 0) + 1
    });
    
    // Update room latest word
    await updateDoc(doc(db, "rooms", roomId), {
        lastWord: wordData.word
    });

    return wordDoc.id; // Return word ID for challenge reference
}

// Start challenge window — called after word is accepted
export async function startChallengeWindow(roomId, wordId, word, speakerId) {
    await updateDoc(doc(db, "rooms", roomId), {
        challengePhase: "challenge",
        challengeWordId: wordId,
        challengeWord: word,
        challengeSpeakerId: speakerId,
        challengerId: null,
        challengeEndTime: new Date(Date.now() + 3000) // 3 seconds to challenge
    });
}

// End challenge window and go to next turn (no one challenged)
export async function endChallengeWindow(roomId) {
    await updateDoc(doc(db, "rooms", roomId), {
        challengePhase: null,
        challengeWordId: null,
        challengeWord: null,
        challengeSpeakerId: null,
        challengerId: null,
        challengeEndTime: null
    });
}

// Initiate a challenge vote
export async function initiateChallenge(roomId, challengerId) {
    await updateDoc(doc(db, "rooms", roomId), {
        challengePhase: "voting",
        challengerId: challengerId,
        challengeEndTime: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes to vote
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

export function stopListeningWords() {
    if (wordsUnsubscribe) {
        wordsUnsubscribe();
        wordsUnsubscribe = null;
    }
}

// Delete a specific word (used when challenge succeeds)
export async function deleteWord(roomId, wordId) {
    await deleteDoc(doc(db, `rooms/${roomId}/words`, wordId));
}

// Undo score for a specific player
export async function undoScore(roomId, playerId) {
    const playerRef = doc(db, `rooms/${roomId}/players`, playerId);
    const playerSnap = await getDoc(playerRef);
    const currentScore = playerSnap.data().score || 0;
    await updateDoc(playerRef, {
        score: Math.max(0, currentScore - 1)
    });
}

// Clear all words in a room (for round reset)
async function clearWords(roomId) {
    const wordsRef = collection(db, `rooms/${roomId}/words`);
    const snap = await getDocs(wordsRef);
    const deletePromises = [];
    snap.forEach(d => {
        deletePromises.push(deleteDoc(doc(db, `rooms/${roomId}/words`, d.id)));
    });
    await Promise.all(deletePromises);
}

// Clear all votes in a room
async function clearVotes(roomId) {
    const votesRef = collection(db, `rooms/${roomId}/votes`);
    const snap = await getDocs(votesRef);
    const deletePromises = [];
    snap.forEach(d => {
        deletePromises.push(deleteDoc(doc(db, `rooms/${roomId}/votes`, d.id)));
    });
    await Promise.all(deletePromises);
}
