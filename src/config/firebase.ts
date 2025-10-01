import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

// Replace these with your Firebase config values
const firebaseConfig = {
  apiKey: "AIzaSyBZR5Lsy6Aq6VtH8Aqwnvjw2LkWCPUITCo",
  authDomain: "kommyut-auth.firebaseapp.com",
  projectId: "kommyut-auth",
  storageBucket: "kommyut-auth.firebasestorage.app",
  messagingSenderId: "734642245285",
  appId: "1:734642245285:web:72646c234043be6eeb874c"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
