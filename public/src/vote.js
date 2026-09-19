import { db, serverTimestamp } from './firebase.js';
import { collection, addDoc, onSnapshot, query, where, getDocs, deleteDoc, doc } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let votesUnsubscribe = null;

/**
 * Submit a challenge vote (✅ valid or ❌ invalid)
 */
export async function submitVote(roomId, wordId, voterId, isValid) {
    const votesRef = collection(db, `rooms/${roomId}/votes`);
    
    // Check if already voted
    const q = query(votesRef, where("voter", "==", voterId), where("wordId", "==", wordId));
    const snap = await getDocs(q);
    
    if (!snap.empty) {
        throw new Error("คุณได้โหวตไปแล้ว");
    }
    
    await addDoc(votesRef, {
        voter: voterId,
        wordId: wordId,
        isValid: isValid,
        createdAt: serverTimestamp()
    });
}

/**
 * Listen to votes for a specific word in real-time
 */
export function listenToVotes(roomId, wordId, callback) {
    if (votesUnsubscribe) votesUnsubscribe();
    
    const votesRef = collection(db, `rooms/${roomId}/votes`);
    const q = query(votesRef, where("wordId", "==", wordId));
    
    votesUnsubscribe = onSnapshot(q, (snapshot) => {
        const votes = [];
        snapshot.forEach(doc => {
            votes.push({ id: doc.id, ...doc.data() });
        });
        callback(votes);
    });
}

/**
 * Stop listening to votes
 */
export function stopListeningVotes() {
    if (votesUnsubscribe) {
        votesUnsubscribe();
        votesUnsubscribe = null;
    }
}

/**
 * Resolve a challenge based on collected votes
 * Returns: { result: "speaker_eliminated" | "challenger_eliminated", validCount, invalidCount }
 */
export function resolveChallenge(votes, activePlayerCount, speakerId) {
    // Count votes (excluding speaker and challenger who can't vote)
    const validVotes = votes.filter(v => v.isValid === true).length;
    const invalidVotes = votes.filter(v => v.isValid === false).length;
    
    // Players who didn't vote count as "valid" (word stands)
    const eligibleVoters = Math.max(0, activePlayerCount - 2); // minus speaker and challenger
    const nonVoters = Math.max(0, eligibleVoters - validVotes - invalidVotes);
    const totalValid = validVotes + nonVoters; // non-voters = word is valid
    
    // Majority of invalid votes needed to eliminate speaker
    if (invalidVotes > totalValid) {
        return { result: "speaker_eliminated", validCount: totalValid, invalidCount: invalidVotes };
    } else {
        // Tie or majority valid → challenger is eliminated
        return { result: "challenger_eliminated", validCount: totalValid, invalidCount: invalidVotes };
    }
}

/**
 * Check if all eligible players have voted
 */
export function allVotesIn(votes, activePlayerCount) {
    const eligibleVoters = Math.max(0, activePlayerCount - 2); // minus speaker and challenger
    return votes.length >= eligibleVoters;
}
