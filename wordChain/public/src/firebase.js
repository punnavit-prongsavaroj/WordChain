// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// TODO: Replace with your Firebase project configuration
const firebaseConfig = {
  apiKey: "AIzaSyC-jCN0FdVss1EYSHp_zQ-VfJ_e3uOFbio",
  authDomain: "word-chain-beta.firebaseapp.com",
  projectId: "word-chain-beta",
  storageBucket: "word-chain-beta.firebasestorage.app",
  messagingSenderId: "829755903277",
  appId: "1:829755903277:web:b09943ae38aa3d8769d7a4",
  measurementId: "G-3XQTESLWTD"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db, signInAnonymously, onAuthStateChanged, serverTimestamp };
