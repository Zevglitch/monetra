
import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    sendPasswordResetEmail,
    onAuthStateChanged,
    updateProfile
} from
    "https://www.gstatic.com/firebasejs/13.4.0/firebase-auth.js";

import {
    auth,
    authPersistence
} from "./firebase.js";

// ======================================
// MENUNGGU FIREBASE SIAP
// ======================================

async function waitForFirebase() {
    await authPersistence;
}

// ======================================
// PESAN ERROR FIREBASE
// ======================================

export function getAuthErrorMessage(error) {
    const errorCode = error?.code || "";

    const messages = {
        "auth/email-already-in-use":
            "Email ini sudah digunakan oleh akun lain.",

        "auth/invalid-email":
            "Format email tidak valid.",

        "auth/weak-password":
            "Password terlalu lemah. Gunakan minimal 6 karakter.",

        "auth/user-not-found":
            "Akun dengan email tersebut tidak ditemukan.",

        "auth/wrong-password":
            "Password yang kamu masukkan salah.",

        "auth/invalid-credential":
            "Email atau password salah.",

        "auth/invalid-login-credentials":
            "Email atau password salah.",

        "auth/user-disabled":
            "Akun ini telah dinonaktifkan.",

        "auth/too-many-requests":
            "Terlalu banyak percobaan. Silakan coba beberapa saat lagi.",

        "auth/network-request-failed":
            "Koneksi internet bermasalah. Periksa jaringanmu.",

        "auth/operation-not-allowed":
            "Metode login belum diaktifkan di Firebase.",

        "auth/missing-password":
            "Password belum diisi.",

        "auth/missing-email":
            "Email belum diisi.",

        "auth/requires-recent-login":
            "Silakan login kembali untuk melakukan tindakan ini.",

        "auth/unauthorized-domain":
            "Domain website belum diizinkan di Firebase."
    };

    return messages[errorCode] ||
        error?.message ||
        "Terjadi kesalahan. Silakan coba kembali.";
}

// ======================================
// PENDAFTARAN AKUN
// ======================================

export async function registerUser(name, email, password) {
    try {
        await waitForFirebase();

        const cleanName = String(name || "").trim();
        const cleanEmail = String(email || "").trim();

        if (!cleanName || !cleanEmail || !password) {
            return {
                success: false,
                message: "Semua kolom wajib diisi."
            };
        }

        if (password.length < 6) {
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
            message: "Pendaftaran berhasil."
        };

    } catch (error) {
        console.error("Monetra register error:", error);

        return {
            success: false,
            message: getAuthErrorMessage(error),
            code: error.code || "unknown"
        };
    }
}

// ======================================
// LOGIN AKUN
// ======================================

export async function loginUser(email, password) {
    try {
        await waitForFirebase();

        const cleanEmail = String(email || "").trim();

        if (!cleanEmail || !password) {
            return {
                success: false,
                message: "Email dan password wajib diisi."
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
        console.error("Monetra login error:", error);

        return {
            success: false,
            message: getAuthErrorMessage(error),
            code: error.code || "unknown"
        };
    }
}

// ======================================
// LOGOUT
// ======================================

export async function logoutUser() {
    try {
        await waitForFirebase();

        await signOut(auth);

        return {
            success: true,
            message: "Berhasil keluar dari akun."
        };

    } catch (error) {
        console.error("Monetra logout error:", error);

        throw new Error(getAuthErrorMessage(error));
    }
}

// ======================================
// RESET PASSWORD
// ======================================

export async function resetPassword(email) {
    try {
        await waitForFirebase();

        const cleanEmail = String(email || "").trim();

        if (!cleanEmail) {
            return {
                success: false,
                message: "Masukkan alamat email terlebih dahulu."
            };
        }

        await sendPasswordResetEmail(auth, cleanEmail);

        return {
            success: true,
            message: "Email reset password berhasil dikirim."
        };

    } catch (error) {
        console.error("Monetra reset password error:", error);

        return {
            success: false,
            message: getAuthErrorMessage(error),
            code: error.code || "unknown"
        };
    }
}

// ======================================
// MEMANTAU STATUS LOGIN
// ======================================

export function observeAuth(callback) {
    if (typeof callback !== "function") {
        throw new Error("Callback autentikasi tidak valid.");
    }

    return onAuthStateChanged(
        auth,
        user => {
            callback(user);
        },
        error => {
            console.error("Monetra auth observer error:", error);
        }
    );
}

// ======================================
// MENDAPATKAN USER AKTIF
// ======================================

export function getCurrentUser() {
    return auth.currentUser;
}
