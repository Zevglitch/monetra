
const pages = [
    {
        id: "dashboard",
        name: "Dashboard",
        icon: "◈"
    },
    {
        id: "transactions",
        name: "Transaksi",
        icon: "↕"
    },
    {
        id: "budgets",
        name: "Anggaran",
        icon: "▤"
    },
    {
        id: "reports",
        name: "Laporan",
        icon: "▥"
    },
    {
        id: "categories",
        name: "Kategori",
        icon: "▦"
    }
];

let currentPage = "dashboard";

export function getPages() {
    return [...pages];
}

export function getCurrentPage() {
    return currentPage;
}

export function navigateTo(pageId) {
    const pageExists = pages.some(page => page.id === pageId);

    if (!pageExists) {
        console.warn("Halaman tidak ditemukan:", pageId);
        return false;
    }

    currentPage = pageId;

    window.dispatchEvent(
        new CustomEvent("monetra:navigate", {
            detail: {
                page: currentPage
            }
        })
    );

    return true;
}

export function createNavigationHTML(activePage = currentPage) {
    return `
        <nav class="sidebar-navigation">
            ${pages.map(page => `
                <button
                    type="button"
                    class="nav-item ${page.id === activePage ? "active" : ""}"
                    data-page="${page.id}"
                >
                    <span class="nav-icon">${page.icon}</span>
                    <span class="nav-label">${page.name}</span>
                </button>
            `).join("")}
        </nav>
    `;
}

export function setupNavigation(container, onNavigate) {
    if (!container) return;

    container.addEventListener("click", event => {
        const button = event.target.closest("[data-page]");

        if (!button) return;

        const pageId = button.dataset.page;

        if (navigateTo(pageId)) {
            if (typeof onNavigate === "function") {
                onNavigate(pageId);
            }
        }
    });
}

console.log("Monetra Navigation System berhasil dimuat.");
