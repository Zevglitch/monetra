
/* =====================================
   MONETRA
   DASHBOARD SYSTEM
===================================== */

import {
    getTransactions
} from "./transactions.js";

import {
    formatRupiah
} from "./finance.js";

import {
    createNavigationHTML,
    setupNavigation
} from "./navigation.js";

/* =====================================
   STATE
===================================== */

let currentUser = null;
let logoutCallback = null;
let cachedTransactions = [];
let selectedMonth = getCurrentMonth();

/* =====================================
   HELPER FUNCTIONS
===================================== */

function getCurrentMonth() {
    const now = new Date();

    return [
        now.getFullYear(),
        String(now.getMonth() + 1).padStart(2, "0")
    ].join("-");
}

function escapeHTML(value) {
    return String(value ?? "").replace(
        /[&<>"']/g,
        char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        })[char]
    );
}

function getMonthName(monthValue) {
    const [year, month] = monthValue.split("-");

    const date = new Date(
        Number(year),
        Number(month) - 1,
        1
    );

    return date.toLocaleDateString("id-ID", {
        month: "long",
        year: "numeric"
    });
}

function getTransactionAmount(transaction) {
    const amount = Number(
        transaction.amount ??
        transaction.nominal ??
        transaction.total ??
        0
    );

    return Number.isFinite(amount) ? Math.abs(amount) : 0;
}

function getTransactionDate(transaction) {
    const value =
        transaction.date ??
        transaction.transactionDate ??
        transaction.createdAt;

    if (!value) return "";

    if (typeof value === "string") {
        return value.slice(0, 10);
    }

    if (value?.toDate) {
        return value.toDate().toISOString().slice(0, 10);
    }

    if (value instanceof Date) {
        return value.toISOString().slice(0, 10);
    }

    return "";
}

function getTransactionType(transaction) {
    const type = String(
        transaction.type ??
        transaction.transactionType ??
        ""
    ).toLowerCase();

    if (
        ["income", "pemasukan", "masuk"].includes(type)
    ) {
        return "income";
    }

    return "expense";
}

function getTransactionCategory(transaction) {
    return (
        transaction.category ??
        transaction.categoryName ??
        "Lainnya"
    );
}

function getTransactionDescription(transaction) {
    return (
        transaction.description ??
        transaction.note ??
        transaction.notes ??
        transaction.title ??
        getTransactionCategory(transaction)
    );
}

function getDateLabel(dateValue) {
    if (!dateValue) return "-";

    const date = new Date(dateValue + "T00:00:00");

    if (Number.isNaN(date.getTime())) {
        return "-";
    }

    return date.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "short",
        year: "numeric"
    });
}

/* =====================================
   FILTER TRANSACTIONS
===================================== */

function getMonthlyTransactions() {
    return cachedTransactions.filter(transaction => {
        const date = getTransactionDate(transaction);

        return date.startsWith(selectedMonth);
    });
}

