import { db, serverTimestamp } from './firebase.js';
import { collection, addDoc, onSnapshot, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let votesUnsubscribe = null;

export async function challengeWord(roomId, voterId, targetWordId) {
    const votesRef = collection(db, `rooms/${roomId}/votes`);
    
    // Check if already voted
    const q = query(votesRef, where("voter", "==", voterId), where("target", "==", targetWordId));
    const snap = await getDocs(q);
    
    if (!snap.empty) {
        throw new Error("คุณได้ Challenge คำนี้ไปแล้ว");
    }
    
    await addDoc(votesRef, {
        voter: voterId,
        target: targetWordId,
        vote: "challenge",
        createdAt: serverTimestamp()
    });
}

export function listenToChallenges(roomId, targetWordId, callback) {
    if (votesUnsubscribe) votesUnsubscribe();
    
    const votesRef = collection(db, `rooms/${roomId}/votes`);
    const q = query(votesRef, where("target", "==", targetWordId));
    
    votesUnsubscribe = onSnapshot(q, (snapshot) => {
        const votes = [];
        snapshot.forEach(doc => {
            votes.push({ id: doc.id, ...doc.data() });
        });
        callback(votes);
    });
}
