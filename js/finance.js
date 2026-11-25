
/* =====================================
   MONETRA
   FINANCE MANAGEMENT
===================================== */

import { getTransactions } from "./transactions.js";


/* =====================================
   FORMAT RUPIAH
===================================== */

export function formatRupiah(amount) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(Number(amount) || 0);
}


/* =====================================
   NORMALIZE TRANSACTION DATA
===================================== */

function normalizeTransactions(transactions) {
    return Array.isArray(transactions) ? transactions : [];
}


/* =====================================
   CALCULATE INCOME
===================================== */

export function calculateIncome(transactions) {
    return normalizeTransactions(transactions)
        .filter(item => item.type === "income")
        .reduce(
            (total, item) => total + (Number(item.amount) || 0),
            0
        );
}


/* =====================================
   CALCULATE EXPENSE
===================================== */

export function calculateExpense(transactions) {
    return normalizeTransactions(transactions)
        .filter(item => item.type !== "income")
        .reduce(
            (total, item) => total + (Number(item.amount) || 0),
            0
        );
}


/* =====================================
   CALCULATE BALANCE
===================================== */

export function calculateBalance(transactions) {
    return calculateIncome(transactions) -
        calculateExpense(transactions);
}


/* =====================================
   MONTHLY FINANCIAL SUMMARY
===================================== */

export function calculateMonthlySummary(transactions) {
    const data = normalizeTransactions(transactions);

    const income = calculateIncome(data);
    const expense = calculateExpense(data);

    return {
        income,
        expense,
        balance: income - expense,
        transactionCount: data.length
    };
}


/* =====================================
   CATEGORY SUMMARY
===================================== */

export function calculateCategorySummary(transactions) {
    const categories = {};

    normalizeTransactions(transactions).forEach(item => {
        const category = String(item.category || "Lainnya");

        if (!Object.prototype.hasOwnProperty.call(categories, category)) {
            categories[category] = {
                income: 0,
                expense: 0
            };
        }

        const amount = Number(item.amount) || 0;

        if (item.type === "income") {
            categories[category].income += amount;
        } else {
            categories[category].expense += amount;
        }
    });

    return categories;
}


/* =====================================
   GET MONTHLY SUMMARY
===================================== */

export async function getMonthlySummary(uid, year, month) {
    try {
        if (!uid) {
            throw new Error("Pengguna belum login.");
        }

        const yearNumber = Number(year);
        const monthNumber = Number(month);

        if (
            !Number.isInteger(yearNumber) ||
            yearNumber < 1900 ||
            yearNumber > 9999 ||
            !Number.isInteger(monthNumber) ||
            monthNumber < 1 ||
            monthNumber > 12
        ) {
            throw new Error("Tahun atau bulan tidak valid.");
        }

        const transactions = await getTransactions(uid);

        const monthKey = String(monthNumber).padStart(2, "0");

        const monthlyTransactions = transactions.filter(item =>
            String(item.date || "").startsWith(
                `${yearNumber}-${monthKey}`
            )
        );

        return {
            success: true,
            data: {
                ...calculateMonthlySummary(monthlyTransactions),
                transactions: monthlyTransactions,
                categories: calculateCategorySummary(monthlyTransactions)
            }
        };

    } catch (error) {
        console.error("Monetra Monthly Summary Error:", error);

        return {
            success: false,
            message: error.message || "Gagal mengambil ringkasan bulanan.",
            data: null
        };
    }
}


/* =====================================
   GET YEARLY SUMMARY
===================================== */

export async function getYearlySummary(uid, year) {
    try {
        if (!uid) {
            throw new Error("Pengguna belum login.");
        }

        const yearNumber = Number(year);

        if (
            !Number.isInteger(yearNumber) ||
            yearNumber < 1900 ||
            yearNumber > 9999
        ) {
            throw new Error("Tahun tidak valid.");
        }

        const transactions = await getTransactions(uid);

        const yearlyTransactions = transactions.filter(item =>
            String(item.date || "").startsWith(`${yearNumber}-`)
        );

        const monthlyData = {};

        for (let month = 1; month <= 12; month++) {
            const monthKey = String(month).padStart(2, "0");

            const monthlyTransactions = yearlyTransactions.filter(item =>
                String(item.date || "").startsWith(
                    `${yearNumber}-${monthKey}`
                )
            );

            monthlyData[monthKey] = calculateMonthlySummary(
                monthlyTransactions
            );
        }

        return {
            success: true,
            data: {
                ...calculateMonthlySummary(yearlyTransactions),
                months: monthlyData,
                transactions: yearlyTransactions
            }
        };

    } catch (error) {
        console.error("Monetra Yearly Summary Error:", error);

        return {
            success: false,
            message: error.message || "Gagal mengambil ringkasan tahunan.",
            data: null
        };
    }
}


/* =====================================
   EXPENSE PERCENTAGE
===================================== */

export function calculateExpensePercentage(transactions) {
    const income = calculateIncome(transactions);
    const expense = calculateExpense(transactions);

    if (income <= 0) {
        return 0;
    }

    return Math.round((expense / income) * 100);
}


/* =====================================
   FINANCE SYSTEM STATUS
===================================== */

console.log("Monetra Finance System berhasil dimuat.");
