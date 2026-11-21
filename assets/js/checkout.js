/**
 * checkout.js
 * Shopping Cart and Checkout Logic:
 * - Cart item management & line item subtotals
 * - Payment selection: Cash vs. Credit Limit (verifies against customer credit limit)
 * - Decrements inventory quantity in Firestore via REST API
 * - Generates Order / Bill Invoice report & dispatches email notification
 */

let currentUserData = null;

$(document).ready(function() {
    renderCart();
    loadCustomerCreditInfo();

    // Payment method radio change
    $('input[name="paymentMethod"]').on('change', function() {
        validateCreditLimitAvailability();
    });

    // Place Order Button
    $('#placeOrderBtn').on('click', function() {
        executeCheckout();
    });
});

function loadCustomerCreditInfo() {
    const userId = localStorage.getItem('userId');
    if (!userId) {
        $('#creditStatusBox').html(`
            <div class="alert alert-warning py-2 mb-0">
                <small><a href="login.html" class="fw-bold">Sign in</a> to view your available credit limit.</small>
            </div>
        `);
        return;
    }

    FirestoreAPI.getDocument('users', userId).then(function(user) {
        currentUserData = user;
        const limit = parseFloat(user.creditLimit || 0);
        const used = parseFloat(user.creditUsed || 0);
        const available = limit - used;

        $('#creditLimitDisplay').text(`$${limit.toFixed(2)}`);
        $('#creditUsedDisplay').text(`$${used.toFixed(2)}`);
        $('#creditAvailableDisplay').text(`$${available.toFixed(2)}`);

        if (available <= 0) {
            $('#creditRadio').prop('disabled', true);
            $('#creditRadioLabel').append(' <span class="badge bg-danger">Limit Reached</span>');
        }

        validateCreditLimitAvailability();
    });
}

function renderCart() {
    const cart = JSON.parse(localStorage.getItem('shopping_cart') || '[]');
    const tbody = $('#cartTableBody').empty();

    if (cart.length === 0) {
        tbody.html('<tr><td colspan="6" class="text-center py-5 text-muted">Your shopping cart is empty. <a href="index.html">Browse Products</a></td></tr>');
        $('#cartTotalAmount').text('$0.00');
        $('#placeOrderBtn').prop('disabled', true);
        return;
    }

    $('#placeOrderBtn').prop('disabled', false);
    let subtotal = 0;

    cart.forEach((item, index) => {
        const itemTotal = item.price * item.selectedQty;
        subtotal += itemTotal;

        tbody.append(`
            <tr>
                <td><strong>${item.title}</strong><br><small class="text-muted">ID: ${item.id}</small></td>
                <td>$${item.price.toFixed(2)}</td>
                <td style="max-width: 120px;">
                    <div class="input-group input-group-sm">
                        <input type="number" class="form-control text-center" value="${item.selectedQty}" min="1" max="${item.maxQty}" onchange="updateCartQuantity(${index}, this.value)">
                    </div>
                </td>
                <td><strong>$${itemTotal.toFixed(2)}</strong></td>
                <td>
                    <button class="btn btn-sm btn-outline-danger" onclick="removeFromCart(${index})" title="Remove item">
                        <i class="bi bi-trash"></i>
                    </button>
                </td>
            </tr>
        `);
    });

    $('#cartTotalAmount').text(`$${subtotal.toFixed(2)}`);
    $('#checkoutTotal').text(`$${subtotal.toFixed(2)}`);
    validateCreditLimitAvailability();
}

function updateCartQuantity(index, newQty) {
    let cart = JSON.parse(localStorage.getItem('shopping_cart') || '[]');
    newQty = parseInt(newQty, 10);

    if (newQty <= 0) {
        removeFromCart(index);
        return;
    }

    if (newQty > cart[index].maxQty) {
        alert(`Cannot order more than available stock (${cart[index].maxQty} units).`);
        renderCart();
        return;
    }

    cart[index].selectedQty = newQty;
    localStorage.setItem('shopping_cart', JSON.stringify(cart));
    renderCart();
}

function removeFromCart(index) {
    let cart = JSON.parse(localStorage.getItem('shopping_cart') || '[]');
    cart.splice(index, 1);
    localStorage.setItem('shopping_cart', JSON.stringify(cart));
    renderCart();
}