function calculateSummary(transactions) {
    let income = 0;
    let expense = 0;

    transactions.forEach(transaction => {
        const amount = getTransactionAmount(transaction);

        if (getTransactionType(transaction) === "income") {
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

/* =====================================
   DASHBOARD STYLES
===================================== */

function injectDashboardStyles() {
    if (document.getElementById("monetra-dashboard-style")) {
        return;
    }

    const style = document.createElement("style");

    style.id = "monetra-dashboard-style";

    style.textContent = `
        .monetra-shell {
            display: flex;
            min-height: 100vh;
            background: #111114;
            color: #f4f4f5;
            font-family: Arial, sans-serif;
        }

        .monetra-sidebar {
            width: 245px;
            min-width: 245px;
            background: #19191e;
            border-right: 1px solid #29292f;
            padding: 25px 17px;
            display: flex;
            flex-direction: column;
        }

        .monetra-brand {
            padding: 8px 10px 35px;
        }

        .monetra-brand h2 {
            font-size: 23px;
            letter-spacing: 3px;
            margin: 0;
        }

        .monetra-brand small {
            display: block;
            color: #777780;
            font-size: 9px;
            letter-spacing: 2px;
            margin-top: 7px;
        }

        .sidebar-label {
            color: #777780;
            font-size: 10px;
            font-weight: bold;
            letter-spacing: 2px;
            margin: 0 10px 13px;
        }

        .sidebar-navigation {
            display: flex;
            flex-direction: column;
            gap: 7px;
        }

        .sidebar-navigation .nav-item,
        .monetra-logout {
            width: 100%;
            border: 1px solid transparent;
            background: transparent;
            color: #a2a2aa;
            padding: 13px 14px;
            border-radius: 10px;
            text-align: left;
            font-size: 13px;
            cursor: pointer;
            transition: .2s;
            display: flex;
            align-items: center;
            gap: 12px;
        }

        .sidebar-navigation .nav-item:hover,
        .sidebar-navigation .nav-item.active {
            background: #29292e;
            color: #fff;
        }

        .nav-icon {
            width: 20px;
            text-align: center;
        }

        .sidebar-bottom {
            margin-top: auto;
        }

        .monetra-logout {
            border-color: #33333a;
            margin-top: 15px;
        }

        .monetra-logout:hover {
            background: #29292e;
            color: white;
        }

        .monetra-main {
            flex: 1;
            min-width: 0;
            padding: 32px;
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
            font-size: 30px;
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
            background: #202025;
            color: white;
            border: 1px solid #38383f;
            border-radius: 9px;
            padding: 10px;
            color-scheme: dark;
        }

        .summary-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 15px;
            margin-bottom: 20px;
        }

        .summary-card {
            background: #1c1c21;
            border: 1px solid #303037;
            border-radius: 14px;
            padding: 21px;
            min-width: 0;
        }

        .summary-card span {
            color: #a1a1aa;
            font-size: 12px;
        }

        .summary-card h2 {
            font-size: clamp(17px, 2vw, 25px);
            margin: 15px 0 9px;
            overflow-wrap: anywhere;
        }

        .summary-card small {
            color: #777780;
            font-size: 11px;
        }

        .balance-card {
            border-top: 3px solid #a1a1aa;
        }

        .income-card {
            border-top: 3px solid #7dba98;
        }

        .expense-card {
            border-top: 3px solid #cf8585;
        }

        .dashboard-grid {
            display: grid;
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
            gap: 17px;
        }

        .panel {
            background: #1c1c21;
            border: 1px solid #303037;
            border-radius: 14px;
            padding: 21px;
            min-width: 0;
        }

        .panel-heading {
            margin-bottom: 22px;
        }

        .panel-heading h3 {
            font-size: 15px;
            margin: 0 0 7px;
        }

        .panel-heading p {
            color: #85858d;
            font-size: 11px;
            margin: 0;
        }

        .chart-container {
            height: 210px;
            display: flex;
            justify-content: center;
            align-items: flex-end;
            gap: 55px;
            padding: 10px 10px 0;
        }

        .chart-column {
            flex: 1;
            max-width: 120px;
            height: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: flex-end;
            gap: 9px;
            min-width: 0;
        }

        .chart-bar-wrapper {
            width: 48px;
            height: 135px;
            display: flex;
            align-items: flex-end;
            background: #29292f;
            border-radius: 8px 8px 3px 3px;
            overflow: hidden;
        }

        .chart-bar {
            width: 100%;
            min-height: 0;
            border-radius: 8px 8px 3px 3px;
            transition: height .3s ease;
        }

        .income-bar {
            background: #7dba98;
        }

        .expense-bar {
            background: #cf8585;
        }

        .chart-column strong {
            font-size: 11px;
        }

        .chart-column span {
            font-size: 10px;
            color: #9999a1;
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
            overflow-wrap: anywhere;
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

        .income-text {
            color: #8ac9a4;
        }

        .expense-text {
            color: #dc9292;
        }

        .empty-state {
            text-align: center;
            padding: 35px 10px;
            color: #85858d;
            font-size: 12px;
        }

        .monetra-watermark {
            text-align: right;
            color: #55555d;
            font-size: 9px;
            letter-spacing: 3px;
            margin-top: 30px;
        }

        .dashboard-error {
            padding: 20px;
            border: 1px solid #733e3e;
            background: #2b1c1c;
            color: #e9aaaa;
            border-radius: 10px;
        }

        @media (max-width: 850px) {
            .monetra-sidebar {
                width: 205px;
                min-width: 205px;
            }

            .monetra-main {
                padding: 23px;
            }

            .dashboard-grid {
                grid-template-columns: 1fr;
            }
        }

        @media (max-width: 620px) {
            .monetra-shell {
                display: block;
            }

            .monetra-sidebar {
                width: 100%;
                min-width: 0;
                padding: 15px;
                border-right: 0;
                border-bottom: 1px solid #29292f;
            }

            .monetra-brand {
                padding: 5px 5px 17px;
            }

            .sidebar-label {
                margin: 0 5px 9px;
            }

            .sidebar-navigation {
                display: grid;
                grid-template-columns: repeat(3, minmax(0, 1fr));
                gap: 6px;
            }

            .sidebar-navigation .nav-item {
                justify-content: center;
                padding: 11px 5px;
                font-size: 10px;
                flex-direction: column;
                gap: 5px;
            }

            .nav-icon {
                font-size: 16px;
            }

            .sidebar-bottom {
                margin-top: 12px;
            }

            .sidebar-bottom .sidebar-label {
                display: none;
            }

            .monetra-logout {
                justify-content: center;
                margin-top: 8px;
                padding: 10px;
            }

            .monetra-main {
                padding: 19px 14px;
            }

            .welcome-section {
                align-items: flex-start;
                flex-direction: column;
                gap: 15px;
            }

            .welcome-section h1 {
                font-size: 25px;
            }

            .dashboard-month {
                width: 100%;
            }

            .dashboard-month input {
                width: 100%;
                box-sizing: border-box;
            }

            .summary-grid {
                grid-template-columns: 1fr;
                gap: 10px;
            }

            .summary-card {
                padding: 17px;
            }

            .summary-card h2 {
                font-size: 22px;
            }

            .panel {
                padding: 16px;
            }

            .chart-container {
                gap: 25px;
            }
        }
    `;

    document.head.appendChild(style);
}

/* =====================================
   DASHBOARD HTML
===================================== */

function renderDashboardContent() {
    const content = document.getElementById(
        "monetra-page-content"
    );

    if (!content) return;

    const transactions = getMonthlyTransactions();

    const summary = calculateSummary(transactions);

    const maxValue = Math.max(
        summary.income,
        summary.expense,
        1
    );

    const incomeHeight =
        (summary.income / maxValue) * 100;

    const expenseHeight =
        (summary.expense / maxValue) * 100;

    const recentTransactions = [...transactions]
        .sort((a, b) => {
            return getTransactionDate(b).localeCompare(
                getTransactionDate(a)
            );
        })
        .slice(0, 5);

    content.innerHTML = `
        <section class="welcome-section">
            <div>
                <p class="eyebrow">PERSONAL FINANCE</p>

                <h1>Dashboard</h1>

                <p class="welcome-text">
                    Selamat datang di Monetra,
                    ${escapeHTML(
                        currentUser?.displayName ||
                        currentUser?.email ||
                        "Pengguna"
                    )}.
                </p>
            </div>

            <div class="dashboard-month">
                <label for="dashboard-month">
                    Pilih Bulan
                </label>

                <input
                    type="month"
                    id="dashboard-month"
                    value="${escapeHTML(selectedMonth)}"
                >
            </div>
        </section>

        <section class="summary-grid">

            <article class="summary-card balance-card">
                <span>Total Saldo Bulan Ini</span>

                <h2>${formatRupiah(summary.balance)}</h2>

                <small>
                    ${escapeHTML(getMonthName(selectedMonth))}
                </small>
            </article>

            <article class="summary-card income-card">
                <span>Total Pemasukan</span>

                <h2>${formatRupiah(summary.income)}</h2>

                <small>
                    ${escapeHTML(getMonthName(selectedMonth))}
                </small>
            </article>

            <article class="summary-card expense-card">
                <span>Total Pengeluaran</span>

                <h2>${formatRupiah(summary.expense)}</h2>

                <small>
                    ${escapeHTML(getMonthName(selectedMonth))}
                </small>
            </article>

        </section>

        <section class="dashboard-grid">

            <article class="panel chart-panel">

                <div class="panel-heading">
                    <h3>Ringkasan Keuangan</h3>

                    <p>
                        Perbandingan pemasukan dan pengeluaran
                    </p>
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

                        <span>
                            ${formatRupiah(summary.income)}
                        </span>
                    </div>

                    <div class="chart-column">
                        <div class="chart-bar-wrapper">
                            <div
                                class="chart-bar expense-bar"
                                style="height:${expenseHeight}%"
                            ></div>
                        </div>

                        <strong>Pengeluaran</strong>

                        <span>
                            ${formatRupiah(summary.expense)}
                        </span>
                    </div>

                </div>
            </article>

            <article class="panel">

                <div class="panel-heading">
                    <h3>Transaksi Terbaru</h3>

                    <p>
                        Lima transaksi terakhir pada bulan ini
                    </p>
                </div>

                <div class="recent-list">

                    ${
                        recentTransactions.length
                        ? recentTransactions.map(transaction => {
                            const isIncome =
                                getTransactionType(transaction) === "income";

                            const amount =
                                getTransactionAmount(transaction);

                            return `
                                <div class="recent-item">

                                    <div class="recent-icon">
                                        ${isIncome ? "↙" : "↗"}
                                    </div>

                                    <div class="recent-info">
                                        <strong>
                                            ${escapeHTML(
                                                getTranscolor: #99999f;
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
