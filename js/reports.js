
import { getTransactions } from "./transactions.js";
import { formatRupiah } from "./finance.js";

let reportUid = null;
let reportMonth = getCurrentMonth();

function getCurrentMonth() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function safe(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

function getDate(item) {
    if (!item.date) return "";
    if (typeof item.date === "string") return item.date;
    if (item.date.toDate) return item.date.toDate().toISOString().slice(0, 10);
    if (item.date instanceof Date) return item.date.toISOString().slice(0, 10);
    return "";
}

function isIncome(item) {
    const type = String(item.type || "").toLowerCase();
    return ["income", "pemasukan", "masuk"].includes(type);
}

function getAmount(item) {
    return Number(item.amount ?? item.nominal ?? 0);
}

function monthLabel(month) {
    const [year, number] = month.split("-").map(Number);
    return new Date(year, number - 1, 1).toLocaleDateString("id-ID", {
        month: "long",
        year: "numeric"
    });
}

function buildReport(transactions) {
    const filtered = transactions.filter(item =>
        getDate(item).slice(0, 7) === reportMonth
    );

    let income = 0;
    let expense = 0;
    const categories = {};

    filtered.forEach(item => {
        const amount = getAmount(item);
        const category = item.category || "Lainnya";

        if (isIncome(item)) {
            income += amount;
        } else {
            expense += amount;
            categories[category] = (categories[category] || 0) + amount;
        }
    });

    return {
        filtered,
        income,
        expense,
        balance: income - expense,
        categories: Object.entries(categories).sort((a, b) => b[1] - a[1])
    };
}

function renderReport(transactions) {
    const container = document.getElementById("monetra-page-content");
    if (!container) return;

    const report = buildReport(transactions);
    const maxCategory = Math.max(
        ...report.categories.map(item => item[1]),
        1
    );

    container.innerHTML = `
        <div class="report-page">
            <style>
                .report-page { color:#eee; }
                .report-header {
                    display:flex; justify-content:space-between;
                    align-items:center; gap:15px; flex-wrap:wrap;
                    margin-bottom:25px;
                }
                .report-header h1 { margin:0 0 8px; font-size:28px; }
                .report-muted { color:#85858d; font-size:12px; }
                .report-header input {
                    background:#19191e; color:white;
                    border:1px solid #393940; border-radius:9px;
                    padding:11px; color-scheme:dark;
                }
                .report-stats {
                    display:grid; grid-template-columns:repeat(3,minmax(0,1fr));
                    gap:13px; margin-bottom:20px;
                }
                .report-stat, .report-panel {
                    background:#151519; border:1px solid #29292f;
                    border-radius:13px; padding:20px; min-width:0;
                }
                .report-stat span { color:#9999a1; font-size:12px; }
                .report-stat h2 { font-size:clamp(18px,2vw,24px); overflow-wrap:anywhere; }
                .report-columns {
                    display:grid; grid-template-columns:1fr 1fr; gap:15px;
                }
                .report-panel h3 { margin-top:0; }
                .report-category {
                    margin:18px 0;
                }
                .report-category-top {
                    display:flex; justify-content:space-between;
                    gap:10px; font-size:12px; margin-bottom:8px;
                }
                .report-track {
                    height:8px; border-radius:20px;
                    background:#303037; overflow:hidden;
                }
                .report-track div {
                    height:100%; background:#aaaab2;
                }
                .report-table-wrap { overflow-x:auto; }
                .report-table {
                    width:100%; border-collapse:collapse;
                    font-size:12px; min-width:400px;
                }
                .report-table th, .report-table td {
                    padding:12px 8px; text-align:left;
                    border-bottom:1px solid #29292f;
                }
                .report-table th { color:#85858d; }
                .report-empty { color:#85858d; padding:20px 0; font-size:12px; }
                .report-footer {
                    text-align:right; margin-top:25px;
                    color:#55555e; font-size:10px; letter-spacing:2px;
                }
                @media(max-width:650px) {
                    .report-stats { grid-template-columns:1fr; }
                    .report-columns { grid-template-columns:1fr; }
                }
            </style>

            <div class="report-header">
                <div>
                    <p class="report-muted">MONETRA / ANALISIS</p>
                    <h1>Laporan Keuangan</h1>
                    <p class="report-muted">Ringkasan aktivitas keuangan bulanan.</p>
                </div>
                <input type="month" id="report-month" value="${reportMonth}">
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
                        : `<p class="report-empty">Belum ada pengeluaran pada bulan ini.</p>`
                    }
                </article>

                <article class="report-panel">
                    <h3>Informasi Bulan</h3>
                    <p class="report-muted">${safe(monthLabel(reportMonth))}</p>
                    <h2>${report.filtered.length} transaksi</h2>
                    <p class="report-muted">
                        ${
                            report.income + report.expense > 0
                            ? "Data laporan dihitung dari transaksi yang tersimpan."
                            : "Belum ada aktivitas keuangan pada bulan ini."
                        }
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
                                    .sort((a, b) => getDate(b).localeCompare(getDate(a)))
                                    .map(item => `
                                        <tr>
                                            <td>${safe(getDate(item))}</td>
                                            <td>${safe(item.category || "Lainnya")}</td>
                                            <td>${safe(item.description || "-")}</td>
                                            <td>${isIncome(item) ? "Pemasukan" : "Pengeluaran"}</td>
                                            <td>${formatRupiah(getAmount(item))}</td>
                                        </tr>
                                    `).join("")
                                : `<tr><td colspan="5" class="report-empty">Belum ada transaksi.</td></tr>`
                            }
                        </tbody>
                    </table>
                </div>
            </section>

            <div class="report-footer">DESIGNED BY ZETHER</div>
        </div>
    `;

    document.getElementById("report-month").addEventListener("change", event => {
        if (!event.target.value) return;
        reportMonth = event.target.value;
        renderReport(transactions);
    });
}

export async function renderReportsPage(uid) {
    reportUid = uid;

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
