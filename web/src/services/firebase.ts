// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";

// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC-jCN0FdVss1EYSHp_zQ-VfJ_e3uOFbio",
  authDomain: "word-chain-beta.firebaseapp.com",
  projectId: "word-chain-beta",
  storageBucket: "word-chain-beta.firebasestorage.app",
  messagingSenderId: "829755903277",
  appId: "1:829755903277:web:b09943ae38aa3d8769d7a4"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const rtdb = getDatabase(app);
