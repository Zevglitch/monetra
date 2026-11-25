
/* =====================================
   MONETRA
   NAVIGATION SYSTEM
===================================== */

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

/* =====================================
   GET NAVIGATION DATA
===================================== */

export function getPages() {
    return [...pages];
}

export function getCurrentPage() {
    return currentPage;
}

/* =====================================
   NAVIGATE TO PAGE
===================================== */

export function navigateTo(pageId) {
    const pageExists = pages.some(
        page => page.id === pageId
    );

    if (!pageExists) {
        console.warn(
            "Monetra: Halaman tidak ditemukan:",
            pageId
        );

        return false;
    }

    if (currentPage === pageId) {
        return true;
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

/* =====================================
   CREATE NAVIGATION HTML
===================================== */

export function createNavigationHTML(
    activePage = currentPage
) {
    return `
        <nav class="sidebar-navigation">

            ${pages.map(page => `
                <button
                    type="button"
                    class="nav-item ${
                        page.id === activePage ? "active" : ""
                    }"
                    data-page="${page.id}"
                    aria-label="${page.name}"
                    aria-current="${
                        page.id === activePage ? "page" : "false"
                    }"
                >
                    <span class="nav-icon">
                        ${page.icon}
                    </span>

                    <span class="nav-label">
                        ${page.name}
                    </span>
                </button>
            `).join("")}

        </nav>
    `;
}

/* =====================================
   UPDATE ACTIVE NAVIGATION
===================================== */

export function updateActiveNavigation(
    container,
    activePage = currentPage
) {
    if (!container) return;

    const buttons = container.querySelectorAll(
        "[data-page]"
    );

    buttons.forEach(button => {
        const isActive =
            button.dataset.page === activePage;

        button.classList.toggle(
            "active",
            isActive
        );

        button.setAttribute(
            "aria-current",
            isActive ? "page" : "false"
        );
    });
}

/* =====================================
   SETUP NAVIGATION EVENTS
===================================== */

export function setupNavigation(
    container,
    onNavigate
) {
    if (!container) {
        console.warn(
            "Monetra: Navigation container tidak ditemukan."
        );

        return;
    }

    // Mencegah event listener terpasang berulang.
    container.onclick = event => {
        const button = event.target.closest(
            "[data-page]"
        );

        if (!button || !container.contains(button)) {
            return;
        }

        const pageId = button.dataset.page;

        const success = navigateTo(pageId);

        if (!success) return;

        updateActiveNavigation(
            container,
            pageId
        );

        if (typeof onNavigate === "function") {
            onNavigate(pageId);
        }
    };
}

/* =====================================
   NAVIGATION EVENT LISTENER
===================================== */

export function onPageChange(callback) {
    if (typeof callback !== "function") {
        return;
    }

    window.addEventListener(
        "monetra:navigate",
        event => {
            callback(event.detail.page);
        }
    );
}

/* =====================================
   INITIALIZATION
===================================== */

console.log(
    "Monetra Navigation System berhasil dimuat."
);
