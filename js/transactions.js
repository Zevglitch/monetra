
/* =====================================
   MONETRA
   TRANSACTION MANAGEMENT
===================================== */

import {
    collection,
    addDoc,
    getDocs,
    doc,
    updateDoc,
    deleteDoc,
    query,
    orderBy,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js";

import { db } from "./firebase.js";
import { formatRupiah } from "./finance.js";
import { getCategoriesByType } from "./categories.js";


/* =====================================
   BASIC HELPERS
===================================== */

const transactionCollection = (uid) => {
    if (!uid) {
        throw new Error("Pengguna belum login.");
    }

    return collection(db, "users", uid, "transactions");
};


const money = (value) => {
    const amount = Number(value) || 0;

    try {
        return formatRupiah(amount);
    } catch {
        return "Rp " + amount.toLocaleString("id-ID");
    }
};


const safe = (value) => {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
};


function normalizeType(type) {
    const value = String(type || "").toLowerCase();

    return ["income", "pemasukan", "masuk"].includes(value)
        ? "income"
        : "expense";
}


function getLocalDate() {
    const now = new Date();

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
}


function getCurrentMonth() {
    return getLocalDate().slice(0, 7);
}


function isValidDate(value) {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
}


function validateTransaction(data) {
    if (!data || typeof data !== "object") {
        throw new Error("Data transaksi tidak valid.");
    }

    const amount = Number(data.amount);

    if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error("Nominal harus lebih dari nol.");
    }

    if (!String(data.category || "").trim()) {
        throw new Error("Kategori wajib dipilih.");
    }

    if (!isValidDate(data.date)) {
        throw new Error("Tanggal transaksi tidak valid.");
    }

    return {
        type: normalizeType(data.type),
        amount,
        category: String(data.category).trim(),
        description: String(data.description || "").trim(),
        date: String(data.date)
    };
}


/* =====================================
   ADD TRANSACTION
===================================== */

export async function addTransaction(uid, data) {
    const transaction = validateTransaction(data);

    return await addDoc(transactionCollection(uid), {
        ...transaction,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });
}


/* =====================================
   GET ALL TRANSACTIONS
===================================== */

export async function getTransactions(uid) {
    if (!uid) {
        throw new Error("UID pengguna tidak ditemukan.");
    }

    const q = query(
        transactionCollection(uid),
        orderBy("date", "desc")
    );

    const snapshot = await getDocs(q);

    return snapshot.docs.map(item => ({
        id: item.id,
        ...item.data()
    }));
}


/* =====================================
   GET MONTHLY TRANSACTIONS
===================================== */

export async function getMonthlyTransactions(uid, month) {
    if (!/^\d{4}-\d{2}$/.test(String(month || ""))) {
        throw new Error("Format bulan tidak valid.");
    }

    const transactions = await getTransactions(uid);

    return transactions.filter(item =>
        String(item.date || "").startsWith(month)
    );
}


/* =====================================
   UPDATE TRANSACTION
===================================== */

export async function updateTransaction(uid, id, data) {
    if (!uid || !id) {
        throw new Error("Data transaksi tidak lengkap.");
    }

    const transaction = validateTransaction(data);

    await updateDoc(
        doc(db, "users", uid, "transactions", id),
        {
            ...transaction,
            updatedAt: serverTimestamp()
        }
    );

    return true;
}


/* =====================================
   DELETE TRANSACTION
===================================== */

export async function deleteTransaction(uid, id) {
    if (!uid || !id) {
        throw new Error("Data transaksi tidak lengkap.");
    }

    await deleteDoc(
        doc(db, "users", uid, "transactions", id)
    );

    return true;
}


/* =====================================
   RENDER TRANSACTION PAGE
===================================== */

