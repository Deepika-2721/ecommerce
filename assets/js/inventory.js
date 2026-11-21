/**
 * inventory.js
 * Admin Inventory CRUD:
 * - Create: Id, Cat_id, title, des, qty, price
 * - Pagination: Read All | Select by Category | Select Individual Item
 * - Update: Except ID, all row fields editable
 * - Delete: Deactivate/Activate | Delete -> Confirm? Yes/No -> Delete
 */

let allProducts = [];
let allCategories = [];
let currentPage = 1;
const PAGE_SIZE = 5;
let productToDeleteDocId = null;

$(document).ready(function() {
    checkAdminAuth();
    loadCategories();
    loadInventory();

    // Search and filter triggers
    $('#categoryFilter, #searchInput').on('change keyup', function() {
        currentPage = 1;
        applyFiltersAndRender();
    });

    // Add Product Modal Submit
    $('#addProductForm').on('submit', function(e) {
        e.preventDefault();
        saveNewProduct();
    });

    // Edit Product Modal Submit
    $('#editProductForm').on('submit', function(e) {
        e.preventDefault();
        saveUpdatedProduct();
    });

    // Confirm Hard Delete Button
    $('#confirmDeleteBtn').on('click', function() {
        if (productToDeleteDocId) {
            executeDeleteProduct(productToDeleteDocId);
        }
    });
});

function checkAdminAuth() {
    const role = localStorage.getItem('userRole');
    if (role !== 'admin') {
        alert('Access denied: Admin credentials required.');
        window.location.href = '../login.html';
    }
}

function loadCategories() {
    FirestoreAPI.getDocuments('categories').then(function(res) {
        allCategories = res.items || [];
        populateCategoryDropdowns();
    });
}

function populateCategoryDropdowns() {
    const filterSelect = $('#categoryFilter').empty().append('<option value="all">All Categories</option>');
    const addSelect = $('#addCatId').empty().append('<option value="">Select Category</option>');
    const editSelect = $('#editCatId').empty().append('<option value="">Select Category</option>');

    allCategories.forEach(cat => {
        filterSelect.append(`<option value="${cat.id}">${cat.name}</option>`);
        addSelect.append(`<option value="${cat.id}">${cat.name}</option>`);
        editSelect.append(`<option value="${cat.id}">${cat.name}</option>`);
    });
}

function loadInventory() {
    $('#inventoryTableBody').html('<tr><td colspan="8" class="text-center py-4"><div class="spinner-border text-primary"></div></td></tr>');

    FirestoreAPI.getDocuments('products').then(function(res) {
        allProducts = res.items || [];
        applyFiltersAndRender();
    });
}

function applyFiltersAndRender() {
    const cat = $('#categoryFilter').val();
    const query = $('#searchInput').val().toLowerCase().trim();

    let filtered = allProducts;

    // Filter by Category
    if (cat && cat !== 'all') {
        filtered = filtered.filter(p => p.cat_id === cat);
    }

    // Filter by search query (Title, Description, or specific ID)
    if (query) {
        filtered = filtered.filter(p =>
            (p.title && p.title.toLowerCase().includes(query)) ||
            (p.id && p.id.toLowerCase().includes(query)) ||
            (p.des && p.des.toLowerCase().includes(query))
        );
    }

    renderPaginatedTable(filtered);
}

function renderPaginatedTable(items) {
    const totalItems = items.length;
    const totalPages = Math.ceil(totalItems / PAGE_SIZE) || 1;
    if (currentPage > totalPages) currentPage = totalPages;

    const startIndex = (currentPage - 1) * PAGE_SIZE;
    const pageItems = items.slice(startIndex, startIndex + PAGE_SIZE);

    const tbody = $('#inventoryTableBody').empty();

    if (pageItems.length === 0) {
        tbody.html('<tr><td colspan="8" class="text-center py-4 text-muted">No inventory items found.</td></tr>');
        $('#paginationContainer').addClass('d-none');
        return;
    }

    $('#paginationContainer').removeClass('d-none');

    pageItems.forEach(item => {
        const catObj = allCategories.find(c => c.id === item.cat_id);
        const catName = catObj ? catObj.name : item.cat_id;
        const isActive = item.status === 'active';

        // Stock Badge
        let stockBadge = `<span class="badge bg-secondary">${item.qty} units</span>`;
        if (item.qty > 100) {
            stockBadge = `<span class="badge badge-high-stock text-success border border-success">${item.qty} (High)</span>`;
        } else if (item.qty < 15) {
            stockBadge = `<span class="badge badge-low-stock text-danger border border-danger">${item.qty} (Low)</span>`;
        }

        tbody.append(`
            <tr class="${isActive ? '' : 'table-light text-muted'}">
                <td><strong>${item.id}</strong></td>
                <td><span class="badge bg-light text-dark border">${catName}</span></td>
                <td>${item.title}</td>
                <td class="text-truncate" style="max-width: 200px;" title="${item.des}">${item.des}</td>
                <td>${stockBadge}</td>
                <td>$${parseFloat(item.price).toFixed(2)}</td>
                <td>
                    <span class="badge ${isActive ? 'bg-success' : 'bg-warning text-dark'}">
                        ${isActive ? 'Active' : 'Deactivated'}
                    </span>
                </td>
                <td>
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary" onclick="openEditModal('${item.id}')" title="Edit Item">
                            <i class="bi bi-pencil"></i> Edit
                        </button>
                        <button class="btn btn-outline-${isActive ? 'warning' : 'success'}" onclick="toggleActiveStatus('${item.id}', '${item.status}')" title="${isActive ? 'Deactivate' : 'Activate'}">
                            ${isActive ? 'Deactivate' : 'Activate'}
                        </button>
                        <button class="btn btn-outline-danger" onclick="promptDelete('${item.id}')" title="Delete">
                            <i class="bi bi-trash"></i> Delete
                        </button>
                    </div>
                </td>
            </tr>
        `);
    });

    renderPaginationControls(totalPages);
}

