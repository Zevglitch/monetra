
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

// ==========================================
// MONETRA BUDGET SYSTEM
// ==========================================

let selectedBudgetMonth = getCurrentMonth();
let budgetItems = [];
let budgetTransactions = [];
let budgetBusy = false;
let activeBudgetId = null;

// ==========================================
// 1. HELPER
// ==========================================

function getCurrentMonth() {
    const now = new Date();

    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
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

function getBudgetCollection(uid) {
    return collection(db, "users", uid, "budgets");
}

function formatMonth(month) {
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
        return "-";
    }

    const [year, number] = month.split("-");

    return new Date(Number(year), Number(number) - 1, 1)
        .toLocaleDateString("id-ID", {
            month: "long",
            year: "numeric"
        });
}

function parseAmount(value) {
    const amount = Number(value);

    return Number.isFinite(amount) && amount > 0
        ? amount
        : 0;
}

function getUsedAmount(category, month) {
    const targetCategory = String(category || "").trim().toLowerCase();

    return budgetTransactions.reduce((total, transaction) => {
        const type = String(transaction.type || "").toLowerCase();
        const transactionCategory = String(transaction.category || "")
            .trim()
            .toLowerCase();

        const date = String(transaction.date || "");

        const isExpense = [
            "expense",
            "pengeluaran",
            "keluar"
        ].includes(type);

        if (
            isExpense &&
            transactionCategory === targetCategory &&
            date.startsWith(month)
        ) {
            return total + Number(transaction.amount || 0);
        }

        return total;
    }, 0);
}

// ==========================================
// 2. FIRESTORE
// ==========================================

async function getBudgets(uid) {
    const snapshot = await getDocs(getBudgetCollection(uid));

    return snapshot.docs.map(item => ({
        id: item.id,
        ...item.data()
    }));
}

async function addBudget(uid, data) {
    return addDoc(getBudgetCollection(uid), {
        category: data.category,
        amount: data.amount,
        month: data.month,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
}

async function updateBudget(uid, id, data) {
    return updateDoc(
        doc(db, "users", uid, "budgets", id),
        {
            category: data.category,
            amount: data.amount,
            month: data.month,
            updatedAt: serverTimestamp()
        }
    );
}

async function deleteBudget(uid, id) {
    return deleteDoc(
        doc(db, "users", uid, "budgets", id)
    );
}

// ==========================================
// 3. MODAL SYSTEM
// ==========================================

function closeBudgetModal() {
    const modal = document.getElementById("budget-modal");

    if (modal) {
        modal.classList.remove("show");
    }

    activeBudgetId = null;
}

function openEditModal(budget) {
    const modal = document.getElementById("budget-modal");

    if (!modal) return;

    activeBudgetId = budget.id;

    document.getElementById("budget-modal-title").textContent =
        "Edit Anggaran";

    document.getElementById("budget-modal-description").textContent =
        "Ubah kategori, batas nominal, atau bulan anggaran.";

    document.getElementById("budget-edit-category").value =
        budget.category || "";

    document.getElementById("budget-edit-amount").value =
        budget.amount || "";

    document.getElementById("budget-edit-month").value =
        budget.month || selectedBudgetMonth;

    document.getElementById("budget-modal-submit").textContent =
        "Simpan Perubahan";

    modal.classList.add("show");
}

function openDeleteModal(budget) {
    const modal = document.getElementById("budget-delete-modal");

    if (!modal) return;

    activeBudgetId = budget.id;

    document.getElementById("budget-delete-name").textContent =
        budget.category || "Anggaran ini";

    modal.classList.add("show");
}

// ==========================================
// 4. STYLE MODAL
// ==========================================

function renderBudgetModals() {
    return `
        <style>
            .budget-modal-overlay {
                position: fixed;
                inset: 0;
                z-index: 10000;
                display: none;
                align-items: center;
                justify-content: center;
                padding: 18px;
                background: rgba(0,0,0,.78);
                backdrop-filter: blur(5px);
            }

            .budget-modal-overlay.show {
                display: flex;
            }

            .budget-modal-box {
                width: 100%;
                max-width: 420px;
                padding: 24px;
                background: #19191c;
                border: 1px solid #35353a;
                border-radius: 18px;
                box-shadow: 0 20px 60px rgba(0,0,0,.5);
                animation: budgetModalIn .2s ease;
            }

            @keyframes budgetModalIn {
                from {
                    opacity: 0;
                    transform: translateY(12px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            .budget-modal-header {
                display: flex;
                align-items: flex-start;
                justify-content: space-between;
                gap: 12px;
                margin-bottom: 22px;
            }

            .budget-modal-header h3 {
                color: #f5f5f5;
                font-size: 19px;
                margin: 0 0 5px;
            }

            .budget-modal-header p {
                color: #85858c;
                font-size: 12px;
                line-height: 1.5;
            }

            .budget-modal-close {
                width: 34px;
                height: 34px;
                flex-shrink: 0;
                border: 1px solid #38383d;
                border-radius: 9px;
                background: #242428;
                color: #ddd;
                font-size: 19px;
            }

            .budget-modal-field {
                margin-bottom: 16px;
            }

            .budget-modal-field label {
                display: block;
                margin-bottom: 7px;
                color: #c5c5c8;
                font-size: 12px;
            }

            .budget-modal-field input {
                width: 100%;
                padding: 13px;
                border: 1px solid #38383d;
                border-radius: 10px;
                background: #101012;
                color: white;
                outline: none;
                font-size: 14px;
            }

            .budget-modal-field input:focus {
                border-color: #999;
            }

            .budget-modal-actions {
                display: flex;
                gap: 10px;
                margin-top: 22px;
            }

            .budget-modal-actions button {
                flex: 1;
                min-height: 44px;
                border-radius: 10px;
                font-size: 13px;
                font-weight: 700;
            }

            .budget-modal-cancel {
                background: #29292d;
                border: 1px solid #414146;
                color: #ddd;
            }

            .budget-modal-save {
                background: #f0f0f0;
                border: 0;
                color: #111;
            }

            .budget-delete-icon {
                width: 52px;
                height: 52px;
                display: flex;
                align-items: center;
                justify-content: center;
                margin-bottom: 17px;
                border-radius: 15px;
                background: #382222;
                color: #efaaaa;
                font-size: 23px;
            }

            .budget-delete-warning {
                margin-top: 10px;
                padding: 12px;
                border-radius: 9px;
                background: #242124;
                color: #b8aeb0;
                font-size: 11px;
                line-height: 1.6;
            }

            .budget-action-group {
                display: flex;
                gap: 7px;
                flex-shrink: 0;
            }

            .budget-action-btn {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                gap: 6px;
                min-height: 34px;
                padding: 7px 11px;
                border-radius: 8px;
                font-size: 11px;
                font-weight: 600;
                transition: .2s ease;
            }

            .budget-edit-btn {
                color: #dedee0;
                background: #29292e;
                border: 1px solid #45454b;
            }

            .budget-edit-btn:hover {
                background: #38383e;
            }

            .budget-delete-btn {
                color: #e5aaaa;
                background: #302020;
                border: 1px solid #583737;
            }

            .budget-delete-btn:hover {
                background: #452929;
            }

            .budget-action-btn:active {
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
