
import { getTransactions } from "./transactions.js";

// Format angka menjadi Rupiah
export function formatRupiah(amount) {
    return new Intl.NumberFormat("id-ID", {
        style: "currency",
        currency: "IDR",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
    }).format(Number(amount) || 0);
}

// Menghitung total pemasukan
export function calculateIncome(transactions) {
    return transactions
        .filter(item => item.type === "income")
        .reduce((total, item) => total + Number(item.amount || 0), 0);
}

// Menghitung total pengeluaran
export function calculateExpense(transactions) {
    return transactions
        .filter(item => item.type === "expense")
        .reduce((total, item) => total + Number(item.amount || 0), 0);
}

// Menghitung saldo berdasarkan transaksi
export function calculateBalance(transactions) {
    return calculateIncome(transactions) - calculateExpense(transactions);
}

// Menghitung ringkasan keuangan bulanan
export function calculateMonthlySummary(transactions) {
    const income = calculateIncome(transactions);
    const expense = calculateExpense(transactions);

    return {
        income,
        expense,
        balance: income - expense,
        transactionCount: transactions.length
    };
}

// Menghitung ringkasan berdasarkan kategori
export function calculateCategorySummary(transactions) {
    const categories = {};

    transactions.forEach(item => {
        const category = item.category || "Lainnya";

        if (!categories[category]) {
            categories[category] = {
                income: 0,
                expense: 0
            };
        }

        if (item.type === "income") {
            categories[category].income += Number(item.amount || 0);
        }

        if (item.type === "expense") {
            categories[category].expense += Number(item.amount || 0);
        }
    });

    return categories;
}

// Mengambil dan menghitung data bulan tertentu
export async function getMonthlySummary(uid, year, month) {
    const result = await getTransactions(uid);

    if (!result.success) {
        return {
            success: false,
            message: result.message,
            data: null
        };
    }

    const monthNumber = String(month).padStart(2, "0");

    const monthlyTransactions = result.data.filter(item => {
        if (!item.date) return false;

        return item.date.startsWith(`${year}-${monthNumber}`);
    });

    return {
        success: true,
        data: {
            ...calculateMonthlySummary(monthlyTransactions),
            transactions: monthlyTransactions,
            categories: calculateCategorySummary(monthlyTransactions)
        }
    };
}

// Mengambil ringkasan tahunan
export async function getYearlySummary(uid, year) {
    const result = await getTransactions(uid);

    if (!result.success) {
        return {
            success: false,
            message: result.message,
            data: null
        };
    }

    const yearlyTransactions = result.data.filter(item =>
        item.date && item.date.startsWith(`${year}-`)
    );

    const monthlyData = {};

    for (let month = 1; month <= 12; month++) {
        const monthKey = String(month).padStart(2, "0");

        const monthlyTransactions = yearlyTransactions.filter(item =>
            item.date.startsWith(`${year}-${monthKey}`)
        );

        monthlyData[monthKey] = calculateMonthlySummary(
            monthlyTransactions
        );
    }

    return {
        success: true,
        data: {
            ...calculateMonthlySummary(yearlyTransactions),
            months: monthlyData
        }
    };
}

// Menghitung persentase pengeluaran
export function calculateExpensePercentage(transactions) {
    const income = calculateIncome(transactions);
    const expense = calculateExpense(transactions);

    if (income <= 0) return 0;

    return Math.round((expense / income) * 100);
}

console.log("Monetra Finance System berhasil dimuat.");
