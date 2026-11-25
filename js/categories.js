
/* =========================================
   MONETRA
   CATEGORY MANAGEMENT SYSTEM
========================================= */

import {
    collection,
    addDoc,
    getDocs,
    doc,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.4.0/firebase-firestore.js";

import { db } from "./firebase.js";


/* =========================================
   DEFAULT CATEGORIES
========================================= */

const defaultCategories = [
    { name: "Gaji", type: "income" },
    { name: "Bonus", type: "income" },
    { name: "Usaha", type: "income" },
    { name: "Investasi", type: "income" },
    { name: "Hadiah", type: "income" },
    { name: "Lainnya", type: "income" },

    { name: "Makanan", type: "expense" },
    { name: "Transportasi", type: "expense" },
    { name: "Belanja", type: "expense" },
    { name: "Tagihan", type: "expense" },
    { name: "Hiburan", type: "expense" },
    { name: "Kesehatan", type: "expense" },
    { name: "Pendidikan", type: "expense" },
    { name: "Lainnya", type: "expense" }
];


/* =========================================
   STATE
========================================= */

let categoryEventsController = null;
let categoryBusy = false;


/* =========================================
   FIRESTORE REFERENCES
========================================= */

function categoryCollection(uid) {
    if (!uid) {
        throw new Error("User ID tidak ditemukan.");
    }

    return collection(db, "users", uid, "categories");
}

function categoryDocument(uid, id) {
    if (!uid || !id) {
        throw new Error("Data kategori tidak lengkap.");
    }

    return doc(db, "users", uid, "categories", id);
}

function categorySettingsDocument(uid) {
    return doc(
        db,
        "users",
        uid,
        "settings",
        "categoryDefaults"
    );
}


/* =========================================
   HELPERS
========================================= */

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

function normalizeType(type) {
    const value = String(type || "").toLowerCase();

    if (["income", "pemasukan", "masuk"].includes(value)) {
        return "income";
    }

    return "expense";
}

function validateCategoryName(name) {
    const cleanName = String(name || "").trim();

    if (!cleanName) {
        throw new Error("Nama kategori wajib diisi.");
    }

    if (cleanName.length > 40) {
        throw new Error("Nama kategori maksimal 40 karakter.");
    }

    return cleanName;
}

function showCategoryMessage(message, type = "error") {
    const element = document.getElementById("category-message");

    if (!element) return;

    element.textContent = message;
    element.className = `category-message ${type}`;
    element.style.display = "block";
}

function showCategoryToast(message, type = "success") {
    document.getElementById("category-toast")?.remove();

    const toast = document.createElement("div");

    toast.id = "category-toast";
    toast.className = `category-toast ${type}`;
    toast.textContent = message;

    document.body.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 3000);
}


/* =========================================
   1. INITIALIZE DEFAULT CATEGORIES
========================================= */

export async function ensureDefaultCategories(uid) {
    if (!uid) {
        throw new Error("User ID tidak ditemukan.");
    }

    const settingsRef = categorySettingsDocument(uid);
    const settingsSnapshot = await getDoc(settingsRef);

    if (settingsSnapshot.exists()) {
        return;
    }

    const existing = await getDocs(categoryCollection(uid));

    // Jangan menambahkan kategori bawaan jika pengguna
    // sudah mempunyai kategori sendiri.
    if (existing.empty) {
        for (const category of defaultCategories) {
            await addDoc(categoryCollection(uid), {
                name: category.name,
                type: category.type,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp()
            });
        }
    }

    await setDoc(settingsRef, {
        initialized: true,
        createdAt: serverTimestamp()
    });
}


/* =========================================
   2. GET ALL CATEGORIES
========================================= */

export async function getCategories(uid) {
    if (!uid) return [];

    const snapshot = await getDocs(categoryCollection(uid));

    return snapshot.docs.map(item => ({
        id: item.id,
        ...item.data()
    }));
}


/* =========================================
   3. GET CATEGORY BY ID
========================================= */

export async function getCategoryById(uid, id) {
    if (!uid || !id) return null;

    const snapshot = await getDoc(categoryDocument(uid, id));

    if (!snapshot.exists()) {
        return null;
    }

    return {
        id: snapshot.id,
        ...snapshot.data()
    };
}


