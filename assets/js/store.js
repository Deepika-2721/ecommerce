/**
 * store.js
 * Customer Storefront:
 * - Search: All, category dropdown, specific title / query
 * - In-memory pagination
 * - Add product to cart with chosen quantity
 * - Stock quantity enforcement
 */

let catalogProducts = [];
let catalogCategories = [];
let currentStorePage = 1;
const STORE_PAGE_SIZE = 6;

$(document).ready(function() {
    updateCartCountBadge();
    loadCatalogCategories();
    loadStoreCatalog();

    $('#storeCategoryFilter, #storeSearchInput, #storeSortBy').on('change keyup', function() {
        currentStorePage = 1;
        applyStoreFilters();
    });
});

function loadCatalogCategories() {
    FirestoreAPI.getDocuments('categories').then(function(res) {
        catalogCategories = res.items || [];
        const select = $('#storeCategoryFilter').empty().append('<option value="all">All Categories</option>');
        catalogCategories.forEach(cat => {
            select.append(`<option value="${cat.id}">${cat.name}</option>`);
        });
    });
}

function loadStoreCatalog() {
    $('#catalogContainer').html('<div class="col-12 text-center py-5"><div class="spinner-border text-primary"></div><p class="mt-2">Loading products...</p></div>');

    FirestoreAPI.getDocuments('products').then(function(res) {
        // Only active products are visible to customers
        catalogProducts = (res.items || []).filter(p => p.status === 'active');
        applyStoreFilters();
    });
}

function applyStoreFilters() {
    const cat = $('#storeCategoryFilter').val();
    const query = $('#storeSearchInput').val().toLowerCase().trim();
    const sort = $('#storeSortBy').val();

    let filtered = catalogProducts;

    // Filter by Category
    if (cat && cat !== 'all') {
        filtered = filtered.filter(p => p.cat_id === cat);
    }

    // Filter by search query (title, description, ID)
    if (query) {
        filtered = filtered.filter(p =>
            (p.title && p.title.toLowerCase().includes(query)) ||
            (p.des && p.des.toLowerCase().includes(query)) ||
            (p.id && p.id.toLowerCase().includes(query))
        );
    }

    // Sort
    if (sort === 'price-low') {
        filtered.sort((a, b) => a.price - b.price);
    } else if (sort === 'price-high') {
        filtered.sort((a, b) => b.price - a.price);
    } else if (sort === 'title') {
        filtered.sort((a, b) => a.title.localeCompare(b.title));
    }

    renderStoreCatalog(filtered);
}

function renderStoreCatalog(items) {
    const container = $('#catalogContainer').empty();
    const totalItems = items.length;
    const totalPages = Math.ceil(totalItems / STORE_PAGE_SIZE) || 1;

    if (currentStorePage > totalPages) currentStorePage = totalPages;

    const start = (currentStorePage - 1) * STORE_PAGE_SIZE;
    const pageItems = items.slice(start, start + STORE_PAGE_SIZE);

    if (pageItems.length === 0) {
        container.html(`
            <div class="col-12 text-center py-5">
                <i class="bi bi-box-seam display-4 text-muted"></i>
                <h5 class="mt-3 text-secondary">No products found matching your search.</h5>
            </div>
        `);
        $('#storePaginationNav').empty();
        return;
    }

    pageItems.forEach(prod => {
        const catObj = catalogCategories.find(c => c.id === prod.cat_id);
        const catName = catObj ? catObj.name : 'General';
        const inStock = prod.qty > 0;

        container.append(`
            <div class="col-md-4 col-sm-6 mb-4">
                <div class="product-card">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-center mb-2">
                            <span class="badge bg-light text-secondary border">${catName}</span>
                            <span class="stock-tag ${inStock ? (prod.qty < 15 ? 'badge-low-stock' : 'badge-high-stock') : 'badge-low-stock'}">
                                ${inStock ? `${prod.qty} in stock` : 'Out of Stock'}
                            </span>
                        </div>
                        <h5 class="card-title">${prod.title}</h5>
                        <p class="card-text text-muted small flex-grow-1">${prod.des}</p>
                        <div class="d-flex justify-content-between align-items-center mt-3">
                            <span class="product-price">$${parseFloat(prod.price).toFixed(2)}</span>
                            <div class="input-group" style="max-width: 130px;">
                                <input type="number" id="qty-${prod.id}" class="form-control form-control-sm text-center" value="1" min="1" max="${prod.qty}" ${!inStock ? 'disabled' : ''}>
                                <button class="btn btn-primary btn-sm" onclick="addToCart('${prod.id}')" ${!inStock ? 'disabled' : ''}>
                                    <i class="bi bi-cart-plus"></i> Add
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `);
    });

    renderStorePagination(totalPages);
}

function renderStorePagination(totalPages) {
    const nav = $('#storePaginationNav').empty();

    nav.append(`
        <li class="page-item ${currentStorePage === 1 ? 'disabled' : ''}">
            <button class="page-link" onclick="changeStorePage(${currentStorePage - 1})">Previous</button>
        </li>
    `);

    for (let i = 1; i <= totalPages; i++) {
        nav.append(`
            <li class="page-item ${currentStorePage === i ? 'active' : ''}">
                <button class="page-link" onclick="changeStorePage(${i})">${i}</button>
            </li>
        `);
    }

    nav.append(`
        <li class="page-item ${currentStorePage === totalPages ? 'disabled' : ''}">
            <button class="page-link" onclick="changeStorePage(${currentStorePage + 1})">Next</button>
        </li>
    `);
}

function changeStorePage(page) {
    currentStorePage = page;
    applyStoreFilters();
}

function addToCart(prodId) {
    const prod = catalogProducts.find(p => p.id === prodId);
    if (!prod) return;

    const requestedQty = parseInt($(`#qty-${prodId}`).val(), 10) || 1;

    if (requestedQty <= 0) {
        alert('Quantity must be at least 1.');
        return;
    }

    if (requestedQty > prod.qty) {
        alert(`Cannot add ${requestedQty} units. Only ${prod.qty} available in stock.`);
        return;
    }

    let cart = JSON.parse(localStorage.getItem('shopping_cart') || '[]');
    const existingIndex = cart.findIndex(item => item.id === prod.id);

    if (existingIndex >= 0) {
        const totalRequested = cart[existingIndex].selectedQty + requestedQty;
        if (totalRequested > prod.qty) {
            alert(`You already have ${cart[existingIndex].selectedQty} in your cart. Only ${prod.qty} total units in stock.`);
            return;
        }
        cart[existingIndex].selectedQty = totalRequested;
    } else {
        cart.push({
            id: prod.id,
            cat_id: prod.cat_id,
            title: prod.title,
            price: parseFloat(prod.price),
            selectedQty: requestedQty,
            maxQty: prod.qty
        });
    }

    localStorage.setItem('shopping_cart', JSON.stringify(cart));
    updateCartCountBadge();

    // Visual notification
    const btn = $(`#qty-${prodId}`).next('button');
    const originalText = btn.html();
    btn.removeClass('btn-primary').addClass('btn-success').html('<i class="bi bi-check"></i> Added');
    setTimeout(() => {
        btn.removeClass('btn-success').addClass('btn-primary').html(originalText);
    }, 1200);
}

function updateCartCountBadge() {
    const cart = JSON.parse(localStorage.getItem('shopping_cart') || '[]');
    const totalItems = cart.reduce((sum, item) => sum + item.selectedQty, 0);
    $('#cartBadge').text(totalItems);
}