function renderPaginationControls(totalPages) {
    const container = $('#paginationNav').empty();

    container.append(`
        <li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
            <button class="page-link" onclick="changePage(${currentPage - 1})">Previous</button>
        </li>
    `);

    for (let i = 1; i <= totalPages; i++) {
        container.append(`
            <li class="page-item ${currentPage === i ? 'active' : ''}">
                <button class="page-link" onclick="changePage(${i})">${i}</button>
            </li>
        `);
    }

    container.append(`
        <li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
            <button class="page-link" onclick="changePage(${currentPage + 1})">Next</button>
        </li>
    `);

    $('#pageInfoText').text(`Showing page ${currentPage} of ${totalPages}`);
}

function changePage(page) {
    currentPage = page;
    applyFiltersAndRender();
}

function saveNewProduct() {
    const id = $('#addId').val().trim();
    const cat_id = $('#addCatId').val();
    const title = $('#addTitle').val().trim();
    const des = $('#addDes').val().trim();
    const qty = parseInt($('#addQty').val(), 10);
    const price = parseFloat($('#addPrice').val());

    if (!id || !cat_id || !title || !des || isNaN(qty) || isNaN(price)) {
        alert('Please fill all product fields correctly.');
        return;
    }

    // Check unique ID
    if (allProducts.some(p => p.id === id)) {
        alert('A product with this ID already exists!');
        return;
    }

    const newProd = {
        id: id,
        cat_id: cat_id,
        title: title,
        des: des,
        qty: qty,
        price: price,
        status: 'active',
        createdAt: new Date().toISOString()
    };

    FirestoreAPI.createDocumentWithId('products', id, newProd).then(function() {
        $('#addProductModal').modal('hide');
        $('#addProductForm')[0].reset();
        loadInventory();
    });
}

function openEditModal(prodId) {
    const prod = allProducts.find(p => p.id === prodId);
    if (!prod) return;

    // ID is locked and cannot be updated as per specifications
    $('#editId').val(prod.id);
    $('#editCatId').val(prod.cat_id);
    $('#editTitle').val(prod.title);
    $('#editDes').val(prod.des);
    $('#editQty').val(prod.qty);
    $('#editPrice').val(prod.price);

    $('#editProductModal').modal('show');
}

function saveUpdatedProduct() {
    const id = $('#editId').val(); // ID remains unchanged
    const cat_id = $('#editCatId').val();
    const title = $('#editTitle').val().trim();
    const des = $('#editDes').val().trim();
    const qty = parseInt($('#editQty').val(), 10);
    const price = parseFloat($('#editPrice').val());

    const updateFields = {
        cat_id: cat_id,
        title: title,
        des: des,
        qty: qty,
        price: price
    };

    FirestoreAPI.updateDocument('products', id, updateFields).then(function() {
        $('#editProductModal').modal('hide');
        loadInventory();
    });
}

function toggleActiveStatus(prodId, currentStatus) {
    const newStatus = currentStatus === 'active' ? 'inactive' : 'active';
    FirestoreAPI.updateDocument('products', prodId, { status: newStatus }).then(function() {
        loadInventory();
    });
}

function promptDelete(prodId) {
    productToDeleteDocId = prodId;
    $('#deleteModalText').text(`Are you sure you want to permanently delete product ID "${prodId}"?`);
    $('#deleteConfirmModal').modal('show');
}

function executeDeleteProduct(prodId) {
    FirestoreAPI.deleteDocument('products', prodId).then(function() {
        $('#deleteConfirmModal').modal('hide');
        productToDeleteDocId = null;
        loadInventory();
    });
}
