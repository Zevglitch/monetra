
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

// ========================================
// 1. FIREBASE CONFIGURATION
// ========================================

const firebaseConfig = {
    apiKey: "AIzaSyCMZ8LhkvXw7VjWjIc4nFdxvhraxFyaoFY",
    authDomain: "monetra-finance-4ef9f.firebaseapp.com",
    projectId: "monetra-finance-4ef9f",
    storageBucket: "monetra-finance-4ef9f.firebasestorage.app",
    messagingSenderId: "111887647500",
    appId: "1:111887647500:web:e5196119be83a79a927f29",
    measurementId: "G-LN0TCTEMN0"
};

// ========================================
// 2. INITIALIZE FIREBASE
// ========================================

const firebaseApp = initializeApp(firebaseConfig);

// ========================================
// 3. AUTHENTICATION
// ========================================

const auth = getAuth(firebaseApp);

// ========================================
// 4. FIRESTORE DATABASE
// ========================================

const db = getFirestore(firebaseApp);

// ========================================
// 5. AUTH PERSISTENCE
// ========================================

// Menyimpan sesi login secara lokal.
// Pengguna tidak harus login ulang setiap
// kali membuka kembali browser.

const authPersistence = setPersistence(
    auth,
    browserLocalPersistence
).catch(error => {
    console.error("Monetra Persistence Error:", error);
    throw error;
});

// ========================================
// 6. FIREBASE STATUS
// ========================================

const firebaseReady = authPersistence.then(() => {
    console.log("Monetra: Firebase siap digunakan.");

    return true;
});

// ========================================
// 7. EXPORT MODULES
// ========================================

export {
    firebaseApp,
    auth,
    db,
    authPersistence,
    firebaseReady
};
