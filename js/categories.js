
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

// ==========================================
// KONFIGURASI
// ==========================================

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

function categoryCollection(uid) {
    return collection(db, "users", uid, "categories");
}

function categoryDocument(uid, id) {
    return doc(db, "users", uid, "categories", id);
}

// ==========================================
// HELPER
// ==========================================

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
    return ["income", "pemasukan", "masuk"].includes(
        String(type).toLowerCase()
    ) ? "income" : "expense";
}

function showCategoryMessage(message, type = "error") {
    const element = document.getElementById("category-message");

    if (!element) return;

    element.textContent = message;
    element.style.display = "block";
    element.style.color = type === "success" ? "#a5d6b0" : "#ff9999";
}

// ==========================================
// 2. KATEGORI DEFAULT
// ==========================================

export async function ensureDefaultCategories(uid) {
    if (!uid) throw new Error("User ID tidak ditemukan.");

    const settingsRef = doc(
        db,
        "users",
        uid,
        "settings",
        "categoryDefaults"
    );

    const settingsSnapshot = await getDoc(settingsRef);

    if (settingsSnapshot.exists()) {
        return;
    }

    const existing = await getDocs(categoryCollection(uid));

    // Jangan menambahkan kategori bawaan jika kategori
    // pengguna sudah tersedia.
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

// ==========================================
// 3. AMBIL SEMUA KATEGORI
// ==========================================

export async function getCategories(uid) {
    if (!uid) return [];

    const snapshot = await getDocs(categoryCollection(uid));

    return snapshot.docs.map(document => ({
        id: document.id,
        ...document.data()
    }));
}

// ==========================================
// 4. AMBIL KATEGORI BERDASARKAN TIPE
// ==========================================

export async function getCategoriesByType(uid, type) {
    const categories = await getCategories(uid);
    const selectedType = normalizeType(type);

    return categories.filter(category =>
        normalizeType(category.type) === selectedType
    );
}

// ==========================================
// 5. TAMBAH KATEGORI
// ==========================================

export async function addCategory(uid, name, type) {
    if (!uid) throw new Error("User ID tidak ditemukan.");

    const cleanName = String(name || "").trim();

    if (!cleanName) {
        throw new Error("Nama kategori wajib diisi.");
    }

    if (cleanName.length > 40) {
        throw new Error("Nama kategori maksimal 40 karakter.");
    }

    const selectedType = normalizeType(type);

    const categories = await getCategories(uid);

    const duplicate = categories.some(category =>
        category.name?.toLowerCase() === cleanName.toLowerCase() &&
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

// ==========================================
// 6. EDIT KATEGORI
// ==========================================

export async function updateCategory(uid, id, updates) {
    if (!uid || !id) {
        throw new Error("Data kategori tidak lengkap.");
    }

    const newName = typeof updates === "string"
        ? updates.trim()
        : String(updates.name || "").trim();

    if (!newName) {
        throw new Error("Nama kategori tidak boleh kosong.");
    }

    if (newName.length > 40) {
        throw new Error("Nama kategori maksimal 40 karakter.");
    }

    const existingCategory = await getDoc(categoryDocument(uid, id));

    if (!existingCategory.exists()) {
        throw new Error("Kategori tidak ditemukan.");
    }

    const oldData = existingCategory.data();

    const categories = await getCategories(uid);

    const duplicate = categories.some(category =>
        category.id !== id &&
        category.name?.toLowerCase() === newName.toLowerCase() &&
        normalizeType(category.type) === normalizeType(oldData.type)
    );

    if (duplicate) {
        throw new Error("Nama kategori sudah digunakan.");
    }

    await updateDoc(categoryDocument(uid, id), {
        name: newName,
        updatedAt: serverTimestamp()
    });

    return true;
}

// ==========================================
// 7. HAPUS KATEGORI
// ==========================================

export async function deleteCategory(uid, id) {
    if (!uid || !id) {
        throw new Error("Data kategori tidak lengkap.");
    }

    await deleteDoc(categoryDocument(uid, id));

    return true;
}

// ==========================================
// 8. TAMPILAN HALAMAN KATEGORI
// ==========================================

export async function renderCategoriesPage(uid) {
    const content =
        document.getElementById("monetra-page-content") ||
        document.getElementById("page-content");

    if (!content) {
        console.error("Container halaman kategori tidak ditemukan.");
        return;
    }

    content.innerHTML = `
        <div class="category-page">

            <div class="category-heading">
                <div>
                    <h2>Manajemen Kategori</h2>
                    <p>Atur kategori pemasukan dan pengeluaranmu.</p>
                </div>
            </div>

            <div class="category-summary">
                <div class="category-summary-card">
                    <span>Total Kategori</span>
                    <strong id="category-total">0</strong>
                </div>

                <div class="category-summary-card">
                    <span>Pemasukan</span>
                    <strong id="category-income-total">0</strong>
                </div>

                <div class="category-summary-card">
                    <span>Pengeluaran</span>
                    <strong id="category-expense-total">0</strong>
                </div>
            </div>

            <div class="category-form-card">
                <h3 id="category-form-title">Tambah Kategori</h3>

                <form id="category-form">

                    <div class="category-form-grid">

                        <div class="category-field">
                            <label for="category-name">
                                Nama Kategori
                            </label>

                            <input
                                type="text"
                                id="category-name"
                                placeholder="Contoh: Internet"
                                maxlength="40"
                                required
                            >
                        </div>

                        <div class="category-field">
                            <label for="category-type">
                                Jenis Kategori
                            </label>

                            <select id="category-type" required>
                                <option value="expense">Pengeluaran</option>
                                <option value="income">Pemasukan</option>
                            </select>
                        </div>

                    </div>

                    <div id="category-message"
                         class="category-message"
                         style="display:none;">
                    </div>

                    <div class="category-form-actions">

                        <button type="submit" id="category-submit">
                            + Tambah Kategori
                        </button>

                        <button
                            type="button"
                            id="category-cancel"
                            style="display:none;"
                        >
                            Batal
                        </button>

                    </div>

                </form>
            </div>

            <div class="category-lists">

                <section class="category-list-section">
                    <div class="category-list-heading">
                        <h3>Kategori Pemasukan</h3>
                        <span id="income-count">0 kategori</span>
                    </div>

                    <div id="income-category-list"
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
