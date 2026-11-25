
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail,
    onAuthStateChanged,
    updateProfile
} from "https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js";

import {
    auth,
    authPersistence
} from "./firebase.js";

// ========================================
// 1. FIREBASE INITIALIZATION
// ========================================

async function waitForFirebase() {
    if (authPersistence) {
        await authPersistence;
    }

    if (!auth) {
        throw new Error("Firebase Authentication belum tersedia.");
    }
}

// ========================================
// 2. ERROR HANDLER
// ========================================

export function getAuthErrorMessage(error) {
    const code = error?.code || "";

    const messages = {
        "auth/email-already-in-use":
            "Email ini sudah digunakan.",

        "auth/invalid-email":
            "Format email tidak valid.",

        "auth/weak-password":
            "Password terlalu lemah. Minimal 6 karakter.",

        "auth/user-not-found":
            "Akun tidak ditemukan.",

        "auth/wrong-password":
            "Password yang kamu masukkan salah.",

        "auth/invalid-credential":
            "Email atau password salah.",

        "auth/invalid-login-credentials":
            "Email atau password salah.",

        "auth/user-disabled":
            "Akun telah dinonaktifkan.",

        "auth/too-many-requests":
            "Terlalu banyak percobaan. Coba lagi nanti.",

        "auth/network-request-failed":
            "Koneksi internet bermasalah.",

        "auth/operation-not-allowed":
            "Metode autentikasi belum diaktifkan.",

        "auth/missing-password":
            "Password wajib diisi.",

        "auth/missing-email":
            "Email wajib diisi.",

        "auth/requires-recent-login":
            "Silakan login kembali.",

        "auth/unauthorized-domain":
            "Domain website belum diizinkan di Firebase.",

        "auth/expired-action-code":
            "Link tindakan sudah kedaluwarsa.",

        "auth/invalid-action-code":
            "Link tindakan tidak valid."
    };

    return messages[code] ||
        error?.message ||
        "Terjadi kesalahan. Silakan coba kembali.";
}

// ========================================
// 3. VALIDATION
// ========================================

function validateEmail(email) {
    const pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return pattern.test(email);
}

function validatePassword(password) {
    return typeof password === "string" &&
        password.length >= 6;
}

// ========================================
// 4. REGISTER
// ========================================

export async function registerUser(name, email, password) {
    try {
        await waitForFirebase();

        const cleanName = String(name || "").trim();
        const cleanEmail = String(email || "").trim().toLowerCase();

        if (!cleanName || !cleanEmail || !password) {
            return {
                success: false,
                message: "Semua kolom wajib diisi."
            };
        }

        if (!validateEmail(cleanEmail)) {
            return {
                success: false,
                message: "Format email tidak valid."
            };
        }

        if (!validatePassword(password)) {
            return {
                success: false,
                message: "Password minimal 6 karakter."
            };
        }

        const credential = await createUserWithEmailAndPassword(
            auth,
            cleanEmail,
            password
        );

        await updateProfile(credential.user, {
            displayName: cleanName
        });

        return {
            success: true,
            user: credential.user,
            message: "Akun berhasil dibuat."
        };

    } catch (error) {
        console.error("Monetra Register Error:", error);

        return {
            success: false,
            message: getAuthErrorMessage(error),
            code: error?.code || "unknown"
        };
    }
}

// ========================================
// 5. LOGIN
// ========================================

export async function loginUser(email, password) {
    try {
        await waitForFirebase();

        const cleanEmail = String(email || "").trim().toLowerCase();

        if (!cleanEmail || !password) {
            return {
                success: false,
                message: "Email dan password wajib diisi."
            };
        }

        if (!validateEmail(cleanEmail)) {
            return {
                success: false,
                message: "Format email tidak valid."
            };
        }

        const credential = await signInWithEmailAndPassword(
            auth,
            cleanEmail,
            password
        );

        return {
            success: true,
            user: credential.user,
            message: "Login berhasil."
        };

    } catch (error) {
        console.error("Monetra Login Error:", error);

        return {
            success: false,
            message: getAuthErrorMessage(error),
            code: error?.code || "unknown"
        };
    }
}

// ========================================
// 6. LOGOUT
// ========================================

export async function logoutUser() {
    try {
        await waitForFirebase();

        await signOut(auth);

        return {
            success: true,
            message: "Berhasil keluar dari akun."
        };

    } catch (error) {
        console.error("Monetra Logout Error:", error);

        throw new Error(getAuthErrorMessage(error));
    }
}

// ========================================
// 7. RESET PASSWORD
// ========================================

export async function resetPassword(email) {
    try {
        await waitForFirebase();

        const cleanEmail = String(email || "").trim().toLowerCase();

        if (!cleanEmail) {
            return {
                success: false,
                message: "Masukkan email terlebih dahulu."
            };
        }

        if (!validateEmail(cleanEmail)) {
            return {
                success: false,
                message: "Format email tidak valid."
            };
        }

        await sendPasswordResetEmail(auth, cleanEmail);

        return {
            success: true,
            message: "Link reset password berhasil dikirim ke email."
        };

    } catch (error) {
        console.error("Monetra Reset Password Error:", error);

        return {
            success: false,
            message: getAuthErrorMessage(error),
            code: error?.code || "unknown"
        };
    }
}

// ========================================
// 8. AUTH OBSERVER
// ========================================

export function observeAuth(callback) {
    if (typeof callback !== "function") {
        throw new Error("Callback autentikasi tidak valid.");
    }

    return onAuthStateChanged(
        auth,
        user => {
            try {
                callback(user);
            } catch (error) {
                console.error("Monetra Auth Callback Error:", error);
            }
        },
        error => {
            console.error("Monetra Auth Observer Error:", error);
        }
    );
}

// ========================================
// 9. CURRENT USER
// ========================================

export function getCurrentUser() {
    return auth?.currentUser || null;
}

// ========================================
// 10. AUTH STATE
// ========================================

export function isUserLoggedIn() {
    return Boolean(auth?.currentUser);
}
