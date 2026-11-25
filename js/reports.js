
/* =========================================
   MONETRA
   FINANCIAL REPORT SYSTEM
========================================= */

import { getTransactions } from "./transactions.js";
import { formatRupiah } from "./finance.js";


/* =========================================
   STATE
========================================= */

let reportMonth = getCurrentMonth();
let reportTransactions = [];
let reportUid = null;


/* =========================================
   DATE HELPERS
========================================= */

function getCurrentMonth() {
    const now = new Date();

    return `${now.getFullYear()}-${String(
        now.getMonth() + 1
    ).padStart(2, "0")}`;
}

function getDate(item) {
    const value = item?.date;

    if (!value) return "";

    if (typeof value === "string") {
        return value.slice(0, 10);
    }

    if (value instanceof Date) {
        return [
            value.getFullYear(),
            String(value.getMonth() + 1).padStart(2, "0"),
            String(value.getDate()).padStart(2, "0")
        ].join("-");
    }

    if (typeof value.toDate === "function") {
        const date = value.toDate();

        return [
            date.getFullYear(),
            String(date.getMonth() + 1).padStart(2, "0"),
            String(date.getDate()).padStart(2, "0")
        ].join("-");
    }

    return "";
}

function monthLabel(month) {
    if (!/^\d{4}-\d{2}$/.test(month)) return month;

    const [year, number] = month.split("-").map(Number);

    return new Date(year, number - 1, 1)
        .toLocaleDateString("id-ID", {
            month: "long",
            year: "numeric"
        });
}


/* =========================================
   GENERAL HELPERS
========================================= */