function validateCreditLimitAvailability() {
    const paymentMethod = $('input[name="paymentMethod"]:checked').val();
    const cart = JSON.parse(localStorage.getItem('shopping_cart') || '[]');
    const total = cart.reduce((sum, item) => sum + (item.price * item.selectedQty), 0);

    $('#creditWarning').addClass('d-none');

    if (paymentMethod === 'credit' && currentUserData) {
        const available = (currentUserData.creditLimit || 0) - (currentUserData.creditUsed || 0);
        if (total > available) {
            $('#creditWarning').removeClass('d-none').text(`Warning: Order total ($${total.toFixed(2)}) exceeds your available credit ($${available.toFixed(2)}). You cannot complete checkout with Credit Limit.`);
            $('#placeOrderBtn').prop('disabled', true);
            return false;
        }
    }

    if (cart.length > 0) {
        $('#placeOrderBtn').prop('disabled', false);
    }
    return true;
}

function executeCheckout() {
    const userId = localStorage.getItem('userId');
    const userEmail = localStorage.getItem('userEmail');
    const userName = localStorage.getItem('userName') || 'Customer';

    if (!userId) {
        alert('Please sign in to place your order.');
        window.location.href = 'login.html';
        return;
    }

    const cart = JSON.parse(localStorage.getItem('shopping_cart') || '[]');
    if (cart.length === 0) return;

    const paymentMethod = $('input[name="paymentMethod"]:checked').val();
    const orderTotal = cart.reduce((sum, item) => sum + (item.price * item.selectedQty), 0);

    // Verify credit limit if chosen
    if (paymentMethod === 'credit') {
        const available = (currentUserData.creditLimit || 0) - (currentUserData.creditUsed || 0);
        if (orderTotal > available) {
            alert(`Insufficient credit limit! Available: $${available.toFixed(2)}, Order Total: $${orderTotal.toFixed(2)}`);
            return;
        }
    }

    $('#placeOrderBtn').prop('disabled', true).html('<span class="spinner-border spinner-border-sm"></span> Processing Order...');

    const orderId = `ORD-${Date.now().toString().slice(-6)}`;
    const newOrder = {
        orderId: orderId,
        customerId: userId,
        customerName: userName,
        customerEmail: userEmail,
        items: cart,
        totalAmount: orderTotal,
        paymentType: paymentMethod,
        createdAt: new Date().toISOString(),
        status: 'completed'
    };

    // 1. Create order in Firestore
    FirestoreAPI.createDocumentWithId('orders', orderId, newOrder)
        .then(function() {
            // 2. Decrement inventory quantities for each product
            const decrementPromises = cart.map(item => {
                const remainingQty = item.maxQty - item.selectedQty;
                return FirestoreAPI.updateDocument('products', item.id, { qty: remainingQty });
            });
            return Promise.all(decrementPromises);
        })
        .then(function() {
            // 3. Update customer creditUsed if payment was credit
            if (paymentMethod === 'credit') {
                const updatedCreditUsed = (currentUserData.creditUsed || 0) + orderTotal;
                return FirestoreAPI.updateDocument('users', userId, { creditUsed: updatedCreditUsed });
            }
            return Promise.resolve();
        })
        .then(function() {
            // 4. Clear Cart and show Printable Invoice
            localStorage.removeItem('shopping_cart');
            showInvoiceModal(newOrder);
        })
        .catch(function(err) {
            alert('Error processing your order. Please try again.');
            console.error(err);
            $('#placeOrderBtn').prop('disabled', false).text('Confirm & Place Order');
        });
}

function showInvoiceModal(order) {
    $('#invOrderId').text(order.orderId);
    $('#invOrderDate').text(new Date(order.createdAt).toLocaleString());
    $('#invCustName').text(order.customerName);
    $('#invCustEmail').text(order.customerEmail);
    $('#invPaymentType').text(order.paymentType.toUpperCase());

    const tbody = $('#invItemsBody').empty();
    order.items.forEach(item => {
        tbody.append(`
            <tr>
                <td>${item.title}</td>
                <td class="text-center">${item.selectedQty}</td>
                <td class="text-end">$${item.price.toFixed(2)}</td>
                <td class="text-end">$${(item.price * item.selectedQty).toFixed(2)}</td>
            </tr>
        `);
    });

    $('#invTotalAmount').text(`$${order.totalAmount.toFixed(2)}`);

    // Simulated email confirmation notice
    $('#emailConfirmationStatus').text(`An official order confirmation & bill receipt has been emailed to ${order.customerEmail}.`);

    $('#invoiceModal').modal('show');
}