/* =========================================
   4. GET CATEGORIES BY TYPE
========================================= */

export async function getCategoriesByType(uid, type) {
    const categories = await getCategories(uid);
    const selectedType = normalizeType(type);

    return categories.filter(category =>
        normalizeType(category.type) === selectedType
    );
}


/* =========================================
   5. ADD CATEGORY
========================================= */

export async function addCategory(uid, name, type) {
    if (!uid) {
        throw new Error("User ID tidak ditemukan.");
    }

    const cleanName = validateCategoryName(name);
    const selectedType = normalizeType(type);

    const categories = await getCategories(uid);

    const duplicate = categories.some(category =>
        String(category.name || "").toLowerCase() ===
            cleanName.toLowerCase() &&
        normalizeType(category.type) === selectedType
    );

    if (duplicate) {
        throw new Error("Kategori tersebut sudah tersedia.");
    }

    const result = await addDoc(categoryCollection(uid), {
        name: cleanName,
        type: selectedType,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
    });

    return result.id;
}


/* =========================================
   6. UPDATE CATEGORY
========================================= */

export async function updateCategory(uid, id, updates) {
    if (!uid || !id) {
        throw new Error("Data kategori tidak lengkap.");
    }

    const newName = validateCategoryName(
        typeof updates === "string"
            ? updates
            : updates?.name
    );

    const categoryRef = categoryDocument(uid, id);
    const categorySnapshot = await getDoc(categoryRef);

    if (!categorySnapshot.exists()) {
        throw new Error("Kategori tidak ditemukan.");
    }

    const oldData = categorySnapshot.data();

    const categories = await getCategories(uid);

    const duplicate = categories.some(category =>
        category.id !== id &&
        String(category.name || "").toLowerCase() ===
            newName.toLowerCase() &&
        normalizeType(category.type) ===
            normalizeType(oldData.type)
    );

    if (duplicate) {
        throw new Error("Nama kategori sudah digunakan.");
    }

    await updateDoc(categoryRef, {
        name: newName,
        updatedAt: serverTimestamp()
    });

    return true;
}


/* =========================================
   7. DELETE CATEGORY
========================================= */

export async function deleteCategory(uid, id) {
    if (!uid || !id) {
        throw new Error("Data kategori tidak lengkap.");
    }

    const categoryRef = categoryDocument(uid, id);
    const snapshot = await getDoc(categoryRef);

    if (!snapshot.exists()) {
        throw new Error("Kategori tidak ditemukan.");
    }

    await deleteDoc(categoryRef);

    return true;
}


/* =========================================
   8. CATEGORY PAGE STYLES
========================================= */