function safe(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

function getAmount(item) {
    const amount = Number(item?.amount ?? item?.nominal ?? 0);

    return Number.isFinite(amount) ? amount : 0;
}

function isIncome(item) {
    const type = String(item?.type || "").toLowerCase();

    return ["income", "pemasukan", "masuk"].includes(type);
}

function isExpense(item) {
    const type = String(item?.type || "").toLowerCase();

    return ["expense", "pengeluaran", "keluar"].includes(type);
}

function getCategory(item) {
    return String(item?.category || "Lainnya");
}

function getDescription(item) {
    return String(
        item?.description ||
        item?.note ||
        item?.notes ||
        "-"
    );
}


/* =========================================
   REPORT CALCULATION
========================================= */

function buildReport(transactions) {
    const filtered = transactions.filter(item => {
        return getDate(item).slice(0, 7) === reportMonth;
    });

    let income = 0;
    let expense = 0;

    const categories = {};

    filtered.forEach(item => {
        const amount = getAmount(item);

        if (isIncome(item)) {
            income += amount;
        } else if (isExpense(item)) {
            expense += amount;

            const category = getCategory(item);

            categories[category] =
                (categories[category] || 0) + amount;
        }
    });

    return {
        filtered,
        income,
        expense,
        balance: income - expense,

        categories: Object.entries(categories)
            .sort((a, b) => b[1] - a[1]),

        transactionCount: filtered.length
    };
}


/* =========================================
   CSV EXPORT
========================================= */

function exportReportCSV() {
    const report = buildReport(reportTransactions);

    if (!report.filtered.length) {
        showReportMessage(
            "Tidak ada transaksi untuk diekspor.",
            "error"
        );
        return;
    }

    const rows = [
        [
            "Tanggal",
            "Kategori",
            "Keterangan",
            "Jenis",
            "Nominal"
        ]
    ];

    report.filtered.forEach(item => {
        rows.push([
            getDate(item),
            getCategory(item),
            getDescription(item),
            isIncome(item) ? "Pemasukan" : "Pengeluaran",
            getAmount(item)
        ]);
    });

    const csv = rows.map(row =>
        row.map(value => {
            let text = String(value ?? "");

            // Mencegah formula injection saat CSV dibuka.
            if (/^[\s]*[=+\-@]/.test(text)) {
                text = "'" + text;
            }

            return `"${text.replace(/"/g, '""')}"`;
        }).join(",")
    ).join("\r\n");

    const blob = new Blob(
        ["\uFEFF" + csv],
        { type: "text/csv;charset=utf-8;" }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = `Monetra-Laporan-${reportMonth}.csv`;

    document.body.appendChild(link);
    link.click();
    link.remove();

    URL.revokeObjectURL(url);

    showReportMessage(
        "Laporan berhasil diekspor.",
        "success"
    );
}


/* =========================================
   MESSAGE
========================================= */

function showReportMessage(message, type = "success") {
    document.getElementById("report-message")?.remove();

    const element = document.createElement("div");

    element.id = "report-message";
    element.className = `report-message ${type}`;
    element.textContent = message;

    const container = document.querySelector(".report-page");

    if (!container) return;

    container.prepend(element);

    setTimeout(() => {
        element.remove();
    }, 3000);
}


/* =========================================
   REPORT STYLES
========================================= */

function reportStyles() {
    return `
        <style>
            .report-page {
                color: #eee;
                width: 100%;
            }

            .report-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 15px;
                flex-wrap: wrap;
                margin-bottom: 25px;
            }

            .report-header h1 {
                margin: 0 0 8px;
                font-size: 27px;
            }

            .report-muted {
                color: #85858d;
                font-size: 12px;
            }

            .report-header input {
                background: #19191e;
                color: white;
                border: 1px solid #393940;
                border-radius: 9px;
                padding: 11px;
                color-scheme: dark;
            }

            .report-actions {
                display: flex;
                gap: 9px;
                flex-wrap: wrap;
                margin-bottom: 20px;
            }

            .report-button {
                padding: 11px 15px;
                border: 1px solid #44444b;
                border-radius: 9px;
                background: #222228;
                color: #eee;
                font-weight: 600;
                cursor: pointer;
            }

            .report-button.primary {
                background: #eee;
                color: #111;
                border-color: #eee;
            }

            .report-button:disabled {
                opacity: .5;
                cursor: not-allowed;
            }

            .report-stats {
                display: grid;
                grid-template-columns: repeat(3, minmax(0, 1fr));
                gap: 13px;
                margin-bottom: 20px;
            }

            .report-stat,
            .report-panel {
                background: #151519;
                border: 1px solid #29292f;
                border-radius: 13px;
                padding: 20px;
                min-width: 0;
            }

            .report-stat span {
                color: #9999a1;
                font-size: 12px;
            }

            .report-stat h2 {
                font-size: clamp(17px, 2vw, 24px);
                overflow-wrap: anywhere;
                margin-bottom: 0;
            }

            .report-columns {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 15px;
            }

            .report-panel h3 {
                margin: 0 0 18px;
                font-size: 16px;
            }

            .report-category {
                margin: 18px 0;
            }

            .report-category-top {
                display: flex;
                justify-content: space-between;
                gap: 10px;
                font-size: 12px;
                margin-bottom: 8px;
            }

            .report-category-top strong {
                overflow-wrap: anywhere;
            }

            .report-track {
                height: 8px;
                border-radius: 20px;
                background: #303037;
                overflow: hidden;
            }

            .report-track div {
                height: 100%;
                background: #aaaab2;
                border-radius: 20px;
            }

            .report-table-wrap {
                overflow-x: auto;
            }

            .report-table {
                width: 100%;
                border-collapse: collapse;
                font-size: 12px;
                min-width: 450px;
            }

            .report-table th,
            .report-table td {
                padding: 12px 8px;
                text-align: left;
                border-bottom: 1px solid #29292f;
            }

            .report-table th {
                color: #85858d;
                white-space: nowrap;
            }

            .report-table td {
                color: #ddd;
            }

            .report-income {
                color: #86d6a0 !important;
            }

            .report-expense {
                color: #e6a0a0 !important;
            }

            .report-empty {
                color: #85858d;
                padding: 20px 0;
                font-size: 12px;
            }

            .report-footer {
                text-align: right;
                margin-top: 25px;
                color: #55555e;
                font-size: 10px;
                letter-spacing: 2px;
            }

            .report-message {
                padding: 12px 15px;
                margin-bottom: 15px;
                border-radius: 9px;
                font-size: 13px;
                background: #173c27;
                color: #b5e6c4;
            }

            .report-message.error {
                background: #451d1d;
                color: #ffb0b0;
            }

            @media(max-width: 650px) {
                .report-stats {
                    grid-template-columns: 1fr;
                }

                .report-columns {
                    grid-template-columns: 1fr;
                }

                .report-header {
                    align-items: flex-start;
                }

                .report-header input {
                    width: 100%;
                    box-sizing: border-box;
                }
            }
        </style>
    `;
}


/* =========================================
   REPORT RENDERING
========================================= */

function renderReport() {
    const container = document.getElementById("monetra-page-content");

    if (!container) return;

    const report = buildReport(reportTransactions);

    const maxCategory = Math.max(
        ...report.categories.map(item => item[1]),
        1
    );

    container.innerHTML = `
        <div class="report-page">

            ${reportStyles()}

            <div class="report-header">
                <div>
                    <p class="report-muted">MONETRA / ANALISIS</p>
                    <h1>Laporan Keuangan</h1>
                    <p class="report-muted">
                        Ringkasan aktivitas keuangan bulanan.
                    </p>
                </div>

                <input
                    type="month"
                    id="report-month"
                    value="${safe(reportMonth)}"
                >
            </div>

            <div class="report-actions">
                <button
                    type="button"
                    class="report-button primary"
                    id="report-export">
                    ↓ Ekspor CSV
                </button>

                <button
                    type="button"
                    class="report-button"
                    id="report-refresh">
                    ↻ Muat Ulang
                </button>
            </div>

            <section class="report-stats">

                <div class="report-stat">
                    <span>Total Pemasukan</span>
                    <h2>${formatRupiah(report.income)}</h2>
                </div>

                <div class="report-stat">
                    <span>Total Pengeluaran</span>
                    <h2>${formatRupiah(report.expense)}</h2>
                </div>

                <div class="report-stat">
                    <span>Selisih / Saldo</span>
                    <h2>${formatRupiah(report.balance)}</h2>
                </div>

            </section>

            <section class="report-columns">

                <article class="report-panel">
                    <h3>Pengeluaran per Kategori</h3>

                    ${
                        report.categories.length
                            ? report.categories.map(([name, amount]) => {
                                const width = amount / maxCategory * 100;

                                return `
                                    <div class="report-category">

                                        <div class="report-category-top">
                                            <strong>${safe(name)}</strong>
                                            <span>${formatRupiah(amount)}</span>
                                        </div>

                                        <div class="report-track">
                                            <div style="width:${width}%"></div>
                                        </div>

                                    </div>
                                `;
                            }).join("")
                            : `
                                <p class="report-empty">
                                    Belum ada pengeluaran pada bulan ini.
                                </p>
                            `
                    }
                </article>

                <article class="report-panel">
                    <h3>Informasi Bulan</h3>

                    <p class="report-muted">
                        ${safe(monthLabel(reportMonth))}
                    </p>

                    <h2>${report.transactionCount} transaksi</h2>

                    <p class="report-muted">
                        ${
                            report.transactionCount > 0
                                ? "Data laporan dihitung dari transaksi yang tersimpan."
                                : "Belum ada aktivitas keuangan pada bulan ini."
                        }
                    </p>

                    <p class="report-muted">
                        Total kategori pengeluaran:
                        ${report.categories.length}
                    </p>
                </article>

            </section>

            <section class="report-panel" style="margin-top:15px">

                <h3>Riwayat Transaksi Bulan Ini</h3>

                <div class="report-table-wrap">

                    <table class="report-table">

                        <thead>
                            <tr>
                                <th>Tanggal</th>
                                <th>Kategori</th>
                                <th>Keterangan</th>
                                <th>Jenis</th>
                                <th>Nominal</th>
                            </tr>
                        </thead>

                        <tbody>

                            ${
                                report.filtered.length
                                    ? [...report.filtered]
                                        .sort((a, b) =>
                                            getDate(b).localeCompare(getDate(a))
                                        )
                                        .map(item => `
                                            <tr>
                                                <td>${safe(getDate(item))}</td>

                                                <td>
                                                    ${safe(getCategory(item))}
                                                </td>

                                                <td>
                                                    ${safe(getDescription(item))}
                                                </td>

                                                <td class="${
                                                    isIncome(item)
                                                        ? "report-income"
                                                        : "report-expense"
                                                }">
                                                    ${
                                                        isIncome(item)
                                                            ? "Pemasukan"
                                                            : "Pengeluaran"
                                                    }
                                                </td>

                                                <td>
                                                    ${formatRupiah(getAmount(item))}
                                                </td>
                                            </tr>
                                        `).join("")
                                    : `
                                        <tr>
                                            <td colspan="5" class="report-empty">
                                                Belum ada transaksi.
                                            </td>
                                        </tr>
                                    `
                            }

                        </tbody>

                    </table>

                </div>

            </section>

            <div class="report-footer">
                DESIGNED BY ZETHER
            </div>

        </div>
    `;


    /* =====================================
       MONTH FILTER
    ===================================== */

    document.getElementById("report-month")
        ?.addEventListener("change", event => {
            if (!event.target.value) return;

            reportMonth = event.target.value;

            renderReport();
        });


    /* =====================================
       EXPORT BUTTON
    ===================================== */

    document.getElementById("report-export")
        ?.addEventListener("click", exportReportCSV);


    /* =====================================
       REFRESH BUTTON
    ===================================== */

    document.getElementById("report-refresh")
        ?.addEventListener("click", async () => {
            await refreshReport();
        });
}


/* =========================================
   REFRESH REPORT DATA
========================================= */

async function refreshReport() {
    if (!reportUid) return;

    const button = document.getElementById("report-refresh");

    if (button) {
        button.disabled = true;
        button.textContent = "Memuat...";
    }

    try {
        const transactions = await getTransactions(reportUid);

        reportTransactions = Array.isArraid = uid;

    const container = document.getElementById("monetra-page-content");

    if (!container) {
        throw new Error("Elemen monetra-page-content tidak ditemukan.");
    }

    if (!reportUid) {
        container.innerHTML = "<p>Akun pengguna tidak ditemukan.</p>";
        return;
    }

    container.innerHTML = "<p>Memuat laporan...</p>";

    try {
        const transactions = await getTransactions(reportUid);
        renderReport(transactions);
    } catch (error) {
        console.error("Report error:", error);
        container.innerHTML = `
            <h2>Laporan gagal dimuat</h2>
            <p>${safe(error.message)}</p>
        `;
    }
}
