
/* =====================================
   MONETRA
   USER DATA MANAGEMENT
===================================== */

import {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js";

import { db } from "./firebase.js";


/* =====================================
   CREATE OR GET USER PROFILE
===================================== */

export async function ensureUserProfile(user) {
    if (!user || !user.uid) {
        throw new Error("Pengguna tidak valid.");
    }

    const userRef = doc(db, "users", user.uid);

    try {
        const snapshot = await getDoc(userRef);

        if (!snapshot.exists()) {
            const profile = {
                uid: user.uid,
                name: user.displayName || "",
                email: user.email || "",
                currency: "IDR",

                settings: {
                    theme: "monochrome",
                    language: "id"
                },

                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            };

            await setDoc(userRef, profile);

            return {
                uid: user.uid,
                name: user.displayName || "",
                email: user.email || "",
                currency: "IDR",
                settings: {
                    theme: "monochrome",
                    language: "id"
                }
            };
        }

        return snapshot.data();

    } catch (error) {
        console.error("Monetra Profile Error:", error);
        throw new Error("Gagal memuat profil pengguna.");
    }
}


/* =====================================
   GET USER PROFILE
===================================== */

export async function getUserProfile(uid) {
    if (!uid) {
        throw new Error("User ID tidak ditemukan.");
    }

    try {
        const userRef = doc(db, "users", uid);
        const snapshot = await getDoc(userRef);

        if (!snapshot.exists()) {
            return null;
        }

        return snapshot.data();

    } catch (error) {
        console.error("Monetra Get Profile Error:", error);
        throw new Error("Gagal mengambil data profil.");
    }
}


/* =====================================
   UPDATE USER PROFILE
===================================== */

export async function updateUserProfile(uid, data) {
    if (!uid) {
        throw new Error("User ID tidak ditemukan.");
    }

    if (!data || typeof data !== "object" || Array.isArray(data)) {
        throw new Error("Data profil tidak valid.");
    }

    const allowedFields = [
        "name",
        "currency",
        "settings"
    ];

    const updates = {};

    for (const field of allowedFields) {
        if (Object.prototype.hasOwnProperty.call(data, field)) {
            updates[field] = data[field];
        }
    }

    if (Object.keys(updates).length === 0) {
        throw new Error("Tidak ada data profil yang diperbarui.");
    }

    updates.updatedAt = serverTimestamp();

    try {
        const userRef = doc(db, "users", uid);
        await updateDoc(userRef, updates);

        return true;

    } catch (error) {
        console.error("Monetra Update Profile Error:", error);
        throw new Error("Gagal memperbarui profil pengguna.");
    }
}


/* =====================================
   SYSTEM STATUS
===================================== */

console.log("Monetra User Data System loaded.");