function renderCategoryStyles() {
    if (document.getElementById("monetra-category-styles")) {
        return;
    }

    const style = document.createElement("style");

    style.id = "monetra-category-styles";

    style.textContent = `
        .category-page {
            width: 100%;
            color: #dedee0;
        }

        .category-heading {
            margin-bottom: 22px;
        }

        .category-heading h2 {
            color: #fff;
            font-size: 23px;
            margin: 0 0 6px;
        }

        .category-heading p {
            color: #85858c;
            font-size: 13px;
            margin: 0;
        }

        .category-summary {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 12px;
            margin-bottom: 20px;
        }

        .category-summary-card {
            padding: 17px;
            background: #141416;
            border: 1px solid #2b2b30;
            border-radius: 13px;
            min-width: 0;
        }

        .category-summary-card span {
            display: block;
            color: #85858c;
            font-size: 11px;
            margin-bottom: 8px;
        }

        .category-summary-card strong {
            display: block;
            font-size: 23px;
            color: #fff;
        }

        .category-form-card {
            padding: 20px;
            background: #141416;
            border: 1px solid #2b2b30;
            border-radius: 14px;
            margin-bottom: 22px;
        }

        .category-form-card h3 {
            color: #fff;
            font-size: 16px;
            margin: 0 0 17px;
        }

        .category-form-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 14px;
        }

        .category-field label {
            display: block;
            color: #aaa;
            font-size: 12px;
            margin-bottom: 7px;
        }

        .category-field input,
        .category-field select {
            width: 100%;
            box-sizing: border-box;
            padding: 12px;
            background: #101012;
            border: 1px solid #333;
            border-radius: 9px;
            color: #fff;
            outline: none;
        }

        .category-field input:focus,
        .category-field select:focus {
            border-color: #888;
        }

        .category-form-actions {
            display: flex;
            gap: 9px;
            margin-top: 17px;
        }

        .category-form-actions button {
            padding: 11px 16px;
            border: none;
            border-radius: 9px;
            background: #eee;
            color: #111;
            font-weight: 700;
            cursor: pointer;
        }

        .category-form-actions button:disabled {
            opacity: .5;
            cursor: not-allowed;
        }

        .category-form-actions #category-cancel {
            background: #303035;
            color: #fff;
        }

        .category-message {
            margin-top: 12px;
            font-size: 12px;
        }

        .category-message.error {
            color: #ff9999;
        }

        .category-message.success {
            color: #a5d6b0;
        }

        .category-lists {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 15px;
        }

        .category-list-section {
            padding: 18px;
            background: #141416;
            border: 1px solid #2b2b30;
            border-radius: 14px;
            min-width: 0;
        }

        .category-list-heading {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            margin-bottom: 15px;
        }

        .category-list-heading h3 {
            color: #fff;
            font-size: 14px;
            margin: 0;
        }

        .category-list-heading span {
            color: #85858c;
            font-size: 10px;
        }

        .category-list {
            display: flex;
            flex-direction: column;
            gap: 9px;
        }

        .category-item {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            padding: 12px;
            background: #1c1c20;
            border: 1px solid #303035;
            border-radius: 9px;
        }

        .category-item-name {
            color: #eee;
            font-size: 13px;
            overflow-wrap: anywhere;
        }

        .category-item-actions {
            display: flex;
            gap: 6px;
            flex-shrink: 0;
        }

        .category-item-actions button {
            padding: 7px 9px;
            border: 1px solid #444;
            border-radius: 7px;
            background: #29292d;
            color: #ddd;
            font-size: 11px;
            cursor: pointer;
        }

        .category-item-actions button:hover {
            background: #3a3a40;
        }

        .category-item-actions .category-delete {
            color: #ff9999;
        }

        .category-empty,
        .category-loading {
            padding: 20px 5px;
            color: #777;
            font-size: 12px;
            text-align: center;
        }

        .category-toast {
            position: fixed;
            z-index: 10000;
            bottom: 24px;
            left: 50%;
            transform: translateX(-50%);
            padding: 13px 18px;
            border-radius: 10px;
            background: #166534;
            color: #fff;
            box-shadow: 0 8px 25px rgba(0,0,0,.3);
            font-size: 13px;
            max-width: calc(100% - 32px);
        }

        .category-toast.error {
            background: #991b1b;
        }

        .category-confirm {
            position: fixed;
            inset: 0;
            z-index: 9999;
            display: none;
            align-items: center;
            justify-content: center;
            padding: 18px;
            background: rgba(0,0,0,.75);
        }

        .category-confirm.active {
            display: flex;
        }

        .category-confirm-box {
            width: 100%;
            max-width: 370px;
            padding: 22px;
            background: #19191d;
            border: 1px solid #38383e;
            border-radius: 15px;
        }

        .category-confirm-box h3 {
            margin: 0 0 10px;
            color: #fff;
        }

        .category-confirm-box p {
            color: #999;
            font-size: 13px;
            line-height: 1.6;
        }

        .category-confirm-actions {
            display: flex;
            gap: 10px;
            margin-top: 20px;
        }

        .category-confirm-actions button {
            flex: 1;
            padding: 11px;
            border: 0;
            border-radius: 8px;
            cursor: pointer;
            font-weight: 700;
        }

        #category-delete-cancel {
            background: #303035;
            color: #fff;
        }

        #category-delete-confirm {
            background: #dc2626;
            color: #fff;
        }

        @media(max-width:650px) {
            .category-lists {
                grid-template-columns: 1fr;
            }

            .category-summary {
                gap: 8px;
            }

            .category-summary-card {
                padding: 12px;
            }

            .category-summary-card strong {
                font-size: 19px;
            }
        }

        @media(max-width:400px) {
            .category-form-grid {
                grid-template-columns: 1fr;
            }

            .category-summary-card span {
                font-size: 10px;
            }

            .category-item {
                align-items: flex-start;
            }
        }
    `;

    document.head.appendChild(style);
}


