// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
export const firebaseConfig = {
  apiKey: "AIzaSyCGWeOGc0ANw8KKgtONqFzAdhWeQACTvWE",
  authDomain: "good-fast-pay.firebaseapp.com",
  projectId: "good-fast-pay",
  storageBucket: "good-fast-pay.firebasestorage.app",
  messagingSenderId: "1010521921961",
  appId: "1:1010521921961:web:584ebd5170241bd2778cb8",
  measurementId: "G-BHGFGEG7WE"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const analytics = typeof window !== "undefined" ? getAnalytics(app) : null;
export const db = getFirestore(app);
export const auth = getAuth(app);
