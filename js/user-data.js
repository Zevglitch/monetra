
/* =====================================
   MONETRA
   USER DATA MANAGEMENT
===================================== */

import {
    doc,
    getDoc,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js";

import { db } from "./firebase.js";


/* =====================================
   CREATE USER PROFILE
===================================== */

export async function ensureUserProfile(user) {

    if (!user || !user.uid) {
        throw new Error("Pengguna tidak valid.");
    }

    const userRef = doc(db, "users", user.uid);

    const userSnapshot = await getDoc(userRef);

    if (!userSnapshot.exists()) {

        await setDoc(userRef, {
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

        });

    }

    return userSnapshot.exists()
        ? userSnapshot.data()
        : {
            uid: user.uid,
            name: user.displayName || "",
            email: user.email || "",
            currency: "IDR"
        };
}


/* =====================================
   GET USER PROFILE
===================================== */

export async function getUserProfile(uid) {

    if (!uid) {
        throw new Error("User ID tidak ditemukan.");
    }

    const userRef = doc(db, "users", uid);

    const snapshot = await getDoc(userRef);

    if (!snapshot.exists()) {
        return null;
    }

    return snapshot.data();
}


console.log("Monetra User Data System loaded.");
