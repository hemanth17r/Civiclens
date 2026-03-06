import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "firebase/app-check";

const firebaseConfig = {
    apiKey: "AIzaSyBJtNV6_Tk1JBvL8q-jQieL7s8VCMs23Io",
    authDomain: "civiclens-dd80b.firebaseapp.com",
    projectId: "civiclens-dd80b",
    storageBucket: "civiclens-dd80b.firebasestorage.app",
    messagingSenderId: "1079522964144",
    appId: "1:1079522964144:web:ba3182639e912e28308175",
    measurementId: "G-YTDS68DGF8"
};

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Firebase AppCheck for web if in browser and key exists
if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY && process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY !== "dummy-key-replace-me") {
    initializeAppCheck(app, {
        provider: new ReCaptchaEnterpriseProvider(process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY),
        isTokenAutoRefreshEnabled: true
    });
}

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();

export { app, auth, db, storage, googleProvider };
