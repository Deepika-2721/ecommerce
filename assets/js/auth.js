/**
 * auth.js
 * Handles User Sign In, Registration, Password Reset, and Route Guards
 */

$(document).ready(function() {
    updateNavAuthStatus();

    // Toggle between login and registration cards
    $('#showRegisterBtn').on('click', function(e) {
        e.preventDefault();
        $('#loginCard').addClass('d-none');
        $('#registerCard').removeClass('d-none');
        $('#forgotCard').addClass('d-none');
    });

    $('#showLoginBtn, #backToLoginFromForgot').on('click', function(e) {
        e.preventDefault();
        $('#registerCard').addClass('d-none');
        $('#forgotCard').addClass('d-none');
        $('#loginCard').removeClass('d-none');
    });

    $('#showForgotBtn').on('click', function(e) {
        e.preventDefault();
        $('#loginCard').addClass('d-none');
        $('#registerCard').addClass('d-none');
        $('#forgotCard').removeClass('d-none');
    });

    // Handle Login
    $('#loginForm').on('submit', function(e) {
        e.preventDefault();
        const email = $('#loginEmail').val().trim();
        const password = $('#loginPassword').val();

        if (!email || !password) {
            showAlert('loginAlert', 'Please enter both email and password.', 'danger');
            return;
        }

        $('#loginSubmitBtn').prop('disabled', true).html('<span class="spinner-border spinner-border-sm"></span> Signing In...');

        AuthAPI.signIn(email, password)
            .then(function(authRes) {
                localStorage.setItem('idToken', authRes.idToken);
                localStorage.setItem('userId', authRes.localId);
                localStorage.setItem('userEmail', authRes.email || email);

                // Fetch user document from Firestore
                return FirestoreAPI.getDocument('users', authRes.localId)
                    .then(function(userDoc) {
                        const role = (userDoc && userDoc.role) ? userDoc.role : (email === 'admin@shopping.com' ? 'admin' : 'customer');
                        localStorage.setItem('userRole', role);
                        localStorage.setItem('userName', (userDoc && userDoc.name) ? userDoc.name : email.split('@')[0]);

                        if (role === 'admin') {
                            window.location.href = 'admin/index.html';
                        } else {
                            window.location.href = 'index.html';
                        }
                    });
            })
            .catch(function(err) {
                let msg = 'Failed to sign in. Please verify your email and password.';
                if (err && err.responseJSON && err.responseJSON.error && err.responseJSON.error.message) {
                    msg = err.responseJSON.error.message.replace(/_/g, ' ');
                }
                showAlert('loginAlert', msg, 'danger');
            })
            .always(function() {
                $('#loginSubmitBtn').prop('disabled', false).text('Sign In');
            });
    });

    // Handle Registration
    $('#registerForm').on('submit', function(e) {
        e.preventDefault();
        const name = $('#regName').val().trim();
        const email = $('#regEmail').val().trim();
        const mob = $('#regMob').val().trim();
        const password = $('#regPassword').val();
        const confirmPassword = $('#regConfirmPassword').val();

        // Validations
        if (!name || !email || !mob || !password) {
            showAlert('regAlert', 'All fields are required.', 'danger');
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            showAlert('regAlert', 'Please enter a valid email address.', 'danger');
            return;
        }

        const phoneRegex = /^[0-9]{10}$/;
        if (!phoneRegex.test(mob)) {
            showAlert('regAlert', 'Mobile number must be exactly 10 digits.', 'danger');
            return;
        }

        if (password.length < 6) {
            showAlert('regAlert', 'Password must be at least 6 characters long.', 'danger');
            return;
        }

        if (password !== confirmPassword) {
            showAlert('regAlert', 'Passwords do not match.', 'danger');
            return;
        }

        $('#regSubmitBtn').prop('disabled', true).html('<span class="spinner-border spinner-border-sm"></span> Creating Account...');

        AuthAPI.signUp(email, password)
            .then(function(authRes) {
                const userId = authRes.localId;
                const role = email.toLowerCase() === 'admin@shopping.com' ? 'admin' : 'customer';

                const newUserData = {
                    id: userId,
                    name: name,
                    email: email,
                    mob: mob,
                    role: role,
                    creditLimit: 0, // Default 0 as per requirements
                    creditUsed: 0
                };

                return FirestoreAPI.createDocumentWithId('users', userId, newUserData)
                    .then(function() {
                        showAlert('regAlert', 'Account created successfully! Redirecting to sign in...', 'success');
                        setTimeout(function() {
                            $('#registerCard').addClass('d-none');
                            $('#loginCard').removeClass('d-none');
                            $('#loginEmail').val(email);
                        }, 1500);
                    });
            })
            .catch(function(err) {
                let msg = 'Registration failed. Please try again.';
                if (err && err.responseJSON && err.responseJSON.error && err.responseJSON.error.message) {
                    msg = err.responseJSON.error.message.replace(/_/g, ' ');
                }
                showAlert('regAlert', msg, 'danger');
            })
            .always(function() {
                $('#regSubmitBtn').prop('disabled', false).text('Create Account');
            });
    });

    // Handle Password Reset
    $('#forgotForm').on('submit', function(e) {
        e.preventDefault();
        const email = $('#forgotEmail').val().trim();

        if (!email) {
            showAlert('forgotAlert', 'Please provide your account email.', 'danger');
            return;
        }

        $('#forgotSubmitBtn').prop('disabled', true).html('<span class="spinner-border spinner-border-sm"></span> Sending...');

        AuthAPI.resetPassword(email)
            .then(function() {
                showAlert('forgotAlert', 'Password reset email sent! Check your inbox.', 'success');
            })
            .catch(function(err) {
                showAlert('forgotAlert', 'Could not send reset email. Verify email address.', 'danger');
            })
            .always(function() {
                $('#forgotSubmitBtn').prop('disabled', false).text('Send Reset Link');
            });
    });

    // Handle Logout
    $(document).on('click', '.logout-btn', function(e) {
        e.preventDefault();
        localStorage.removeItem('idToken');
        localStorage.removeItem('userId');
        localStorage.removeItem('userEmail');
        localStorage.removeItem('userName');
        localStorage.removeItem('userRole');
        window.location.href = '../login.html';
    });
});

function showAlert(containerId, message, type) {
    $(`#${containerId}`).html(`
        <div class="alert alert-${type} alert-dismissible fade show" role="alert">
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `);
}

function updateNavAuthStatus() {
    const token = localStorage.getItem('idToken');
    const role = localStorage.getItem('userRole');
    const name = localStorage.getItem('userName') || 'User';

    if (token) {
        $('#navAuthContainer').html(`
            <span class="nav-link text-white me-2"><i class="bi bi-person-circle"></i> ${name}</span>
            ${role === 'admin' ? '<a href="admin/index.html" class="btn btn-outline-warning btn-sm me-2">Admin Portal</a>' : ''}
            <a href="#" class="btn btn-outline-light btn-sm logout-btn">Sign Out</a>
        `);
    } else {
        $('#navAuthContainer').html(`
            <a href="login.html" class="btn btn-outline-light btn-sm">Sign In / Register</a>
        `);
    }
}