/* =========================================
   9. CATEGORY LIST RENDERING
========================================= */

async function loadCategoryLists(uid) {
    const categories = await getCategories(uid);

    const incomeCategories = categories.filter(category =>
        normalizeType(category.type) === "income"
    );

    const expenseCategories = categories.filter(category =>
        normalizeType(category.type) === "expense"
    );

    const incomeList = document.getElementById("income-category-list");
    const expenseList = document.getElementById("expense-category-list");

    const total = document.getElementById("category-total");
    const incomeTotal = document.getElementById("category-income-total");
    const expenseTotal = document.getElementById("category-expense-total");

    const incomeCount = document.getElementById("income-count");
    const expenseCount = document.getElementById("expense-count");

    if (total) total.textContent = categories.length;
    if (incomeTotal) incomeTotal.textContent = incomeCategories.length;
    if (expenseTotal) expenseTotal.textContent = expenseCategories.length;

    if (incomeCount) {
        incomeCount.textContent = `${incomeCategories.length} kategori`;
    }

    if (expenseCount) {
        expenseCount.textContent = `${expenseCategories.length} kategori`;
    }

    renderCategoryList(incomeList, incomeCategories);
    renderCategoryList(expenseList, expenseCategories);
}


function renderCategoryList(container, categories) {
    if (!container) return;

    if (!categories.length) {
        container.innerHTML = `
            <div class="category-empty">
                Belum ada kategori.
            </div>
        `;
        return;
    }

    container.innerHTML = categories.map(category => `
        <div class="category-item">
            <span class="category-item-name">
                ${escapeHTML(category.name)}
            </span>

            <div class="category-item-actions">
                <button
                    type="button"
                    data-category-edit="${escapeHTML(category.id)}">
                    Edit
                </button>

                <button
                    type="button"
                    class="category-delete"
                    data-category-delete="${escapeHTML(category.id)}">
                    Hapus
                </button>
            </div>
        </div>
    `).join("");
}


/* =========================================
   10. CATEGORY CONFIRMATION
========================================= */

function renderCategoryConfirmation() {
    return `
        <div class="category-confirm" id="category-confirm">
            <div class="category-confirm-box">
                <h3>Hapus Kategori?</h3>

                <p>
                    Kategori ini akan dihapus dari daftar.
                    Transaksi lama yang menggunakan kategori ini
                    tidak akan ikut terhapus.
                </p>

                <div class="category-confirm-actions">
                    <button
                        type="button"
                        id="category-delete-cancel">
                        Batal
                    </button>

                    <button
                        type="button"
                        id="category-delete-confirm">
                        Ya, Hapus
                    </button>
                </div>
            </div>
        </div>
    `;
}


/* =========================================
   11. CATEGORY PAGE
========================================= */

