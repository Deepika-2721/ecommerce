/**
 * customers.js
 * Admin Management of Customer Accounts and Credit Limits
 * - Lists all customer accounts
 * - Allows Admin to update Customer Credit Limit (Default: 0)
 */

let allCustomers = [];

$(document).ready(function() {
    checkAdminAuth();
    loadCustomers();

    $('#customerSearch').on('keyup', function() {
        renderCustomerTable();
    });

    $('#saveCreditLimitBtn').on('click', function() {
        saveCustomerCreditLimit();
    });
});

function checkAdminAuth() {
    const role = localStorage.getItem('userRole');
    if (role !== 'admin') {
        window.location.href = '../login.html';
    }
}

function loadCustomers() {
    $('#customerTableBody').html('<tr><td colspan="7" class="text-center py-4"><div class="spinner-border text-primary"></div></td></tr>');

    FirestoreAPI.getDocuments('users').then(function(res) {
        const users = res.items || [];
        // Filter out admin, only show customers
        allCustomers = users.filter(u => u.role === 'customer' || u.email !== 'admin@shopping.com');
        renderCustomerTable();
    });
}

function renderCustomerTable() {
    const query = $('#customerSearch').val().toLowerCase().trim();
    let filtered = allCustomers;

    if (query) {
        filtered = filtered.filter(c =>
            (c.name && c.name.toLowerCase().includes(query)) ||
            (c.email && c.email.toLowerCase().includes(query)) ||
            (c.mob && c.mob.includes(query))
        );
    }

    const tbody = $('#customerTableBody').empty();

    if (filtered.length === 0) {
        tbody.html('<tr><td colspan="7" class="text-center py-4 text-muted">No customers found.</td></tr>');
        return;
    }

    filtered.forEach(cust => {
        const creditLimit = parseFloat(cust.creditLimit || 0);
        const creditUsed = parseFloat(cust.creditUsed || 0);
        const availableCredit = creditLimit - creditUsed;

        tbody.append(`
            <tr>
                <td><strong>${cust.id || cust._id}</strong></td>
                <td>${cust.name || 'N/A'}</td>
                <td>${cust.email}</td>
                <td>${cust.mob || 'N/A'}</td>
                <td><span class="badge bg-primary fs-6">$${creditLimit.toFixed(2)}</span></td>
                <td>$${creditUsed.toFixed(2)}</td>
                <td>
                    <span class="badge ${availableCredit >= 0 ? 'bg-success' : 'bg-danger'}">
                        $${availableCredit.toFixed(2)}
                    </span>
                </td>
                <td>
                    <button class="btn btn-sm btn-outline-primary" onclick="openCreditModal('${cust.id || cust._id}', '${cust.name}', ${creditLimit})">
                        <i class="bi bi-wallet2"></i> Adjust Credit
                    </button>
                </td>
            </tr>
        `);
    });
}

function openCreditModal(customerId, customerName, currentLimit) {
    $('#modalCustId').val(customerId);
    $('#modalCustName').text(customerName);
    $('#modalCreditLimit').val(currentLimit);
    $('#creditLimitModal').modal('show');
}

function saveCustomerCreditLimit() {
    const custId = $('#modalCustId').val();
    const newLimit = parseFloat($('#modalCreditLimit').val());

    if (isNaN(newLimit) || newLimit < 0) {
        alert('Please enter a valid credit limit amount.');
        return;
    }

    $('#saveCreditLimitBtn').prop('disabled', true).text('Updating...');

    FirestoreAPI.updateDocument('users', custId, { creditLimit: newLimit })
        .then(function() {
            $('#creditLimitModal').modal('hide');
            loadCustomers();
        })
        .always(function() {
            $('#saveCreditLimitBtn').prop('disabled', false).text('Save Credit Limit');
        });
}
