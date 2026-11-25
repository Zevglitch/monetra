
import { getTransactions } from "./transactions.js";
import { formatRupiah } from "./finance.js";

let currentUser = null;
let logoutCallback = null;
let currentPage = "dashboard";
let cachedTransactions = [];

function getLocalMonthKey() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");

    return `${year}-${month}`;
}

let selectedMonth = getLocalMonthKey();

const app = document.getElementById("app");

function getAmount(item) {
    return Number(item.amount ?? item.nominal ?? 0);
}

function isIncome(item) {
    const type = String(item.type || "").toLowerCase();

    return (
        type === "income" ||
        type === "pemasukan" ||
        type === "masuk"
    );
}

function getDate(item) {
    if (!item.date) return null;

    if (typeof item.date === "string") {
        return item.date;
    }

    if (item.date.toDate) {
        return item.date.toDate().toISOString().slice(0, 10);
    }

    if (item.date instanceof Date) {
        return item.date.toISOString().slice(0, 10);
    }

    return null;
}

function getMonthTransactions() {
    return cachedTransactions.filter((item) => {
        const date = getDate(item);

        return date && date.slice(0, 7) === selectedMonth;
    });
}

function calculateSummary(transactions) {
    let income = 0;
    let expense = 0;

    transactions.forEach((item) => {
        const amount = getAmount(item);

        if (isIncome(item)) {
            income += amount;
        } else {
            expense += amount;
        }
    });

    return {
        income,
        expense,
        balance: income - expense
    };
}

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, (char) => {
        const entities = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        };

        return entities[char];
    });
}

function getMonthName(monthKey) {
    if (!/^\d{4}-\d{2}$/.test(monthKey)) {
        return monthKey;
    }

    const [year, month] = monthKey.split("-").map(Number);

    return new Date(year, month - 1, 1).toLocaleDateString(
        "id-ID",
        {
            month: "long",
            year: "numeric"
        }
    );
}

function renderHome() {
    const content = document.getElementById("monetra-page-content");

    if (!content) return;

    const transactions = getMonthTransactions();
    const summary = calculateSummary(transactions);

    const recentTransactions = [...transactions]
        .sort((a, b) => {
            return String(getDate(b) || "").localeCompare(
                String(getDate(a) || "")
            );
        })
        .slice(0, 5);

    const maxValue = Math.max(
        summary.income,
        summary.expense,
        1
    );

    const incomeHeight = (summary.income / maxValue) * 100;
    const expenseHeight = (summary.expense / maxValue) * 100;

    content.innerHTML = `
        <section class="welcome-section">
            <div>
                <p class="eyebrow">PERSONAL FINANCE</p>
                <h1>Dashboard</h1>
                <p class="welcome-text">
                    Selamat datang di Monetra,
                    ${escapeHTML(currentUser?.displayName || currentUser?.email || "Pengguna")}.
                </p>
            </div>

            <div class="dashboard-month">
                <label for="dashboard-month">Pilih Bulan</label>
                <input
                    type="month"
                    id="dashboard-month"
                    value="${selectedMonth}"
                >
            </div>
        </section>

        <section class="summary-grid">
            <article class="summary-card balance-card">
                <span>Total Saldo Bulan Ini</span>
                <h2>${formatRupiah(summary.balance)}</h2>
                <small>${escapeHTML(getMonthName(selectedMonth))}</small>
            </article>

            <article class="summary-card income-card">
                <span>Total Pemasukan</span>
                <h2>${formatRupiah(summary.income)}</h2>
                <small>Bulan ${escapeHTML(getMonthName(selectedMonth))}</small>
            </article>

            <article class="summary-card expense-card">
                <span>Total Pengeluaran</span>
                <h2>${formatRupiah(summary.expense)}</h2>
                <small>Bulan ${escapeHTML(getMonthName(selectedMonth))}</small>
            </article>
        </section>

        <section class="dashboard-grid">
            <article class="panel chart-panel">
                <div class="panel-heading">
                    <div>
                        <h3>Ringkasan Keuangan</h3>
                        <p>Perbandingan pemasukan dan pengeluaran</p>
                    </div>
                </div>

                <div class="chart-container">
                    <div class="chart-column">
                        <div class="chart-bar-wrapper">
                            <div
                                class="chart-bar income-bar"
                                style="height:${incomeHeight}%"
                            ></div>
                        </div>
                        <strong>Pemasukan</strong>
                        <span>${formatRupiah(summary.income)}</span>
                    </div>

                    <div class="chart-column">
                        <div class="chart-bar-wrapper">
                            <div
                                class="chart-bar expense-bar"
                                style="height:${expenseHeight}%"
                            ></div>
                        </div>
                        <strong>Pengeluaran</strong>
                        <span>${formatRupiah(summary.expense)}</span>
                    </div>
                </div>
            </article>

            <article class="panel activity-panel">
                <div class="panel-heading">
                    <div>
                        <h3>Aktivitas Terbaru</h3>
                        <p>
                            ${transactions.length} transaksi pada
                            ${escapeHTML(getMonthName(selectedMonth))}
                        </p>
                    </div>
                </div>

                <div class="recent-list">
                    ${
                        recentTransactions.length
                            ? recentTransactions.map((item) => {
                                const income = isIncome(item);
                                const date = getDate(item) || "-";

                                return `
                                    <div class="recent-item">
                                        <div class="recent-icon ${income ? "income-icon" : "expense-icon"}">
                                            ${income ? "↗" : "↙"}
                                        </div>

                                        <div class="recent-info">
                                            <strong>
                                                ${escapeHTML(item.category || "Lainnya")}
                                            </strong>
                                            <small>
                                                ${escapeHTML(item.description || "Tanpa keterangan")}
                                            </small>
                                            <small>${escapeHTML(date)}</small>
                                        </div>

                                        <strong class="recent-amount ${income ? "income-text" : "expense-text"}">
                                            ${income ? "+" : "-"}${formatRupiah(getAmount(item))}
                                        </strong>
                                    </div>
                                `;
                            }).join("")
                            : `
                                <div class="empty-state">
                                    <div class="empty-icon">◈</div>
                                    <strong>Belum ada transaksi</strong>
                                    <p>
                                        Tidak ada transaksi pada
                                        ${escapeHTML(getMonthName(selectedMonth))}.
                                    </p>
                                </div>
                            `
                    }
                </div>
            </article>
        </section>

        <footer class="dashboard-footer">
            <span>MONETRA</span>
            <span>Designed by ZETHER</span>
        </footer>
    `;

    const monthInput = document.getElementById("dashboard-month");

    if (monthInput) {
        monthInput.addEventListener("change", (event) => {
            if (!event.target.value) return;

            selectedMonth = event.target.value;
            renderHome();
        });
    }
}