export async function renderTransactionsPage(uid) {
    if (!uid) {
        throw new Error("Pengguna belum login.");
    }

    const content = document.getElementById("monetra-page-content");

    if (!content) {
        throw new Error("Area transaksi tidak ditemukan.");
    }

    content.innerHTML = `
        <div class="monetra-section">

            <div class="monetra-section-heading">
                <h3>Transaksi Keuangan</h3>
                <span>Kelola pemasukan dan pengeluaran</span>
            </div>

            <div style="
                display:flex;
                gap:10px;
                flex-wrap:wrap;
                margin-bottom:20px;
            ">
                <button id="add-income" type="button"
                    style="
                        padding:12px 16px;
                        border:0;
                        border-radius:9px;
                        background:#b8d9c1;
                        color:#111;
                        font-weight:bold;
                    ">
                    + Pemasukan
                </button>

                <button id="add-expense" type="button"
                    style="
                        padding:12px 16px;
                        border:0;
                        border-radius:9px;
                        background:#c78f8f;
                        color:#111;
                        font-weight:bold;
                    ">
                    + Pengeluaran
                </button>
            </div>

            <div style="margin-bottom:18px">
                <label style="
                    display:block;
                    color:#aaa;
                    font-size:12px;
                    margin-bottom:8px;
                ">
                    Filter Bulan
                </label>

                <input
                    id="transaction-month"
                    type="month"
                    value="${getCurrentMonth()}"
                    style="
                        background:#252525;
                        color:white;
                        border:1px solid #444;
                        padding:11px;
                        border-radius:8px;
                        max-width:100%;
                    "
                >
            </div>

            <div id="transaction-form-area"></div>

            <div id="transaction-list-area">
                <div class="monetra-loading">
                    Memuat transaksi...
                </div>
            </div>

        </div>
    `;

    const listArea = document.getElementById("transaction-list-area");
    const formArea = document.getElementById("transaction-form-area");
    const monthInput = document.getElementById("transaction-month");

    let transactions = [];
    let editingId = null;
    let saving = false;


    /* =====================================
       LOAD TRANSACTIONS
    ===================================== */

    async function loadTransactions() {
        listArea.innerHTML = `
            <div class="monetra-loading">
                Memuat transaksi...
            </div>
        `;

        try {
            transactions = await getTransactions(uid);

            const month = monthInput.value;

            const filtered = transactions.filter(item =>
                String(item.date || "").startsWith(month)
            );

            const income = filtered
                .filter(item => item.type === "income")
                .reduce((sum, item) => sum + Number(item.amount || 0), 0);

            const expense = filtered
                .filter(item => item.type !== "income")
                .reduce((sum, item) => sum + Number(item.amount || 0), 0);


            let transactionHTML = "";

            if (!filtered.length) {
                transactionHTML = `
                    <div class="monetra-empty">
                        <div class="monetra-empty-icon">▤</div>
                        Belum ada transaksi pada bulan ini.
                    </div>
                `;
            } else {
                transactionHTML = filtered.map(item => {
                    const isIncome = item.type === "income";

                    return `
                        <div style="
                            display:flex;
                            align-items:center;
                            gap:10px;
                            padding:14px 0;
                            border-bottom:1px solid #333;
                        ">

                            <div style="
                                width:38px;
                                height:38px;
                                flex-shrink:0;
                                border-radius:10px;
                                background:#303030;
                                display:grid;
                                place-items:center;
                            ">
                                ${isIncome ? "↗" : "↘"}
                            </div>

                            <div style="flex:1;min-width:0">

                                <div style="
                                    font-size:12px;
                                    font-weight:bold;
                                    overflow-wrap:anywhere;
                                ">
                                    ${safe(item.description || item.category)}
                                </div>

                                <div style="
                                    color:#999;
                                    font-size:10px;
                                    margin-top:5px;
                                ">
                                    ${safe(item.category)} · ${safe(item.date)}
                                </div>

                            </div>

                            <div style="text-align:right">

                                <div style="
                                    font-size:12px;
                                    font-weight:bold;
                                    color:${isIncome ? "#b8d9c1" : "#e2aaaa"};
                                    white-space:nowrap;
                                ">
                                    ${isIncome ? "+" : "-"}${money(item.amount)}
                                </div>

                                <div style="
                                    display:flex;
                                    gap:8px;
                                    margin-top:8px;
                                    justify-content:flex-end;
                                ">
                                    <button
                                        type="button"
                                        data-edit="${safe(item.id)}"
                                        style="
                                            background:none;
                                            color:#ccc;
                                            border:0;
                                            font-size:11px;
                                        ">
                                        Edit
                                    </button>

                                    <button
                                        type="button"
                                        data-delete="${safe(item.id)}"
                                        style="
                                            background:none;
                                            color:#e2aaaa;
                                            border:0;
                                            font-size:11px;
                                        ">
                                        Hapus
                                    </button>
                                </div>

                            </div>
                        </div>
                    `;
                }).join("");
            }


            listArea.innerHTML = `
                <div style="
                    display:grid;
                    grid-template-columns:repeat(2,minmax(0,1fr));
                    gap:10px;
                    margin-bottom:18px;
                ">

                    <div style="
                        background:#202a23;
                        padding:15px;
                        border-radius:10px;
                        min-width:0;
                    ">
                        <div style="color:#aaa;font-size:11px">
                            Pemasukan
                        </div>

                        <strong style="
                            display:block;
                            color:#b8d9c1;
                            margin-top:8px;
                            overflow-wrap:anywhere;
                        ">
                            ${money(income)}
                        </strong>
                    </div>

                    <div style="
                        background:#2b2020;
                        padding:15px;
                        border-radius:10px;
                        min-width:0;
                    ">
                        <div style="color:#aaa;font-size:11px">
                            Pengeluaran
                        </div>

                        <strong style="
                            display:block;
                            color:#e2aaaa;
                            margin-top:8px;
                            overflow-wrap:anywhere;
                        ">
                            ${money(expense)}
                        </strong>
                    </div>

                </div>

                ${transactionHTML}
            `;

        } catch (error) {
            console.error("Monetra Transaction Error:", error);

            listArea.innerHTML = `
                <div class="monetra-empty">
                    Gagal memuat transaksi.

                    <br><br>

                    <span style="font-size:12px;color:#aaa">
                        ${safe(error.message)}
                    </span>

                    <br><br>

                    <button
                        id="retry-transactions"
                        type="button"
                        style="padding:10px 15px;border-radius:8px"
                    >
                        Coba Lagi
                    </button>
                </div>
            `;

            document.getElementById("retry-transactions")
                ?.addEventListener("click", loadTransactions);
        }
    }


    /* =====================================
       SHOW TRANSACTION FORM
    ===================================== */

    async function showForm(type, item = null) {
        if (saving) return;

        const transactionType = normalizeType(type);

        editingId = item?.id || null;

        formArea.innerHTML = `
            <div class="monetra-loading">
                Memuat kategori...
            </div>
        `;

        try {
            const categories = await getCategoriesByType(uid, transactionType);

            const categoryOptions = Array.isArray(categories)
                ? categories.map(category => {
                    const name = typeof category === "string"
                        ? category
                        : category.name;

                    if (!name) return "";

                    return `
                        <option
                            value="${safe(name)}"
                            ${item?.category === name ? "selected" : ""}
                        >
                            ${safe(name)}
                        </option>
                    `;
                }).join("")
                : "";


            formArea.innerHTML = `
                <form
                    id="transaction-form"
                    style="
                        background:#202020;
                        border:1px solid #383838;
                        padding:18px;
                        border-radius:12px;
                        margin-bottom:20px;
                    "
                >

                    <h3 style="font-size:14px;margin:0 0 18px">
                        ${item ? "Edit" : "Tambah"}
                        ${transactionType === "income" ? "Pemasukan" : "Pengeluaran"}
                    </h3>

                    <label style="
                        display:block;
                        color:#aaa;
                        font-size:11px;
                        margin-bottom:7px;
                    ">
                        Nominal
                    </label>

                    <input
                        name="amount"
                        type="number"
                        min="1"
                        step="1"
                        required
                        placeholder="Contoh: 50000"
                        value="${item ? safe(item.amount) : ""}"
                        style="
                            width:100%;
                            padding:12px;
                            background:#151515;
                            color:white;
                            border:1px solid #444;
                            border-radius:8px;
                            margin-bottom:14px;
                        "
                    >

                    <label style="
                        display:block;
                        color:#aaa;
                        font-size:11px;
                        margin-bottom:7px;
                    ">
                        Kategori
                    </label>

                    <select
                        name="category"
                        required
                        style="
                            width:100%;
                            padding:12px;
                            background:#151515;
                            color:white;
                            border:1px solid #444;
                            border-radius:8px;
                            margin-bottom:14px;
                        "
                    >
                        <option value="">Pilih kategori</option>
                        ${categoryOptions}
                    </select>

                    <label style="
                        display:block;
                        color:#aaa;
                        font-size:11px;
                        margin-bottom:7px;
                    ">
                        Tanggal
                    </label>

                    <input
                        name="date"
                        type="date"
                        required
                        value="${item ? safe(item.date) : getLocalDate()}"
                        style="
                            width:100%;
                            padding:12px;
                            background:#151515;
                            color:white;
                            border:1px solid #444;
                            border-radius:8px;
                            margin-bottom:14px;
                        "
                    >

                    <label style="
                        display:block;
                        color:#aaa;
                        font-size:11px;
                        margin-bottom:7px;
                    ">
                        Keterangan
                    </label>

                    <input
                        name="description"
                        type="text"
                        maxlength="200"
                        placeholder="Contoh: Makan siang"
                        value="${item ? safe(item.description || "") : ""}"
                        style="
                            width:100%;
                            padding:12px;
                            background:#151515;
                            color:white;
                            border:1px solid #444;
                            border-radius:8px;
                            margin-bottom:16px;
                        "
                    >

                    <div style="display:flex;gap:10px">

                        <button
                            type="submit"
                            style="
                                flex:1;
                                padding:12px;
                                background:#eee;
                                color:#111;
                                border:0;
                                border-radius:8px;
                                font-weight:bold;
                            "
                        >
                            Simpan
                        </button>

                        <button
                            type="button"
                            id="cancel-transaction"
                            style="
                                padding:12px 16px;
                                background:#333;
                                color:white;
                                border:0;
                                border-radius:8px;
                            "
                        >
                            Batal
                        </button>

                    </div>

                </form>
            `;


            document.getElementById("cancel-transaction")
                .addEventListener("click", () => {
                    formArea.innerHTML = "";
                    editingId = null;
                });


            document.getElementById("transaction-form")
                .addEventListener("submit", async event => {
                    event.preventDefault();

                    if (saving) return;

                    const form = event.currentTarget;
                    const button = form.querySelector('[type="submit"]');

                    const formData = new FormData(form);

                    const data = {
                        type: transactionType,
                        amount: Number(formData.get("amount")),
                        category: formData.get("category"),
                        date: formData.get("date"),
                        description: formData.get("description")
                    };

                    saving = true;
                    button.disabled = true;
                    button.textContent = "Menyimpan...";

                    try {
                        if (editingId) {
                            await updateTransaction(uid, editingId, data);
                        } else {
                            await addTransaction(uid, data);
                        }

                        formArea.innerHTML = "";
                        editingId = null;

                        await loadTransactions();

                        alert("Transaksi berhasil disimpan.");

                    } catch (error) {
                        console.error(error);

                        alert("Gagal menyimpan: " + error.message);

                        button.disabled = false;
                        button.textContent = "Simpan";

                    } finally {
                        saving = false;
                    }
                });

        } catch (error) {
            console.error("Monetra Category Error:", error);

            formArea.innerHTML = `
                <div class="monetra-empty">
                    Gagal memuat kategori.

                    <br><br>

                    <span style="color:#aaa;font-size:12px">
                        ${safe(error.message)}
                    </span>
                </div>
            `;
        }
    }


    /* =====================================
       BUTTON EVENTS
    ===================================== */

    document.getElementById("add-income")
        .addEventListener("click", () => showForm("income"));

    document.getElementById("add-expense")
        .addEventListener("click", () => showForm("expense"));

    monthInput.addEventListener("change", loadTransactions);


    /* =====================================
       EDIT AND DELETE EVENTS
    ===================================== */

    listArea.addEventListener("click", async event => {
        const editButton = event.target.closest("[data-edit]");
        const deleteButton = event.target.closest("[data-delete]");

        if (editButton) {
            const item = transactions.find(
                transaction => transaction.id === editButton.dataset.edit
            );

            if (item) {
                await showForm(item.type, item);
            }
        }

        if (deleteButton) {
            const id = deleteButton.dataset.delete;

            if (!confirm("Yakin ingin menghapus transaksi ini?")) {
                return;
            }

            deleteButton.disabled = true;
            deleteButton.textContent = "Menghapus...";

            try {
                await deleteTransaction(uid, id);

                await loadTransactions();

                alert("Transaksi berhasil dihapus.");

            } catch (error) {
                console.error(error);

                alert("Gagal menghapus: " + error.message);

                deleteButton.disabled = false;
                deleteButton.textContent = "Hapus";
            }
        }
    });


    /* =====================================
       INITIAL LOAD
    ===================================== */

    await loadTransactions();
}


console.log("Monetra Transaction System loaded.");
