import { db } from './firebase.js';
import { doc, setDoc, getDoc, updateDoc, onSnapshot, collection } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

let currentRoomId = null;
let roomUnsubscribe = null;

// Generate a 6-character random room code
function generateRoomCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
}

export async function createRoom(user) {
    const roomId = generateRoomCode();
    const roomRef = doc(db, "rooms", roomId);
    
    await setDoc(roomRef, {
        hostId: user.uid,
        status: "waiting", // waiting, playing, finished
        round: 0,
        totalRounds: 5,
        currentTurn: null,
        timerEnd: null,
        createdAt: new Date()
    });
    
    // Add host as a player
    await setDoc(doc(db, `rooms/${roomId}/players`, user.uid), {
        name: user.name,
        score: 0,
        eliminated: false,
        wins: 0,
        online: true,
        joinedAt: new Date()
    });
    
    currentRoomId = roomId;
    return roomId;
}

export async function joinRoom(roomId, user) {
    roomId = roomId.toUpperCase();
    const roomRef = doc(db, "rooms", roomId);
    const roomSnap = await getDoc(roomRef);
    
    if (!roomSnap.exists()) {
        throw new Error("ไม่พบห้องนี้");
    }
    
    const roomData = roomSnap.data();
    
    // Check if user is already in the room
    const playerRef = doc(db, `rooms/${roomId}/players`, user.uid);
    const playerSnap = await getDoc(playerRef);
    
    if (roomData.status !== "waiting" && !playerSnap.exists()) {
        throw new Error("ห้องนี้เริ่มเกมไปแล้ว");
    }
    
    // Add or update user as player
    if (!playerSnap.exists()) {
        await setDoc(playerRef, {
            name: user.name,
            score: 0,
            eliminated: false,
            wins: 0,
            online: true,
            joinedAt: new Date()
        });
    } else {
        await updateDoc(playerRef, {
            online: true,
            name: user.name
        });
    }
    
    currentRoomId = roomId;
    return roomId;
}

export function listenToRoom(roomId, callback) {
    if (roomUnsubscribe) roomUnsubscribe();
    
    const roomRef = doc(db, "rooms", roomId);
    roomUnsubscribe = onSnapshot(roomRef, (doc) => {
        if (doc.exists()) {
            callback({ id: doc.id, ...doc.data() });
        }
    });
}

export function listenToPlayers(roomId, callback) {
    const playersRef = collection(db, `rooms/${roomId}/players`);
    return onSnapshot(playersRef, (snapshot) => {
        const players = [];
        snapshot.forEach(doc => {
            players.push({ id: doc.id, ...doc.data() });
        });
        // Sort by join time
        players.sort((a, b) => a.joinedAt?.toMillis() - b.joinedAt?.toMillis());
        callback(players);
    });
}

export async function updateRoomSettings(roomId, settings) {
    const roomRef = doc(db, "rooms", roomId);
    await updateDoc(roomRef, settings);
}

export function getCurrentRoomId() {
    return currentRoomId;
}
