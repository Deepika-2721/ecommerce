/**
 * reports.js
 * Admin Analytics & Reports Engine:
 * 1. Customer Reports:
 *    - All columns
 *    - Top 10 Customers (spending) from date to date
 *    - Cash purchase Reports from date to date
 *    - Credit purchase Reports from date to date
 * 2. Inventory Reports:
 *    - Current Stock: All & Category-wise
 *    - High stock (> 100 units), Low stock (< 15 units)
 * 3. Sales Reports:
 *    - From date to date: a) All sales, b) Category-wise, c) Cash-wise, d) Credit-wise
 *    - From date to date: a) Top 10 selling items, b) Bottom 10 selling items
 */

let allOrders = [];
let allReportProducts = [];
let allReportCustomers = [];
let allReportCategories = [];

$(document).ready(function() {
    checkAdminAuth();
    initializeDefaultDates();
    loadAllReportData();

    $('#applyDateFilterBtn').on('click', function() {
        refreshAllReports();
    });

    $('#customerSubReportSelect').on('change', function() {
        renderCustomerReports();
    });

    $('#inventoryCategoryFilter').on('change', function() {
        renderInventoryReports();
    });
});

function checkAdminAuth() {
    const role = localStorage.getItem('userRole');
    if (role !== 'admin') {
        window.location.href = '../login.html';
    }
}

function initializeDefaultDates() {
    const today = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(today.getDate() - 30);

    $('#reportFromDate').val(thirtyDaysAgo.toISOString().split('T')[0]);
    $('#reportToDate').val(today.toISOString().split('T')[0]);
}

function loadAllReportData() {
    Promise.all([
        FirestoreAPI.getDocuments('orders'),
        FirestoreAPI.getDocuments('products'),
        FirestoreAPI.getDocuments('users'),
        FirestoreAPI.getDocuments('categories')
    ]).then(function([ordersRes, prodsRes, usersRes, catsRes]) {
        allOrders = ordersRes.items || [];
        allReportProducts = prodsRes.items || [];
        allReportCustomers = (usersRes.items || []).filter(u => u.role === 'customer' || u.email !== 'admin@shopping.com');
        allReportCategories = catsRes.items || [];

        populateInventoryCatFilter();
        refreshAllReports();
    });
}

function populateInventoryCatFilter() {
    const sel = $('#inventoryCategoryFilter').empty().append('<option value="all">All Categories</option>');
    allReportCategories.forEach(cat => {
        sel.append(`<option value="${cat.id}">${cat.name}</option>`);
    });
}

function getFilteredOrders() {
    const fromStr = $('#reportFromDate').val();
    const toStr = $('#reportToDate').val();

    if (!fromStr || !toStr) return allOrders;

    const fromDate = new Date(fromStr + 'T00:00:00Z');
    const toDate = new Date(toStr + 'T23:59:59Z');

    return allOrders.filter(ord => {
        const orderDate = new Date(ord.createdAt);
        return orderDate >= fromDate && orderDate <= toDate;
    });
}

function refreshAllReports() {
    renderCustomerReports();
    renderInventoryReports();
    renderSalesReports();
}

/* ==========================================================================
   1. Customer Reports
   ========================================================================== */

