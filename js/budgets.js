
/* =========================================
   MONETRA
   BUDGET MANAGEMENT SYSTEM
========================================= */

import {
    collection,
    addDoc,
    getDocs,
    doc,
    updateDoc,
    deleteDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js";

import { db } from "./firebase.js";
import { getTransactions } from "./transactions.js";
import { formatRupiah } from "./finance.js";


/* =========================================
   STATE
========================================= */

let selectedBudgetMonth = getCurrentMonth();
let budgetItems = [];
let budgetTransactions = [];
let budgetBusy = false;
let activeBudgetId = null;
let budgetEventsInitialized = false;


/* =========================================
   DATE & FORMAT HELPERS
========================================= */

function getCurrentMonth() {
    const now = new Date();

    return [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0")
    ].join("-");
}

function formatMonth(month) {
    if (!/^\d{4}-\d{2}$/.test(month)) return month;

    const [year, monthNumber] = month.split("-").map(Number);

    return new Date(year, monthNumber - 1, 1)
        .toLocaleDateString("id-ID", {
            month: "long",
            year: "numeric"
        });
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

function parseAmount(value) {
    const amount = Number(value);

    return Number.isFinite(amount) && amount > 0
        ? amount
        : 0;
}

function normalizeType(type) {
    const value = String(type || "").toLowerCase();

    if (["income", "pemasukan", "masuk"].includes(value)) {
        return "income";
    }

    return "expense";
}

function getTransactionMonth(transaction) {
    const date = String(transaction.date || "");

    return date.length >= 7 ? date.slice(0, 7) : "";
}

function getBudgetCollection(uid) {
    if (!uid) {
        throw new Error("Pengguna belum login.");
    }

    return collection(db, "users", uid, "budgets");
}


/* =========================================
   FIRESTORE OPERATIONS
========================================= */

export async function getBudgets(uid) {
    try {
        const snapshot = await getDocs(getBudgetCollection(uid));

        return snapshot.docs.map(item => ({
            id: item.id,
            ...item.data()
        }));
    } catch (error) {
        console.error("Get budgets error:", error);
        throw error;
    }
}


export async function addBudget(uid, data) {
    const category = String(data.category || "").trim();
    const amount = parseAmount(data.amount);
    const month = String(data.month || "");

    if (!category) {
        throw new Error("Kategori anggaran wajib diisi.");
    }

    if (!amount) {
        throw new Error("Nominal anggaran harus lebih dari nol.");
    }

    if (!/^\d{4}-\d{2}$/.test(month)) {
        throw new Error("Bulan anggaran tidak valid.");
    }

    try {
        const existing = await getBudgets(uid);

        const duplicate = existing.some(item =>
            item.month === month &&
            String(item.category || "").toLowerCase() === category.toLowerCase()
        );

        if (duplicate) {
            throw new Error("Anggaran untuk kategori ini sudah tersedia pada bulan tersebut.");
        }

        const reference = await addDoc(getBudgetCollection(uid), {
            category,
            amount,
            month,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        return {
            success: true,
            id: reference.id
        };
    } catch (error) {
        console.error("Add budget error:", error);
        throw error;
    }
}


export async function updateBudget(uid, budgetId, data) {
    if (!uid || !budgetId) {
        throw new Error("Data anggaran tidak valid.");
    }

    const category = String(data.category || "").trim();
    const amount = parseAmount(data.amount);
    const month = String(data.month || "");

    if (!category || !amount || !/^\d{4}-\d{2}$/.test(month)) {
        throw new Error("Mohon periksa kembali data anggaran.");
    }

    try {
        const existing = await getBudgets(uid);

        const duplicate = existing.some(item =>
            item.id !== budgetId &&
            item.month === month &&
            String(item.category || "").toLowerCase() === category.toLowerCase()
        );

        if (duplicate) {
            throw new Error("Kategori anggaran tersebut sudah tersedia pada bulan ini.");
        }

        await updateDoc(
            doc(db, "users", uid, "budgets", budgetId),
            {
                category,
                amount,
                month,
                updatedAt: serverTimestamp()
            }
        );

        return { success: true };
    } catch (error) {
        console.error("Update budget error:", error);
        throw error;
    }
}


export async function deleteBudget(uid, budgetId) {
    if (!uid || !budgetId) {
        throw new Error("Data anggaran tidak valid.");
    }

    try {
        await deleteDoc(
            doc(db, "users", uid, "budgets", budgetId)
        );

        return { success: true };
    } catch (error) {
        console.error("Delete budget error:", error);
        throw error;
    }
}


/* =========================================
   BUDGET CALCULATIONS
========================================= */

function getUsedAmount(category, month) {
    return budgetTransactions
        .filter(transaction => {
            const sameCategory =
                String(transaction.category || "").toLowerCase() ===
                String(category || "").toLowerCase();

            return (
                sameCategory &&
                getTransactionMonth(transaction) === month &&
                normalizeType(transaction.type) === "expense"
            );
        })
        .reduce((total, transaction) => {
            return total + Number(transaction.amount || 0);
        }, 0);
}


function getBudgetStatus(used, limit) {
    if (used > limit) {
        return {
            label: "Melebihi anggaran",
            className: "danger",
            color: "#ef4444"
        };
    }

    if (used >= limit * 0.8) {
        return {
            label: "Hampir mencapai batas",
            className: "warning",
            color: "#f59e0b"
        };
    }

    return {
        label: "Masih aman",
        className: "success",
        color: "#22c55e"
    };
}


function calculateBudgetSummary(items) {
    let totalLimit = 0;
    let totalUsed = 0;

    items.forEach(item => {
        const limit = Number(item.amount || 0);
        const used = getUsedAmount(item.category, item.month);

        totalLimit += limit;
        totalUsed += used;
    });

    return {
        totalLimit,
        totalUsed,
        remaining: totalLimit - totalUsed,
        percentage: totalLimit > 0
            ? (totalUsed / totalLimit) * 100
            : 0
    };
}


/* =========================================
   NOTIFICATION
========================================= */

function showBudgetMessage(message, type = "info") {
    const oldMessage = document.getElementById("budget-toast");

    if (oldMessage) oldMessage.remove();

    const toast = document.createElement("div");

    toast.id = "budget-toast";
    toast.className = `budget-toast ${type}`;
    toast.textContent = message;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}


/* =========================================
   STYLES
========================================= */

function renderBudgetStyles() {
    if (document.getElementById("monetra-budget-styles")) return;

    const style = document.createElement("style");

    style.id = "monetra-budget-styles";

    style.textContent = `
        .budget-wrapper {
            display: flex;
            flex-direction: column;
            gap: 20px;
            width: 100%;
        }

        .budget-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 14px;
            flex-wrap: wrap;
        }

        .budget-header h2 {
            margin: 0;
            font-size: 24px;
        }

        .budget-header p {
            color: var(--text-secondary, #999);
            margin: 6px 0 0;
        }

        .budget-month {
            width: 100%;
            max-width: 190px;
            padding: 11px;
            border-radius: 10px;
            border: 1px solid var(--border-color, #444);
            background: var(--card-bg, #222);
            color: var(--text-primary, #fff);
        }

        .budget-summary-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 12px;
        }

        .budget-summary-card {
            background: var(--card-bg, #222);
            border: 1px solid var(--border-color, #333);
            border-radius: 15px;
            padding: 17px;
            min-width: 0;
        }

        .budget-summary-card span {
            display: block;
            color: var(--text-secondary, #aaa);
            font-size: 12px;
            margin-bottom: 9px;
        }

        .budget-summary-card strong {
            font-size: clamp(14px, 2vw, 20px);
            overflow-wrap: anywhere;
        }

        .budget-panel {
            background: var(--card-bg, #222);
            border: 1px solid var(--border-color, #333);
            border-radius: 16px;
            padding: 20px;
        }

        .budget-panel h3 {
            margin: 0 0 17px;
            font-size: 17px;
        }

        .budget-form {
            display: grid;
            grid-template-columns: 1fr 1fr auto;
            gap: 12px;
        }

        .budget-form input,
        .budget-modal input,
        .budget-modal select {
            width: 100%;
            min-width: 0;
            padding: 12px;
            border: 1px solid var(--border-color, #444);
            border-radius: 10px;
            background: var(--input-bg, #181818);
            color: var(--text-primary, #fff);
            outline: none;
        }

        .budget-form input:focus,
        .budget-modal input:focus {
            border-color: var(--accent-color, #888);
        }

        .budget-btn {
            border: none;
            border-radius: 10px;
            padding: 11px 16px;
            background: var(--accent-color, #e5e5e5);
            color: var(--button-text, #111);
            font-weight: 700;
            cursor: pointer;
        }

        .budget-btn:disabled {
            opacity: .55;
            cursor: not-allowed;
        }

        .budget-list {
            display: flex;
            flex-direction: column;
            gap: 13px;
        }

        .budget-item {
            padding: 17px;
            border: 1px solid var(--border-color, #333);
            border-radius: 14px;
            background: var(--card-bg, #222);
        }

        .budget-item-top {
            display: flex;
            justify-content: space-between;
            gap: 12px;
            align-items: flex-start;
        }

        .budget-item h4 {
            margin: 0 0 7px;
            font-size: 16px;
        }

        .budget-item small {
            color: var(--text-secondary, #aaa);
        }

        .budget-amount {
            text-align: right;
            overflow-wrap: anywhere;
        }

        .budget-amount strong {
            display: block;
            font-size: 15px;
        }

        .budget-amount small {
            display: block;
            margin-top: 5px;
        }

        .budget-progress {
            height: 9px;
            background: var(--border-color, #444);
            border-radius: 20px;
            overflow: hidden;
            margin: 16px 0 9px;
        }

        .budget-progress-fill {
            height: 100%;
            border-radius: 20px;
            transition: width .3s ease;
        }

        .budget-progress-info {
            display: flex;
            justify-content: space-between;
            gap: 10px;
            flex-wrap: wrap;
            color: var(--text-secondary, #aaa);
            font-size: 12px;
        }

        .budget-status {
            font-size: 12px;
            font-weight: 700;
        }

        .budget-status.success { color: #22c55e; }
        .budget-status.warning { color: #f59e0b; }
        .budget-status.danger { color: #ef4444; }

        .budget-actions {
            display: flex;
            gap: 8px;
            margin-top: 14px;
        }

        .budget-action {
            border: 1px solid var(--border-color, #444);
            color: var(--text-primary, #fff);
            background: transparent;
            padding: 8px 12px;
            border-radius: 8px;
            cursor: pointer;
        }

        .budget-action.delete {
            color: #ef4444;
        }

        .budget-empty {
            padding: 30px 15px;
            text-align: center;
            color: var(--text-secondary, #aaa);
            border: 1px dashed var(--border-color, #444);
            border-radius: 12px;
        }

        .budget-modal {
            position: fixed;
            inset: 0;
            z-index: 9999;
            display: none;
            align-items: center;
            justify-content: center;
            padding: 18px;
            background: rgba(0,0,0,.72);
        }

        .budget-modal.active {
            display: flex;
        }

        .budget-modal-content {
            width: 100%;
            max-width: 420px;
            padding: 22px;
            border-radius: 17px;
            background: var(--card-bg, #222);
            border: 1px solid var(--border-color, #444);
        }

        .budget-modal-content h3 {
            margin: 0 0 18px;
        }

        .budget-modal-content form {
            display: flex;
            flex-direction: column;
            gap: 13px;
        }

        .budget-modal-actions {
            display: flex;
            gap: 10px;
            margin-top: 7px;
        }

        .budget-modal-actions button {
            flex: 1;
        }

        .budget-toast {
            position: fixed;
            z-index: 10001;
            bottom: 24px;
            left: 50%;
            transform: translateX(-50%);
            padding: 13px 18px;
            max-width: calc(100% - 32px);
            border-radius: 10px;
            background: #333;
            color: #fff;
            box-shadow: 0 8px 25px rgba(0,0,0,.3);
            font-size: 14px;
        }

        .budget-toast.error { background: #991b1b; }
        .budget-toast.success { background: #166534; }

        @media (max-width: 650px) {
            .budget-summary-grid {
                grid-template-columns: 1fr;
            }

            .budget-form {
                grid-template-columns: 1fr;
            }

            .budget-form .budget-btn {
                width: 100%;
            }

            .budget-header {
                align-items: flex-start;
                flex-direction: column;
            }

            .budget-month {
                max-width: none;
            }

            .budget-panel {
                padding: 15px;
            }
        }

        @media (max-width: 380px) {
            .budget-item-top {
                flex-direction: column;
            }

            .budget-amount {
                text-align: left;
            }
        }
    `;

    document.head.appendChild(style);
}


/* =========================================
   MODALS
========================================= */

function renderBudgetModals() {
    return `
        <div class="budget-modal" id="budget-edit-modal">
            <div class="budget-modal-content">
                <h3>Edit Anggaran</h3>

                <form id="budget-edit-form">
                    <input
                        type="text"
                        id="budget-edit-category"
                        placeholder="Nama kategori"
                        maxlength="60"
                        required
                    >

                    <input
                        type="number"
                        id="budget-edit-amount"
                        placeholder="Nominal anggaran"
                        min="1"
                        step="1"
                        required
                    >

                    <input
                        type="month"
                        id="budget-edit-month"
                        required
                    >

                    <div class="budget-modal-actions">
                        <button type="button"
                            class="budget-action"
                            id="budget-edit-cancel">
                            Batal
                        </button>

                        <button type="submit" class="budget-btn">
                            Simpan
                        </button>
                    </div>
                </form>
            </div>
        </div>

        <div class="budget-modal" id="budget-delete-modal">
            <div class="budget-modal-content">
                <h3>Hapus Anggaran?</h3>

                <p style="color:var(--text-secondary,#aaa)">
                    Anggaran ini akan dihapus secara permanen.
                    Transaksi yang sudah tercatat tidak akan ikut terhapus.
                </p>

                <div class="budget-modal-actions">
                    <button type="button"
                        class="budget-action"
                        id="budget-delete-cancel">
                        Batal
                    </button>

                    <button type="button"
                        class="budget-btn"
                        id="budget-delete-confirm"
                        style="background:#dc2626;color:white">
                        Ya, Hapus
                    </button>
                </div>
            </div>
        </div>
    `;
}


/* =========================================
   PAGE RENDERING
========================================= */

export async function renderBudgetsPage(uid) {
    const container = document.getElementById("monetra-page-content");

    if (!container) {
        console.error("Monetra: budget container tidak ditemukan.");
        return;
    }

    if (!uid) {
        container.innerHTML = `
            <div class="budget-empty">
                Silakan login untuk melihat anggaran.
            </div>
        `;
        return;
    }

    renderBudgetStyles();

    container.innerHTML = `
        <div class="budget-wrapper">

            <div class="budget-header">
                <div>
                    <h2>Anggaran</h2>
                    <p>Atur batas pengeluaran bulananmu.</p>
                </div>

                <input
                    type="month"
                    id="budget-month-filter"
                    class="budget-month"
                    value="${escapeHTML(selectedBudgetMonth)}"
                >
            </div>

            <div class="budget-summary-grid">
                <div class="budget-summary-card">
                    <span>Total Anggaran</span>
                    <strong id="budget-total-limit">Rp0</strong>
                </div>

                <div class="budget-summary-card">
                    <span>Total Terpakai</span>
                    <strong id="budget-total-used">Rp0</strong>
                </div>

                <div class="budget-summary-card">
                    <span>Sisa Anggaran</span>
                    <strong id="budget-remaining">Rp0</strong>
                </div>
            </div>

            <dn:active {
                transform: scale(.96);
            }

            @media(max-width:480px) {
                .budget-modal-box {
                    padding: 20px;
                }

                .budget-action-group {
                    gap: 5px;
                }

                .budget-action-btn {
                    padding: 7px 9px;
                    font-size: 10px;
                }
            }
        </style>

        <div class="budget-modal-overlay" id="budget-modal">
            <div class="budget-modal-box">

                <div class="budget-modal-header">
                    <div>
                        <h3 id="budget-modal-title">Edit Anggaran</h3>
                        <p id="budget-modal-description">
                            Perbarui detail anggaran.
                        </p>
                    </div>

                    <button type="button"
                        class="budget-modal-close"
                        data-budget-close="edit">×</button>
                </div>

                <form id="budget-edit-form">

                    <div class="budget-modal-field">
                        <label>Kategori</label>
                        <input id="budget-edit-category"
                            type="text" maxlength="50" required>
                    </div>

                    <div class="budget-modal-field">
                        <label>Batas Anggaran (Rp)</label>
                        <input id="budget-edit-amount"
                            type="number" min="1" step="1" required>
                    </div>

                    <div class="budget-modal-field">
                        <label>Bulan Anggaran</label>
                        <input id="budget-edit-month"
                            type="month" required>
                    </div>

                    <div id="budget-edit-message"
                        style="font-size:12px;color:#e0aaaa"></div>

                    <div class="budget-modal-actions">
                        <button type="button"
                            class="budget-modal-cancel"
                            data-budget-close="edit">
                            Batal
                        </button>

                        <button type="submit"
                            class="budget-modal-save"
                            id="budget-modal-submit">
                            Simpan Perubahan
                        </button>
                    </div>

                </form>
            </div>
        </div>

        <div class="budget-modal-overlay" id="budget-delete-modal">
            <div class="budget-modal-box">

                <div class="budget-delete-icon">⌫</div>

                <h3 style="color:#f5f5f5;font-size:19px">
                    Hapus Anggaran?
                </h3>

                <p style="color:#999;font-size:13px;margin-top:9px">
                    Apakah kamu yakin ingin menghapus anggaran
                    <strong id="budget-delete-name" style="color:#fff"></strong>?
                </p>

                <div class="budget-delete-warning">
                    Anggaran yang dihapus tidak dapat dikembalikan.
                    Riwayat transaksi tidak akan ikut terhapus.
                </div>

                <div id="budget-delete-message"
                    style="margin-top:12px;font-size:12px;color:#e0aaaa"></div>

                <div class="budget-modal-actions">
                    <button type="button"
                        class="budget-modal-cancel"
                        data-budget-close="delete">
                        Batal
                    </button>

                    <button type="button"
                        class="budget-modal-save"
                        id="budget-confirm-delete"
                        style="background:#b95e5e;color:white">
                        Ya, Hapus
                    </button>
                </div>

            </div>
        </div>
    `;
}

// ==========================================
// 5. HALAMAN ANGGARAN
// ==========================================

export async function renderBudgetsPage(uid) {
    const container = document.getElementById("monetra-page-content");

    if (!container) {
        throw new Error("Area halaman Monetra tidak ditemukan.");
    }

    container.innerHTML = `
        <div class="monetra-page-title">
            <h1>Anggaran</h1>
            <p>Atur batas pengeluaran dan pantau penggunaan uangmu.</p>
        </div>

        <div class="monetra-filter">
            <input type="month" id="budget-month"
                value="${escapeHTML(selectedBudgetMonth)}">
        </div>

        <div id="budget-summary" class="dashboard-grid"></div>

        <div class="monetra-card" style="margin-top:20px">
            <h3 style="margin-bottom:16px">Buat Anggaran Baru</h3>

            <form id="budget-form">

                <div class="monetra-field">
                    <label for="budget-category">Kategori</label>
                    <input id="budget-category"
                        type="text"
                        maxlength="50"
                        placeholder="Contoh: Makan"
                        required>
                </div>

                <div class="monetra-field">
                    <label for="budget-amount">Batas Anggaran (Rp)</label>
                    <input id="budget-amount"
                        type="number"
                        min="1"
                        step="1"
                        placeholder="Contoh: 500000"
                        required>
                </div>

                <button type="submit"
                    class="monetra-button"
                    id="budget-submit">
                    + Tambahkan Anggaran
                </button>

                <div id="budget-form-message"
                    style="margin-top:12px;font-size:12px"></div>

            </form>
        </div>

        <div style="margin-top:26px">
            <h3 style="margin-bottom:15px">Daftar Anggaran</h3>

            <div id="budget-list">
                <div class="monetra-empty">Memuat anggaran...</div>
            </div>
        </div>

        ${renderBudgetModals()}
    `;

    // Filter bulan
    document.getElementById("budget-month").addEventListener("change", async event => {
        if (!event.target.value) return;

        selectedBudgetMonth = event.target.value;
        await loadBudgetContent(uid);
    });

    // Tambah anggaran
    document.getElementById("budget-form").addEventListener("submit", async event => {
        event.preventDefault();

        if (budgetBusy) return;

        const category = document.getElementById("budget-category").value.trim();
        const amount = parseAmount(document.getElementById("budget-amount").value);
        const button = document.getElementById("budget-submit");
        const message = document.getElementById("budget-form-message");

        if (!category || !amount) {
            message.textContent = "Isi kategori dan nominal dengan benar.";
            message.style.color = "#e0aaaa";
            return;
        }

        budgetBusy = true;
        button.disabled = true;
        button.textContent = "Menyimpan...";

        try {
            await addBudget(uid, {
                category,
                amount,
                month: selectedBudgetMonth
            });

            document.getElementById("budget-category").value = "";
            document.getElementById("budget-amount").value = "";

            message.textContent = "Anggaran berhasil ditambahkan.";
            message.style.color = "#b8d8c0";

            await loadBudgetContent(uid);

        } catch (error) {
            console.error("Add Budget Error:", error);
            message.textContent = error.message || "Gagal menyimpan anggaran.";
            message.style.color = "#e0aaaa";

        } finally {
            budgetBusy = false;
            button.disabled = false;
            button.textContent = "+ Tambahkan Anggaran";
        }
    });

    // Tombol Edit dan Hapus
    document.getElementById("budget-list").addEventListener("click", event => {
        const editButton = event.target.closest("[data-budget-edit]");
        const deleteButton = event.target.closest("[data-budget-delete]");

        if (editButton) {
            const budget = budgetItems.find(item =>
                item.id === editButton.dataset.budgetEdit
            );

            if (budget) openEditModal(budget);
        }

        if (deleteButton) {
            const budget = budgetItems.find(item =>
                item.id === deleteButton.dataset.budgetDelete
            );

            if (budget) openDeleteModal(budget);
        }
    });

    // Tutup modal
    container.querySelectorAll("[data-budget-close]").forEach(button => {
        button.addEventListener("click", () => {
            const type = button.dataset.budgetClose;

            if (type === "edit") {
                closeBudgetModal();
            } else {
                document.getElementById("budget-delete-modal")
                    ?.classList.remove("show");

                activeBudgetId = null;
            }
        });
    });

    // Tutup modal saat klik area luar
    document.getElementById("budget-modal").addEventListener("click", event => {
        if (event.target.id === "budget-modal") {
            closeBudgetModal();
        }
    });

    document.getElementById("budget-delete-modal").addEventListener("click", event => {
        if (event.target.id === "budget-delete-modal") {
            event.currentTarget.classList.remove("show");
            activeBudgetId = null;
        }
    });

    // Simpan edit
    document.getElementById("budget-edit-form").addEventListener("submit", async event => {
        event.preventDefault();

        if (budgetBusy || !activeBudgetId) return;

        const category = document.getElementById("budget-edit-category").value.trim();
        const amount = parseAmount(document.getElementById("budget-edit-amount").value);
        const month = document.getElementById("budget-edit-month").value;

        const button = document.getElementById("budget-modal-submit");
        const message = document.getElementById("budget-edit-message");

        if (!category || !amount || !month) {
            message.textContent = "Periksa kembali semua data.";
            return;
        }

        budgetBusy = true;
        button.disabled = true;
        button.textContent = "Menyimpan...";

        try {
            await updateBudget(uid, activeBudgetId, {
                category,
                amount,
                month
            });

            if (selectedBudgetMonth !== month) {
                selectedBudgetMonth = month;
                document.getElementById("budget-month").value = month;
            }

            closeBudgetModal();
            await loadBudgetContent(uid);

        } catch (error) {
            console.error("Edit Budget Error:", error);
            message.textContent = error.message || "Gagal mengubah anggaran.";

        } finally {
            budgetBusy = false;
            button.disabled = false;
            button.textContent = "Simpan Perubahan";
        }
    });

    // Konfirmasi hapus
    document.getElementById("budget-confirm-delete").addEventListener("click", async () => {
        if (budgetBusy || !activeBudgetId) return;

        const button = document.getElementById("budget-confirm-delete");
        const message = document.getElementById("budget-delete-message");
        const id = activeBudgetId;

        budgetBusy = true;
        button.disabled = true;
        button.textContent = "Menghapus...";

        try {
            await deleteBudget(uid, id);

            document.getElementById("budget-delete-modal")
                .classList.remove("show");

            activeBudgetId = null;

            await loadBudgetContent(uid);

        } catch (error) {
            console.error("Delete Budget Error:", error);
            message.textContent = error.message || "Gagal menghapus anggaran.";

        } finally {
            budgetBusy = false;
            button.disabled = false;
            button.textContent = "Ya, Hapus";
        }
    });

    await loadBudgetContent(uid);
}

// ==========================================
// 6. MUAT DATA DAN HITUNG ANGGARAN
// ==========================================

async function loadBudgetContent(uid) {
    const summary = document.getElementById("budget-summary");
    const list = document.getElementById("budget-list");

    if (!summary || !list) return;

    summary.innerHTML = `
        <div class="stat-card">
            <div class="card-title">Memuat data anggaran...</div>
        </div>
    `;

    list.innerHTML = `
        <div class="monetra-empty">Memuat data anggaran...</div>
    `;

    try {
        const [allBudgets, transactions] = await Promise.all([
            getBudgets(uid),
            getTransactions(uid)
        ]);

        budgetItems = allBudgets;
        budgetTransactions = transactions;

        const budgets = allBudgets.filter(item =>
            item.month === selectedBudgetMonth
        );

        let totalBudget = 0;
        let totalUsed = 0;

        const results = budgets.map(budget => {
            const limit = Number(budget.amount || 0);

            const used = getUsedAmount(
                budget.category,
                selectedBudgetMonth
            );

            const remaining = limit - used;
            const percentage = limit > 0
                ? (used / limit) * 100
                : 0;

            totalBudget += limit;
            totalUsed += used;

            return {
                ...budget,
                limit,
                used,
                remaining,
                percentage
            };
        });

        const totalRemaining = totalBudget - totalUsed;

        summary.innerHTML = `
            <div class="stat-card">
                <div class="card-title">Total Anggaran</div>
                <div class="card-value">${formatRupiah(totalBudget)}</div>
            </div>

            <div class="stat-card">
                <div class="card-title">Total Terpakai</div>
                <div class="card-value">${formatRupiah(totalUsed)}</div>
            </div>

            <div class="stat-card">
                <div class="card-title">Sisa Anggaran</div>
                <div class="card-value"
                    style="color:${totalRemaining < 0 ? "#e0aaaa" : "#b8d8c0"}">
                    ${formatRupiah(totalRemaining)}
                </div>
            </div>
        `;

        if (results.length === 0) {
            list.innerHTML = `
                <div class="monetra-empty">
                    <h3>Belum Ada Anggaran</h3>
                    <p>Tambahkan anggaran untuk ${escapeHTML(formatMonth(selectedBudgetMonth))}.</p>
                </div>
            `;

            return;
        }

        list.innerHTML = results.map(budget => {
            const isOver = budget.used > budget.limit;
            const percentage = Math.max(0, budget.percentage);
            const barWidth = Math.min(percentage, 100);

            return `
                <div class="budget-card" style="margin-bottom:13px">

                    <div style="
                        display:flex;
                        justify-content:space-between;
                        align-items:flex-start;
                        gap:12px;
                        flex-wrap:wrap;
                    ">

                        <div style="min-width:0">
                            <h3 style="
                                color:#f5f5f5;
                                font-size:16px;
                                overflow-wrap:anywhere;
                            ">
                                ${escapeHTML(budget.category)}
                            </h3>

                            <p style="color:#85858c;font-size:11px">
                                ${escapeHTML(formatMonth(budget.month))}
                            </p>
                        </div>

                        <div class="budget-action-group">

                            <button type="button"
                                class="budget-action-btn budget-edit-btn"
                                data-budget-edit="${escapeHTML(budget.id)}">
                                ✎ Edit
                            </button>

                            <button type="button"
                                class="budget-action-btn budget-delete-btn"
                                data-budget-delete="${escapeHTML(budget.id)}">
                                × Hapus
                            </button>

                        </div>
                    </div>

                    <div style="
                        display:flex;
                        justify-content:space-between;
                        margin-top:20px;
                        font-size:12px;
                        gap:10px;
                    ">
                        <span style="color:#999">Pengeluaran</span>
                        <strong style="color:#f5f5f5">
                            ${formatRupiah(budget.used)}
                        </strong>
                    </div>

                    <div class="budget-progress">
                        <div class="budget-progress-bar"
                            style="
                                width:${barWidth}%;
                                background:${isOver ? "#c77b7b" : "#c9c9c9"};
                            ">
                        </div>
                    </div>

                    <div style="
                        display:flex;
                        justify-content:space-between;
                        gap:10px;
                        flex-wrap:wrap;
                        font-size:12px;
                    ">
                        <span style="color:#999">
                            Batas: ${formatRupiah(budget.limit)}
                        </span>

                        <strong style="color:${isOver ? "#e0aaaa" : "#b8d8c0"}">
                            ${isOver
                                ? "Melebihi " + formatRupiah(Math.abs(budget.remaining))
                                : "Sisa " + formatRupiah(budget.remaining)}
                        </strong>
                    </div>

                    <p style="
                        margin-top:10px;
                        color:${isOver ? "#e0aaaa" : "#999"};
                        font-size:11px;
                    ">
                        ${percentage.toFixed(1)}% anggaran digunakan
                    </p>

                </div>
            `;
        }).join("");

    } catch (error) {
        console.error("Budget Load Error:", error);

        summary.innerHTML = "";

        list.innerHTML = `
            <div class="monetra-empty">
                <h3>Gagal Memuat Anggaran</h3>
                <p>${escapeHTML(error.message || "Periksa koneksi internet.")}</p>
            </div>
        `;
    }
}
