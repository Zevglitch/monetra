
import {
    registerUser,
    loginUser,
    logoutUser,
    resetPassword,
    observeAuth
} from "./auth.js";

import { ensureUserProfile } from "./user-data.js";
import { renderDashboard } from "./dashboard.js";
import { authPersistence } from "./firebase.js";

const app = document.getElementById("app");

let currentUser = null;
let authObserverStarted = false;
let dashboardLoading = false;
let logoutInProgress = false;

// =====================================
// 1. SISTEM LOADING
// =====================================

function setLoading(message = "Sedang memuat Monetra...") {
    const loading = document.getElementById("monetra-loading");
    const status = document.getElementById("loading-status");

    if (status) status.textContent = message;
    if (loading) loading.style.display = "flex";
}

function setReady() {
    if (typeof window.__MONETRA_SET_READY === "function") {
        window.__MONETRA_SET_READY();
    } else {
        window.__MONETRA_READY = true;

        const loading = document.getElementById("monetra-loading");
        if (loading) loading.style.display = "none";
    }
}

function showError(message) {
    const loading = document.getElementById("monetra-loading");
    const errorBox = document.getElementById("monetra-startup-error");
    const errorMessage = document.getElementById("monetra-error-message");

    if (loading) loading.style.display = "none";

    if (errorBox && errorMessage) {
        errorMessage.textContent = message;
        errorBox.style.display = "flex";
    } else if (app) {
        app.innerHTML = `
            <div style="padding:30px;text-align:center;color:white;background:#101010;min-height:100vh">
                <h2>Monetra mengalami masalah</h2>
                <p>${escapeHTML(message)}</p>
                <button onclick="location.reload()">Coba Lagi</button>
            </div>
        `;
    }

    setReady();
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

// =====================================
// 2. HALAMAN LOGIN / REGISTER / RESET
// =====================================

function renderAuthPage(mode = "login") {
    if (!app) {
        throw new Error("Elemen #app tidak ditemukan.");
    }

    const isRegister = mode === "register";
    const isReset = mode === "reset";

    app.innerHTML = `
        <div class="monetra-auth-page">
            <div class="monetra-auth-card">

                <div class="monetra-auth-logo">MONETRA</div>
                <p class="monetra-auth-subtitle">Personal Finance Management</p>

                <h2 class="monetra-auth-heading">
                    ${isReset ? "Reset Password" :
                    isRegister ? "Buat Akun Baru" :
                    "Selamat Datang"}
                </h2>

                <p class="monetra-auth-description">
                    ${isReset
                        ? "Masukkan email untuk menerima link reset password."
                        : isRegister
                            ? "Buat akun untuk mulai mengelola keuangan."
                            : "Login untuk melanjutkan ke Monetra."}
                </p>

                <form id="monetra-auth-form">

                    ${isRegister ? `
                        <div class="monetra-field">
                            <label>Nama Lengkap</label>
                            <input id="auth-name" type="text"
                                placeholder="Nama lengkap"
                                autocomplete="name" required>
                        </div>
                    ` : ""}

                    <div class="monetra-field">
                        <label>Email</label>
                        <input id="auth-email" type="email"
                            placeholder="nama@email.com"
                            autocomplete="email" required>
                    </div>

                    ${!isReset ? `
                        <div class="monetra-field">
                            <label>Password</label>
                            <input id="auth-password" type="password"
                                placeholder="Masukkan password"
                                autocomplete="${isRegister ? "new-password" : "current-password"}"
                                minlength="6" required>
                        </div>
                    ` : ""}

                    ${isRegister ? `
                        <div class="monetra-field">
                            <label>Konfirmasi Password</label>
                            <input id="auth-confirm-password" type="password"
                                placeholder="Ulangi password"
                                autocomplete="new-password"
                                minlength="6" required>
                        </div>
                    ` : ""}

                    <div id="auth-message"
                        style="display:none;font-size:12px;margin:12px 0;line-height:1.6">
                    </div>

                    <button type="submit" id="auth-submit"
                        class="monetra-auth-button">
                        ${isReset ? "Kirim Link Reset" :
                        isRegister ? "Buat Akun" : "Login"}
                    </button>
                </form>

                <div class="monetra-auth-links">
                    ${!isRegister && !isReset ? `
                        <button type="button" id="show-reset">
                            Lupa password?
                        </button>
                    ` : ""}

                    ${!isReset ? `
                        <p>
                            ${isRegister ? "Sudah punya akun?" : "Belum punya akun?"}
                            <button type="button" id="switch-auth">
                                ${isRegister ? "Login" : "Daftar"}
                            </button>
                        </p>
                    ` : `
                        <button type="button" id="back-login">
                            Kembali ke Login
                        </button>
                    `}
                </div>

                <div class="monetra-auth-watermark">ZETHER</div>
            </div>
        </div>
    `;

    setReady();

    const form = document.getElementById("monetra-auth-form");
    const message = document.getElementById("auth-message");
    const submit = document.getElementById("auth-submit");

    function showMessage(text, success = false) {
        message.textContent = text;
        message.style.display = "block";
        message.style.color = success ? "#b8d8c0" : "#e0aaaa";
    }

    form.addEventListener("submit", async event => {
        event.preventDefault();

        if (submit.disabled) return;

        const email = document.getElementById("auth-email").value.trim();

        submit.disabled = true;
        message.style.display = "none";

        try {
            if (isRegister) {
                const name = document.getElementById("auth-name").value.trim();
                const password = document.getElementById("auth-password").value;
                const confirm = document.getElementById("auth-confirm-password").value;

                if (!name) throw new Error("Nama lengkap wajib diisi.");
                if (password.length < 6) throw new Error("Password minimal 6 karakter.");
                if (password !== confirm) throw new Error("Konfirmasi password tidak sama.");

                submit.textContent = "Membuat akun...";

                const result = await registerUser(name, email, password);

                if (!result || !result.success) {
                    throw new Error(result?.message || "Pendaftaran gagal.");
                }

                showMessage("Akun berhasil dibuat. Menyiapkan Monetra...", true);

            } else if (isReset) {
                submit.textContent = "Mengirim email...";

                const result = await resetPassword(email);

                if (!result || !result.success) {
                    throw new Error(result?.message || "Gagal mengirim email reset.");
                }

                showMessage(
                    result.message || "Link reset password telah dikirim ke email.",
                    true
                );

                submit.disabled = false;
                submit.textContent = "Kirim Link Reset";
                return;

            } else {
                const password = document.getElementById("auth-password").value;

                submit.textContent = "Memeriksa akun...";

                const result = await loginUser(email, password);

                if (!result || !result.success) {
                    throw new Error(result?.message || "Login gagal.");
                }

                showMessage("Login berhasil. Membuka Dashboard...", true);
            }

        } catch (error) {
            console.error("Monetra Auth:", error);
            showMessage(error.message || "Terjadi kesalahan.");

            submit.disabled = false;
            submit.textContent = isReset ? "Kirim Link Reset" :
                isRegister ? "Buat Akun" : "Login";
        }
    });

    document.getElementById("switch-auth")?.addEventListener("click", () => {
        renderAuthPage(isRegister ? "login" : "register");
    });

    document.getElementById("show-reset")?.addEventListener("click", () => {
        renderAuthPage("reset");
    });

    document.getElementById("back-login")?.addEventListener("click", () => {
        renderAuthPage("login");
    });
}

// =====================================
// 3. LOGOUT - PERBAIKAN LOADING
// =====================================

async function handleLogout() {
    if (logoutInProgress) return;

    logoutInProgress = true;
    setLoading("Sedang keluar dari akun...");

    try {
        await logoutUser();

        currentUser = null;
        dashboardLoading = false;

        // Tampilkan login secara langsung setelah logout.
        renderAuthPage("login");

        console.log("Monetra: Logout berhasil.");

    } catch (error) {
        console.error("Monetra Logout Error:", error);

        // Jika logout gagal, kembalikan tampilan Dashboard.
        setReady();

        alert(error.message || "Gagal keluar dari akun.");

    } finally {
        logoutInProgress = false;
    }
}

// =====================================
// 4. MEMBUKA DASHBOARD
// =====================================

async function handleAuthenticatedUser(user) {
    if (!user || logoutInProgress || dashboardLoading) return;

    if (currentUser?.uid === user.uid) return;

    dashboardLoading = true;
    currentUser = user;

    setLoading("Menyiapkan data akun...");

    try {
        await ensureUserProfile(user);

        setLoading("Memuat Dashboard...");

        await renderDashboard(user, handleLogout);

        console.log("Monetra: Dashboard berhasil dimuat.");

        setReady();

    } catch (error) {
        console.error("Monetra Dashboard Error:", error);

        currentUser = null;

        showError(
            error.message || "Dashboard gagal dimuat. Periksa file JavaScript."
        );

    } finally {
        dashboardLoading = false;
    }
}

// =====================================
// 5. AUTH OBSERVER
// =====================================

function startAuthObserver() {
    if (authObserverStarted) return;

    authObserverStarted = true;

    observeAuth(async user => {
        try {
            if (logoutInProgress) return;

            if (user) {
                await handleAuthenticatedUser(user);
            } else {
                currentUser = null;
                dashboardLoading = false;

                renderAuthPage("login");
            }

        } catch (error) {
            console.error("Monetra Auth Observer:", error);
            showError(error.message || "Gagal memeriksa status akun.");
        }
    });
}

// =====================================
// 6. INITIALIZATION
// =====================================

async function initializeApp() {
    if (!app) {
        showError("Elemen #app tidak ditemukan di index.html.");
        return;
    }

    setLoading("Menghubungkan ke Firebase...");

    try {
        try {
            await authPersistence;
        } catch (error) {
            console.warn("Auth persistence warning:", error);
        }

        setLoading("Memeriksa akun...");

        startAuthObserver();

    } catch (error) {
        console.error("Monetra Startup Error:", error);
        showError(error.message || "Monetra gagal dimulai.");
    }
}

initializeApp();