function renderCustomerReports() {
    const type = $('#customerSubReportSelect').val();
    const filteredOrders = getFilteredOrders();
    const container = $('#customerReportTableContainer').empty();

    if (type === 'all-columns') {
        // All Columns: Customer Master List
        let rows = '';
        allReportCustomers.forEach(cust => {
            const custOrders = filteredOrders.filter(o => o.customerId === (cust.id || cust._id));
            const totalSpent = custOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);

            rows += `
                <tr>
                    <td><strong>${cust.id || cust._id}</strong></td>
                    <td>${cust.name || 'N/A'}</td>
                    <td>${cust.email}</td>
                    <td>${cust.mob || 'N/A'}</td>
                    <td>$${parseFloat(cust.creditLimit || 0).toFixed(2)}</td>
                    <td>$${parseFloat(cust.creditUsed || 0).toFixed(2)}</td>
                    <td>${custOrders.length}</td>
                    <td><strong>$${totalSpent.toFixed(2)}</strong></td>
                </tr>
            `;
        });

        container.html(`
            <table class="table table-hover table-custom mb-0">
                <thead>
                    <tr>
                        <th>ID</th><th>Name</th><th>Email</th><th>Mobile</th>
                        <th>Credit Limit</th><th>Credit Used</th><th>Orders in Range</th><th>Total Spent</th>
                    </tr>
                </thead>
                <tbody>${rows || '<tr><td colspan="8" class="text-center py-3">No customers found.</td></tr>'}</tbody>
            </table>
        `);
    } else if (type === 'top-10') {
        // Top 10 Customers by spending in date range
        const customerSpend = {};
        filteredOrders.forEach(o => {
            const cid = o.customerId;
            if (!customerSpend[cid]) {
                customerSpend[cid] = {
                    id: cid,
                    name: o.customerName || 'Customer',
                    email: o.customerEmail || 'N/A',
                    totalSpent: 0,
                    orderCount: 0
                };
            }
            customerSpend[cid].totalSpent += (o.totalAmount || 0);
            customerSpend[cid].orderCount += 1;
        });

        const sorted = Object.values(customerSpend).sort((a, b) => b.totalSpent - a.totalSpent).slice(0, 10);

        let rows = '';
        sorted.forEach((c, idx) => {
            rows += `
                <tr>
                    <td><span class="badge ${idx < 3 ? 'bg-warning text-dark' : 'bg-secondary'}">#${idx + 1}</span></td>
                    <td><strong>${c.name}</strong></td>
                    <td>${c.email}</td>
                    <td>${c.orderCount}</td>
                    <td><strong class="text-success">$${c.totalSpent.toFixed(2)}</strong></td>
                </tr>
            `;
        });

        container.html(`
            <div class="alert alert-info py-2">Displaying Top 10 Customers based on purchase volume in selected date range.</div>
            <table class="table table-hover table-custom mb-0">
                <thead>
                    <tr><th>Rank</th><th>Customer Name</th><th>Email</th><th>Orders Count</th><th>Total Spent</th></tr>
                </thead>
                <tbody>${rows || '<tr><td colspan="5" class="text-center py-3">No purchase data in this range.</td></tr>'}</tbody>
            </table>
        `);
    } else if (type === 'cash-purchases') {
        // Cash Purchase Reports
        const cashOrders = filteredOrders.filter(o => o.paymentType === 'cash');
        renderOrdersTable(container, cashOrders, 'Cash Purchases');
    } else if (type === 'credit-purchases') {
        // Credit Purchase Reports
        const creditOrders = filteredOrders.filter(o => o.paymentType === 'credit');
        renderOrdersTable(container, creditOrders, 'Credit Limit Purchases');
    }
}

function renderOrdersTable(container, orders, title) {
    let rows = '';
    let grandTotal = 0;

    orders.forEach(o => {
        grandTotal += (o.totalAmount || 0);
        rows += `
            <tr>
                <td><strong>${o.orderId}</strong></td>
                <td>${new Date(o.createdAt).toLocaleDateString()}</td>
                <td>${o.customerName}<br><small class="text-muted">${o.customerEmail}</small></td>
                <td>${(o.items || []).length} items</td>
                <td><span class="badge ${o.paymentType === 'cash' ? 'bg-success' : 'bg-primary'}">${o.paymentType.toUpperCase()}</span></td>
                <td><strong>$${(o.totalAmount || 0).toFixed(2)}</strong></td>
            </tr>
        `;
    });

    container.html(`
        <div class="d-flex justify-content-between align-items-center mb-2">
            <h6 class="mb-0 text-primary">${title} (${orders.length} orders)</h6>
            <span class="fs-6 fw-bold">Total: $${grandTotal.toFixed(2)}</span>
        </div>
        <table class="table table-hover table-custom mb-0">
            <thead>
                <tr><th>Order ID</th><th>Date</th><th>Customer</th><th>Items</th><th>Payment</th><th>Total Amount</th></tr>
            </thead>
            <tbody>${rows || '<tr><td colspan="6" class="text-center py-3">No orders found for this criteria.</td></tr>'}</tbody>
        </table>
    `);
}

/* ==========================================================================
   2. Inventory Reports
   ========================================================================== */