function renderShell() {
    app.innerHTML = `
        <style>
            * {
                box-sizing: border-box;
            }

            body {
                margin: 0;
                background: #0b0b0d;
                color: #f2f2f2;
                font-family: Arial, sans-serif;
            }

            .monetra-layout {
                display: flex;
                min-height: 100vh;
                background: #0b0b0d;
            }

            .monetra-sidebar {
                width: 245px;
                flex-shrink: 0;
                background: #111114;
                border-right: 1px solid #29292e;
                padding: 28px 18px;
                display: flex;
                flex-direction: column;
            }

            .monetra-brand {
                font-size: 25px;
                font-weight: 800;
                letter-spacing: 3px;
                margin: 5px 10px 5px;
            }

            .monetra-brand span {
                color: #99999f;
            }

            .monetra-tagline {
                color: #77777e;
                font-size: 11px;
                margin: 0 10px 35px;
                letter-spacing: 1px;
            }

            .sidebar-label {
                color: #696970;
                font-size: 10px;
                font-weight: bold;
                letter-spacing: 2px;
                margin: 0 10px 13px;
            }

            .monetra-nav {
                display: flex;
                flex-direction: column;
                gap: 7px;
            }

            .monetra-nav button,
            .logout-button {
                width: 100%;
                border: 0;
                background: transparent;
                color: #a2a2aa;
                padding: 13px 14px;
                border-radius: 10px;
                text-align: left;
                font-size: 14px;
                cursor: pointer;
                transition: .2s;
            }

            .monetra-nav button:hover,
            .monetra-nav button.active {
                background: #29292e;
                color: #fff;
            }

            .sidebar-bottom {
                margin-top: auto;
            }

            .logout-button {
                border: 1px solid #33333a;
                margin-top: 15px;
            }

            .logout-button:hover {
                background: #29292e;
                color: white;
            }

            .monetra-main {
                flex: 1;
                min-width: 0;
                padding: 35px;
            }

            .welcome-section {
                display: flex;
                justify-content: space-between;
                align-items: center;
                gap: 20px;
                margin-bottom: 28px;
            }

            .eyebrow {
                color: #85858d;
                font-size: 10px;
                letter-spacing: 3px;
                font-weight: bold;
            }

            .welcome-section h1 {
                font-size: 31px;
                margin: 8px 0;
            }

            .welcome-text {
                color: #8d8d95;
                font-size: 13px;
            }

            .dashboard-month {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }

            .dashboard-month label {
                font-size: 12px;
                color: #aaaab1;
            }

            .dashboard-month input {
                background: #19191e;
                border: 1px solid #393940;
                border-radius: 9px;
                padding: 11px;
                color: white;
                font-size: 13px;
                color-scheme: dark;
            }

            .summary-grid {
                display: grid;
                grid-template-columns: repeat(3, minmax(0, 1fr));
                gap: 16px;
                margin-bottom: 22px;
            }

            .summary-card {
                background: #151519;
                border: 1px solid #29292f;
                border-radius: 15px;
                padding: 23px;
                min-width: 0;
            }

            .summary-card span {
                color: #9999a1;
                font-size: 12px;
            }

            .summary-card h2 {
                font-size: clamp(19px, 2vw, 26px);
                margin: 17px 0 10px;
                overflow-wrap: anywhere;
            }

            .summary-card small {
                color: #777780;
                font-size: 11px;
            }

            .balance-card {
                background: linear-gradient(135deg, #222228, #151519);
            }

            .income-card h2,
            .income-text {
                color: #c5c5c5;
            }

            .expense-card h2,
            .expense-text {
                color: #888890;
            }

            .dashboard-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 17px;
            }

            .panel {
                background: #151519;
                border: 1px solid #29292f;
                border-radius: 15px;
                padding: 22px;
                min-width: 0;
            }

            .panel-heading h3 {
                margin: 0;
                font-size: 16px;
            }

            .panel-heading p {
                margin: 7px 0 20px;
                color: #777780;
                font-size: 11px;
            }

            .chart-container {
                display: flex;
                align-items: flex-end;
                justify-content: center;
                gap: 45px;
                height: 220px;
                padding-top: 15px;
            }

            .chart-column {
                width: 90px;
                height: 100%;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: flex-end;
                gap: 8px;
                font-size: 11px;
            }

            .chart-bar-wrapper {
                height: 145px;
                width: 45px;
                display: flex;
                align-items: flex-end;
                background: #222228;
                border-radius: 8px;
                overflow: hidden;
            }

            .chart-bar {
                width: 100%;
                min-height: 3px;
                border-radius: 8px;
                transition: height .3s;
            }

            .income-bar {
                background: #b8b8c0;
            }

            .expense-bar {
                background: #62626c;
            }

            .chart-column strong {
                color: #c7c7ce;
            }

            .chart-column span {
                color: #777780;
                font-size: 10px;
                text-align: center;
                overflow-wrap: anywhere;
            }

            .recent-list {
                display: flex;
                flex-direction: column;
            }

            .recent-item {
                display: flex;
                align-items: center;
                gap: 11px;
                padding: 13px 0;
                border-bottom: 1px solid #29292f;
            }

            .recent-item:last-child {
                border-bottom: 0;
            }

            .recent-icon {
                width: 36px;
                height: 36px;
                flex-shrink: 0;
                display: grid;
                place-items: center;
                border-radius: 10px;
                background: #28282e;
                font-size: 18px;
            }

            .recent-info {
                flex: 1;
                min-width: 0;
                display: flex;
                flex-direction: column;
                gap: 4px;
            }

            .recent-info strong {
                font-size: 12px;
            }

            .recent-info small {
                font-size: 10px;
                color: #777780;
                overflow-wrap: anywhere;
            }

            .recent-amount {
                font-size: 11px;
                text-align: right;
                overflow-wrap: anywhere;
            }

            .empty-state {
                text-align: center;
                padding: 35px 10px;
                color: #85858d;
            }

            .empty-icon {
                font-size: 28px;
                margin-bottom: 10px;
            }

            .empty-state strong {
                display: block;
                color: #c5c5cb;
                font-size: 13px;
            }

            .empty-state p {
                font-size: 11px;
            }

            .dashboard-footer {
                display: flex;
                justify-content: space-between;
                color: #55555e;
                font-size: 10px;
                letter-spacing: 2px;
                margin-top: 28px;
                padding: 15px 3px;
            }

            @media (max-width: 850px) {
                .monetra-sidebar {
                    width: 190px;
                }

                .monetra-main {
                    padding: 24px;
                }

                .dashboard-grid {
                    grid-template-columns: 1fr;
                }
            }

            @media (max-width: 600px) {
                .monetra-layout {
                    flex-direction: column;
                }

                .monetra-sidebar {
                    width: 100%;
                    padding: 17px;
                    border-right: 0;
                    border-bottom: 1px solid #29292e;
                }

                .monetra-brand {
                    font-size: 21px;
                }

                .monetra-tagline {
                    margin-bottom: 18px;
                }

                .sidebar-label {
                    margin-bottom: 8px;
                }

                .monetra-nav {
                    display: grid;
                    grid-template-columns: repeat(3, minmax(0, 1fr));
                    gap: 6px;
                }

                .monetra-nav button {
                    padding: 11px 5px;
                    text-align: center;
                    font-size: 11px;
                }

                .sidebar-bottom {
                    margin-top: 8px;
                }

                .logout-button {
                    padding: 10px;
                    text-align: center;
                }

                .monetra-main {
                    padding: 20px 15px;
                }

                .welcome-section {
                    align-items: flex-start;
                    flex-direction: column;
                }

                .welcome-section h1 {
                    font-size: 27px;
                }

                .dashboard-month {
                    width: 100%;
                }

                .dashboard-month input {
                    width: 100%;
                }

                .summary-grid {
                    grid-template-columns: 1fr;
                    gap: 10px;
                }

                .summary-card {
                    padding: 18px;
                }

                .summary-card h2 {
                    margin: 10px 0;
                    font-size: 23px;
                }

                .panel {
                    padding: 17px;
                }

                .dashboard-footer {
                    font-size: 9px;
                }
            }
        </style>

        <div class="monetra-layout">
            <aside class="monetra-sidebar">
                <div>
                    <div class="monetra-brand">
                        MONETRA<span>.</span>
                    </div>

                    <p class="monetra-tagline">
                        PERSONAL FINANCE MANAGER
                    </p>

                    <p class="sidebar-label">MENU UTAMA</p>

                    <nav class="monetra-nav">
                        <button data-page="dashboard" class="active">
                            ◫ Dashboard
                        </button>

                        <button data-page="transactions">
                            ⇄ Transaksi
                        </button>

                        <button data-page="budgets">
                            ◈ Anggaran
                        </button>

                        <button data-page="reports">
                            ▤ Laporan
                        </button>

                        <button data-page="categories">
                            ◉ Kategori
                        </button>
                    </nav>
                </div>

                <div class="sidebar-bottom">
                    <p class="sidebar-label">AKUN</p>

                    <button class="logout-button" id="monetra-logout">
                        ↪ Keluar
                    </button>
                </div>
            </aside>

            <main class="monetra-main">
                <div id="monetra-page-content"></div>
            </main>
        </div>
    `;

    document.querySelectorAll("[data-page]").forEach((button) => {
        button.addEventListener("click", () => {
            navigateTo(button.dataset.page);
        });
    });

    document.getElementById("monetra-logout")
        ?.addEventListener("click", () => {
            if (typeof logoutCallback === "function") {
                logoutCallback();
            }
        });
}

