
import { initializeApp } from
    "https://www.gstatic.com/firebasejs/13.4.0/firebase-app.js";

import {
    getAuth,
    setPersistence,
    browserLocalPersistence
} from
    "https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js";

import {
    getFirestore
} from
    "https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js";

// ======================================
// KONFIGURASI FIREBASE MONETRA
// ======================================

const firebaseConfig = {
    apiKey: "AIzaSyCMZ8LhkvXw7VjWjIc4nFdxvhraxFyaoFY",
    authDomain: "monetra-finance-4ef9f.firebaseapp.com",
    projectId: "monetra-finance-4ef9f",
    storageBucket: "monetra-finance-4ef9f.firebasestorage.app",
    messagingSenderId: "111887647500",
    appId: "1:111887647500:web:e5196119be83a79a927f29",
    measurementId: "G-LN0TCTEMN0"
};

// ======================================
// INISIALISASI FIREBASE
// ======================================

const firebaseApp = initializeApp(firebaseConfig);

// Firebase Authentication
const auth = getAuth(firebaseApp);

// Firestore Database
const db = getFirestore(firebaseApp);

// ======================================
// PERSISTENCE LOGIN
// ======================================

// Menjaga sesi login tetap tersimpan
// setelah browser ditutup atau halaman dimuat ulang.

const authPersistence = setPersistence(
    auth,
    browserLocalPersistence
);

// ======================================
// EXPORT
// ======================================

export {
    firebaseApp,
    auth,
    db,
    authPersistence
};

console.log("Monetra: Firebase berhasil diinisialisasi.");