function renderInventoryReports() {
    const catFilter = $('#inventoryCategoryFilter').val();
    let prods = allReportProducts;

    if (catFilter && catFilter !== 'all') {
        prods = prods.filter(p => p.cat_id === catFilter);
    }

    const highStockProds = prods.filter(p => p.qty > 100);
    const lowStockProds = prods.filter(p => p.qty < 15);

    $('#highStockCount').text(highStockProds.length);
    $('#lowStockCount').text(lowStockProds.length);
    $('#totalStockUnits').text(prods.reduce((sum, p) => sum + p.qty, 0));

    let rows = '';
    prods.forEach(p => {
        const catObj = allReportCategories.find(c => c.id === p.cat_id);
        const catName = catObj ? catObj.name : p.cat_id;

        let statusBadge = '<span class="badge badge-normal-stock">Normal</span>';
        if (p.qty > 100) {
            statusBadge = '<span class="badge badge-high-stock text-success border border-success">High Stock (&gt;100)</span>';
        } else if (p.qty < 15) {
            statusBadge = '<span class="badge badge-low-stock text-danger border border-danger">Low Stock (&lt;15)</span>';
        }

        rows += `
            <tr>
                <td><strong>${p.id}</strong></td>
                <td>${p.title}</td>
                <td><span class="badge bg-light text-dark border">${catName}</span></td>
                <td><strong>${p.qty} units</strong></td>
                <td>$${parseFloat(p.price).toFixed(2)}</td>
                <td>$${(p.qty * p.price).toFixed(2)}</td>
                <td>${statusBadge}</td>
            </tr>
        `;
    });

    $('#inventoryReportTableBody').html(rows || '<tr><td colspan="7" class="text-center py-3">No inventory items.</td></tr>');
}

/* ==========================================================================
   3. Sales Reports
   ========================================================================== */

function renderSalesReports() {
    const filteredOrders = getFilteredOrders();

    // a) All Sales
    const totalSalesRevenue = filteredOrders.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const totalOrdersCount = filteredOrders.length;

    // c) Cash wise, d) Credit wise
    const cashSales = filteredOrders.filter(o => o.paymentType === 'cash').reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    const creditSales = filteredOrders.filter(o => o.paymentType === 'credit').reduce((sum, o) => sum + (o.totalAmount || 0), 0);

    $('#salesTotalRev').text(`$${totalSalesRevenue.toFixed(2)}`);
    $('#salesTotalOrders').text(totalOrdersCount);
    $('#salesCashRev').text(`$${cashSales.toFixed(2)}`);
    $('#salesCreditRev').text(`$${creditSales.toFixed(2)}`);

    // b) Category wise Sales
    const catSales = {};
    const itemSales = {};

    // Initialize all products with 0 sold
    allReportProducts.forEach(p => {
        itemSales[p.id] = { id: p.id, title: p.title, qtySold: 0, revenue: 0 };
    });

    filteredOrders.forEach(o => {
        (o.items || []).forEach(item => {
            // Category aggregation
            const catId = item.cat_id || 'Other';
            if (!catSales[catId]) catSales[catId] = { totalRevenue: 0, totalUnits: 0 };
            catSales[catId].totalRevenue += (item.price * item.selectedQty);
            catSales[catId].totalUnits += item.selectedQty;

            // Product aggregation
            if (!itemSales[item.id]) {
                itemSales[item.id] = { id: item.id, title: item.title, qtySold: 0, revenue: 0 };
            }
            itemSales[item.id].qtySold += item.selectedQty;
            itemSales[item.id].revenue += (item.price * item.selectedQty);
        });
    });

    // Render Category-wise table
    let catRows = '';
    Object.entries(catSales).forEach(([catId, data]) => {
        const catObj = allReportCategories.find(c => c.id === catId);
        const catName = catObj ? catObj.name : catId;
        catRows += `
            <tr>
                <td><strong>${catName}</strong></td>
                <td>${data.totalUnits} units</td>
                <td><strong>$${data.totalRevenue.toFixed(2)}</strong></td>
            </tr>
        `;
    });
    $('#categorySalesTableBody').html(catRows || '<tr><td colspan="3" class="text-center py-3">No sales in this date range.</td></tr>');

    // Top 10 & Bottom 10 Selling Items
    const sortedItems = Object.values(itemSales).sort((a, b) => b.qtySold - a.qtySold);

    const top10 = sortedItems.slice(0, 10);
    let topRows = '';
    top10.forEach((item, idx) => {
        topRows += `
            <tr>
                <td><span class="badge bg-success">#${idx + 1}</span></td>
                <td><strong>${item.title}</strong></td>
                <td>${item.qtySold} units</td>
                <td>$${item.revenue.toFixed(2)}</td>
            </tr>
        `;
    });
    $('#topSellingTableBody').html(topRows || '<tr><td colspan="4" class="text-center py-2">No data.</td></tr>');

    const bottom10 = [...sortedItems].reverse().slice(0, 10);
    let bottomRows = '';
    bottom10.forEach((item, idx) => {
        bottomRows += `
            <tr>
                <td><span class="badge bg-secondary">#${idx + 1}</span></td>
                <td><strong>${item.title}</strong></td>
                <td>${item.qtySold} units</td>
                <td>$${item.revenue.toFixed(2)}</td>
            </tr>
        `;
    });
    $('#bottomSellingTableBody').html(bottomRows || '<tr><td colspan="4" class="text-center py-2">No data.</td></tr>');
}