async function refreshDashboardData() {
    cachedTransactions = await getTransactions(currentUser.uid);
}

async function navigateTo(page) {
    currentPage = page;

    document.querySelectorAll("[data-page]").forEach((button) => {
        button.classList.toggle(
            "active",
            button.dataset.page === page
        );
    });

    const content = document.getElementById("monetra-page-content");

    if (!content) return;

    if (page === "dashboard") {
        content.innerHTML = "<p>Memuat dashboard...</p>";

        try {
            await refreshDashboardData();
            renderHome();
        } catch (error) {
            console.error("Dashboard error:", error);

            content.innerHTML = `
                <p>Dashboard gagal dimuat: ${escapeHTML(error.message)}</p>
            `;
        }

        return;
    }

    content.innerHTML = "<p>Memuat halaman...</p>";

    try {
        if (page === "transactions") {
            const module = await import("./transactions.js");
            await module.renderTransactionsPage(currentUser.uid);
        } else if (page === "budgets") {
            const module = await import("./budgets.js");
            await module.renderBudgetsPage(currentUser.uid);
        } else if (page === "reports") {
            const module = await import("./reports.js");
            await module.renderReportsPage(currentUser.uid);
        } else if (page === "categories") {
            const module = await import("./categories.js");
            await module.renderCategoriesPage(currentUser.uid);
        }
    } catch (error) {
        console.error("Page error:", error);

        content.innerHTML = `
            <p>Halaman gagal dimuat: ${escapeHTML(error.message)}</p>
        `;
    }
}

export async function renderDashboard(user, onLogout) {
    currentUser = user;
    logoutCallback = onLogout;

    renderShell();

    const content = document.getElementById("monetra-page-content");

    content.innerHTML = "<p>Memuat data keuangan...</p>";

    try {
        await refreshDashboardData();
        renderHome();
    } catch (error) {
        console.error("Dashboard error:", error);

        content.innerHTML = `
            <p>Dashboard gagal dimuat: ${escapeHTML(error.message)}</p>
        `;
    }
}