export async function renderCategoriesPage(uid) {
    const content =
        document.getElementById("monetra-page-content") ||
        document.getElementById("page-content");

    if (!content) {
        console.error("Monetra: container kategori tidak ditemukan.");
        return;
    }
v id="income-category-list"
                         class="category-list">
                        <p class="category-loading">Memuat kategori...</p>
                    </div>
                </section>

                <section class="category-list-section">
                    <div class="category-list-heading">
                        <h3>Kategori Pengeluaran</h3>
                        <span id="expense-count">0 kategori</span>
                    </div>

                    <div id="expense-category-list"
                         class="category-list">
                        <p class="category-loading">Memuat kategori...</p>
                    </div>
                </section>

            </div>

        </div>

        <style>
            .category-page {
                color: #dedee0;
                width: 100%;
            }

            .category-heading {
                margin-bottom: 22px;
            }

            .category-heading h2 {
                color: #fff;
                font-size: 23px;
                margin-bottom: 5px;
            }

            .category-heading p {
                color: #85858c;
                font-size: 13px;
            }

            .category-summary {
                display: grid;
                grid-template-columns: repeat(3, minmax(0, 1fr));
                gap: 12px;
                margin-bottom: 20px;
            }

            .category-summary-card {
                padding: 17px;
                background: #141416;
                border: 1px solid #2b2b30;
                border-radius: 13px;
            }

            .category-summary-card span {
                display: block;
                color: #85858c;
                font-size: 11px;
                margin-bottom: 8px;
            }

            .category-summary-card strong {
                font-size: 23px;
                color: #fff;
            }

            .category-form-card {
                padding: 20px;
                background: #141416;
                border: 1px solid #2b2b30;
                border-radius: 14px;
                margin-bottom: 22px;
            }

            .category-form-card h3 {
                color: #fff;
                font-size: 16px;
                margin-bottom: 17px;
            }

            .category-form-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 14px;
            }

            .category-field label {
                display: block;
                color: #aaa;
                font-size: 12px;
                margin-bottom: 7px;
            }

            .category-field input,
            .category-field select {
                width: 100%;
                padding: 12px;
                background: #101012;
                border: 1px solid #333;
                border-radius: 9px;
                color: #fff;
                outline: none;
            }

            .category-field input:focus,
            .category-field select:focus {
                border-color: #777;
            }

            .category-form-actions {
                display: flex;
                gap: 9px;
                margin-top: 17px;
            }

            .category-form-actions button {
                padding: 11px 16px;
                border: none;
                border-radius: 9px;
                background: #eee;
                color: #111;
                font-weight: 700;
            }

            .category-form-actions #category-cancel {
                background: #303035;
                color: #fff;
            }

            .category-message {
                margin-top: 12px;
                font-size: 12px;
            }

            .category-lists {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 15px;
            }

            .category-list-section {
                padding: 18px;
                background: #141416;
                border: 1px solid #2b2b30;
                border-radius: 14px;
                min-width: 0;
            }

            .category-list-heading {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                margin-bottom: 15px;
            }

            .category-list-heading h3 {
                color: #fff;
                font-size: 14px;
            }

            .category-list-heading span {
                color: #85858c;
                font-size: 10px;
            }

            .category-list {
                display: flex;
                flex-direction: column;
                gap: 9px;
            }

            .category-item {
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 8px;
                padding: 12px;
                background: #1c1c20;
                border: 1px solid #303035;
                border-radius: 9px;
            }

            .category-item-name {
                color: #eee;
                font-size: 13px;
                overflow-wrap: anywhere;
            }

            .category-item-actions {
                display: flex;
                gap: 6px;
                flex-shrink: 0;
            }

            .category-item-actions button {
                padding: 6px 9px;
                border: 1px solid #444;
                border-radius: 7px;
                background: #29292d;
                color: #ddd;
                font-size: 11px;
            }

            .category-item-actions .category-delete {
                color: #e0aaaa;
            }

            .category-empty,
            .category-loading {
                padding: 20px 5px;
                color: #777;
                font-size: 12px;
                text-align: center;
            }

            @media(max-width:650px) {
                .category-lists {
                    grid-template-columns: 1fr;
                }

                .category-summary {
                    gap: 8px;
                }

                .category-summary-card {
                    padding: 12px;
                }

                .category-summary-card strong {
                    font-size: 19px;
                }
            }

            @media(max-width:400px) {
                .category-form-grid {
                    grid-template-columns: 1fr;
                }

                .category-summary-card span {
                    font-size: 10px;
                }
            }
        </style>
    `;

    try {
        await ensureDefaultCategories(uid);
        await loadCategoryLists();

    } catch (error) {
        console.error("Category Loading Error:", error);

        content.innerHTML = `
            <div class="category-empty">
                <h3>Gagal Memuat Kategori</h3>
                <p>${escapeHTML(error.message)}</p>
                <button onclick="location.reload()">
                    Muat Ulang
                </button>
            </div>
        `;

        return;
    }

    // ======================================
    // FORM TAMBAH DAN EDIT
    // ======================================

    const form = document.getElementById("category-form");
    const nameInput = document.getElementById("category-name");
    const typeInput = document.getElementById("category-type");
    const submitButton = document.getElementById("category-submit");
    const cancelButton = document.getElementById("category-cancel");

    let editingId = null;

    form.addEventListener("submit", async event => {
        event.preventDefault();

        const name = nameInput.value.trim();
        const type = typeInput.value;

        if (!name) {
            showCategoryMessage("Nama kategori wajib diisi.");
            return;
        }

        submitButton.disabled = true;

        try {
            if (editingId) {
                await updateCategory(uid, editingId, name);
                showCategoryMessage(
                    "Kategori berhasil diperbarui.",
                    "success"
                );
            } else {
                await addCategory(uid, name, type);
                showCategoryMessage(
                    "Kategori berhasil ditambahkan.",
                    "success"
                );
            }

            resetCategoryForm();
            await loadCategoryLists();

        } catch (error) {
            showCategoryMessage(error.message);
        } finally {
            submitButton.disabled = false;
        }
    });

    function resetCategoryForm() {
        editingId = null;
        form.reset();

        document.getElementById("category-form-title").textContent =
            "Tambah Kategori";

        submitButton.textContent = "+ Tambah Kategori";
        cancelButton.style.display = "none";
    }

    cancelButton.addEventListener("click", () => {
        resetCategoryForm();
        document.getElementById("category-message").style.display = "none";
    });

    // ======================================
    // EDIT DAN DELETE
    // ======================================

    content.addEventListener("click", async event => {
        const editButton = event.target.closest("[data-category-edit]");
        const deleteButton = event.target.closest("[data-category-delete]");

        if (editButton) {
            const id = editButton.dataset.categoryEdit;

            const category = await getCategoryById(uid, id);

            if (!category) return;

            editingId = id;
            nameInput.value = category.name;
            typeInput.value = normalizeType(category.type);
            typeInput.disabled = true;

            document.getElementById("category-form-title").textContent =
                "Edit Kategori";

            submitButton.textContent = "Simpan Perubahan";
            cancelButton.style.display = "inline-block";

            document.getElementById("category-form-title")
                .scrollIntoView({ behavior: "smooth", block: "center" });
        }

        if (deleteButton) {
            const id = deleteButton.dataset.categoryDelete;

            const confirmed = confirm(
                "Apakah kamu yakin ingin menghapus kategori ini?"
            );

            if (!confirmed) return;

            try {
                await deleteCategory(uid, id);

                if (editingId === id) {
                    resetCategoryForm();
                }

                await loadCategoryLists();

            } catch (error) {
                alert(error.message || "Gagal menghapus kategori.");
            }
        }
    });

    // Aktifkan kembali pilihan tipe saat form di-reset.
    function resetCategoryForm() {
        editingId = null;
        form.reset();
        typeInput.disabled = false;

        document.getElementById("category-form-title").textContent =
            "Tambah Kategori";

        submitButton.textContent = "+ Tambah Kategori";
        cancelButton.style.display = "none";
    }

    // ======================================
    // MEMUAT DAFTAR KATEGORI
    // ======================================

    async function loadCategoryLists() {
        const categories = await getCategories(uid);

        const income = categories.filter(c =>
            normalizeType(c.type) === "income"
        );

        const expense = categories.filter(c =>
            normalizeType(c.type) === "expense"
        );

        document.getElementById("category-total").textContent =
            categories.length;

        document.getElementById("category-income-total").textContent =
            income.length;

        document.getElementById("category-expense-total").textContent =
            expense.length;

        document.getElementById("income-count").textContent =
            `${income.length} kategori`;

        document.getElementById("expense-count").textContent =
            `${expense.length} kategori`;

        renderList("income-category-list", income);
        renderList("expense-category-list", expense);
    }

    function renderList(elementId, categories) {
        const element = document.getElementById(elementId);

        if (!element) return;

        if (categories.length === 0) {
            element.innerHTML = `
                <div class="category-empty">
                    Belum ada kategori.
                </div>
            `;
            return;
        }

        element.innerHTML = categories.map(category => `
            <div class="category-item">

                <span class="category-item-name">
                    ${escapeHTML(category.name)}
                </span>

                <div class="category-item-actions">

                    <button
                        type="button"
                        data-category-edit="${escapeHTML(category.id)}"
                    >
                        Edit
                    </button>

                    <button
                        type="button"
                        class="category-delete"
                        data-category-delete="${escapeHTML(category.id)}"
                    >
                        Hapus
                    </button>

                </div>

            </div>
        `).join("");
    }
}

// ==========================================
// 9. AMBIL SATU KATEGORI
// ==========================================

async function getCategoryById(uid, id) {
    const snapshot = await getDoc(categoryDocument(uid, id));

    if (!snapshot.exists()) return null;

    return {
        id: snapshot.id,
        ...snapshot.data()
    };
}
