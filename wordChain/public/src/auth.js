import { auth, signInAnonymously, onAuthStateChanged } from './firebase.js';

let currentUser = null;

export async function loginAnonymously(playerName) {
    if (!playerName || playerName.trim() === '') {
        throw new Error('Please enter a valid name.');
    }
    
    try {
        const userCredential = await signInAnonymously(auth);
        const user = userCredential.user;
        
        // Store name locally since anonymous auth doesn't store display name easily
        // without an update profile call. LocalStorage is fine for this demo.
        localStorage.setItem('playerName', playerName.trim());
        currentUser = user;
        
        return user;
    } catch (error) {
        console.error("Auth error:", error);
        throw error;
    }
}

export function setupAuthListener(callback) {
    onAuthStateChanged(auth, (user) => {
        const name = localStorage.getItem('playerName');
        if (user && name) {
            currentUser = user;
            callback({ uid: user.uid, name: name });
        } else {
            currentUser = user;
            callback(null);
        }
    });
}

export function getCurrentUser() {
    if (!currentUser) return null;
    return {
        uid: currentUser.uid,
        name: localStorage.getItem('playerName') || 'Player'
    };
}
