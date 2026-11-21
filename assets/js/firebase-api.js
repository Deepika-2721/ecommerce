/**
 * firebase-api.js
 * Native jQuery $.ajax implementation communicating directly with
 * Google Firebase Identity Toolkit (Auth) and Cloud Firestore REST APIs.
 * NO Firebase Client SDK is used.
 */

const FIREBASE_CONFIG = {
    apiKey: "", // Fill in your Firebase Web API Key
    projectId: "" // Fill in your Firebase Project ID
};

const AUTH_BASE_URL = "https://identitytoolkit.googleapis.com/v1/accounts";
const getFirestoreBaseUrl = () => `https://firestore.googleapis.com/v1/projects/${FIREBASE_CONFIG.projectId}/databases/(default)/documents`;

// Helper: Check if real Firebase credentials are configured
function isFirebaseConfigured() {
    return FIREBASE_CONFIG.apiKey && FIREBASE_CONFIG.apiKey.trim() !== "" &&
           FIREBASE_CONFIG.projectId && FIREBASE_CONFIG.projectId.trim() !== "" &&
           !FIREBASE_CONFIG.apiKey.includes("YOUR_FIREBASE");
}

/* ==========================================================================
   Firestore REST Type Serializer & Deserializer
   ========================================================================== */

function toFirestoreDocument(obj) {
    const fields = {};
    for (const [key, value] of Object.entries(obj)) {
        if (value === undefined || value === null) continue;
        if (typeof value === "string") {
            fields[key] = { stringValue: value };
        } else if (typeof value === "number") {
            fields[key] = Number.isInteger(value)
                ? { integerValue: value.toString() }
                : { doubleValue: value };
        } else if (typeof value === "boolean") {
            fields[key] = { booleanValue: value };
        } else if (Array.isArray(value)) {
            fields[key] = {
                arrayValue: {
                    values: value.map(v => typeof v === 'object' ? { mapValue: toFirestoreDocument(v) } : { stringValue: String(v) })
                }
            };
        } else if (value instanceof Date) {
            fields[key] = { timestampValue: value.toISOString() };
        } else if (typeof value === "object") {
            fields[key] = { mapValue: toFirestoreDocument(value) };
        }
    }
    return { fields };
}

function fromFirestoreDocument(doc) {
    if (!doc || !doc.fields) return null;
    const result = { _id: doc.name ? doc.name.split("/").pop() : (doc.id || "") };
    for (const [key, valObj] of Object.entries(doc.fields)) {
        if ("stringValue" in valObj) result[key] = valObj.stringValue;
        else if ("integerValue" in valObj) result[key] = parseInt(valObj.integerValue, 10);
        else if ("doubleValue" in valObj) result[key] = parseFloat(valObj.doubleValue);
        else if ("booleanValue" in valObj) result[key] = valObj.booleanValue;
        else if ("timestampValue" in valObj) result[key] = valObj.timestampValue;
        else if ("arrayValue" in valObj) {
            result[key] = (valObj.arrayValue.values || []).map(v => {
                if (v.mapValue) return fromFirestoreDocument(v.mapValue);
                return v.stringValue || v.integerValue || v.doubleValue || v;
            });
        } else if ("mapValue" in valObj) {
            result[key] = fromFirestoreDocument(valObj.mapValue);
        }
    }
    return result;
}

/* ==========================================================================
   Mock / LocalStorage Fallback Storage (Enables instant zero-config testing)
   ========================================================================== */

const MockDB = {
    init: function() {
        if (!localStorage.getItem("mock_initialized")) {
            // Seed Categories
            const categories = [
                { id: "cat_01", name: "Electronics" },
                { id: "cat_02", name: "Apparel & Fashion" },
                { id: "cat_03", name: "Home & Kitchen" },
                { id: "cat_04", name: "Books & Stationery" }
            ];
            localStorage.setItem("mock_categories", JSON.stringify(categories));

            // Seed Products
            const products = [
                { id: "PRD-101", cat_id: "cat_01", title: "Wireless Noise-Canceling Headphones", des: "Premium over-ear Bluetooth headphones with 30hr battery", qty: 120, price: 149.99, status: "active", createdAt: new Date("2026-11-01").toISOString() },
                { id: "PRD-102", cat_id: "cat_01", title: "Smart Fitness Watch", des: "Heart rate, SpO2, waterproof sports smartwatch", qty: 12, price: 89.99, status: "active", createdAt: new Date("2026-11-02").toISOString() },
                { id: "PRD-103", cat_id: "cat_01", title: "Mechanical Gaming Keyboard", des: "RGB backlit mechanical switches with wrist rest", qty: 65, price: 79.50, status: "active", createdAt: new Date("2026-11-03").toISOString() },
                { id: "PRD-104", cat_id: "cat_02", title: "Classic Denim Jacket", des: "Unisex vintage wash durable denim jacket", qty: 8, price: 59.99, status: "active", createdAt: new Date("2026-11-04").toISOString() },
                { id: "PRD-105", cat_id: "cat_02", title: "Breathable Running Sneakers", des: "Lightweight cushioned athletic running shoes", qty: 110, price: 95.00, status: "active", createdAt: new Date("2026-11-05").toISOString() },
                { id: "PRD-106", cat_id: "cat_03", title: "Stainless Steel Espresso Maker", des: "15-bar Italian pump coffee machine with milk frother", qty: 5, price: 189.00, status: "active", createdAt: new Date("2026-11-06").toISOString() },
                { id: "PRD-107", cat_id: "cat_03", title: "Non-Stick Ceramic Cookware Set", des: "10-piece eco-friendly dishwasher safe pots and pans", qty: 45, price: 129.99, status: "active", createdAt: new Date("2026-11-07").toISOString() },
                { id: "PRD-108", cat_id: "cat_04", title: "JavaScript: The Definitive Guide", des: "Comprehensive guide to modern web development", qty: 150, price: 42.00, status: "active", createdAt: new Date("2026-11-08").toISOString() }
            ];
            localStorage.setItem("mock_products", JSON.stringify(products));

            // Seed Users
            const users = [
                { id: "USR-ADMIN", name: "Super Admin", email: "admin@shopping.com", mob: "9876543210", role: "admin", creditLimit: 0, creditUsed: 0 },
                { id: "USR-001", name: "Rahul Sharma", email: "customer@shopping.com", mob: "9123456780", role: "customer", creditLimit: 1000, creditUsed: 250 },
                { id: "USR-002", name: "Priya Nair", email: "priya@example.com", mob: "9812345678", role: "customer", creditLimit: 1500, creditUsed: 0 },
                { id: "USR-003", name: "Amit Kumar", email: "amit@example.com", mob: "9988776655", role: "customer", creditLimit: 500, creditUsed: 120 }
            ];
            localStorage.setItem("mock_users", JSON.stringify(users));

            // Seed Orders for immediate date-range reports
            const orders = [
                {
                    orderId: "ORD-20261110-01",
                    customerId: "USR-001",
                    customerName: "Rahul Sharma",
                    customerEmail: "customer@shopping.com",
                    items: [{ productId: "PRD-101", cat_id: "cat_01", title: "Wireless Noise-Canceling Headphones", qty: 1, price: 149.99, subtotal: 149.99 }],
                    totalAmount: 149.99,
                    paymentType: "credit",
                    createdAt: "2026-11-10T10:30:00Z",
                    status: "completed"
                },
                {
                    orderId: "ORD-20261112-02",
                    customerId: "USR-001",
                    customerName: "Rahul Sharma",
                    customerEmail: "customer@shopping.com",
                    items: [{ productId: "PRD-108", cat_id: "cat_04", title: "JavaScript: The Definitive Guide", qty: 2, price: 42.00, subtotal: 84.00 }],
                    totalAmount: 84.00,
                    paymentType: "cash",
                    createdAt: "2026-11-12T14:15:00Z",
                    status: "completed"
                },
                {
                    orderId: "ORD-20261115-03",
                    customerId: "USR-003",
                    customerName: "Amit Kumar",
                    customerEmail: "amit@example.com",
                    items: [{ productId: "PRD-105", cat_id: "cat_02", title: "Breathable Running Sneakers", qty: 1, price: 95.00, subtotal: 95.00 }],
                    totalAmount: 95.00,
                    paymentType: "credit",
                    createdAt: "2026-11-15T09:00:00Z",
                    status: "completed"
                }
            ];
            localStorage.setItem("mock_orders", JSON.stringify(orders));
            localStorage.setItem("mock_initialized", "true");
        }
    },

    getCollection: function(name) {
        return JSON.parse(localStorage.getItem(`mock_${name}`) || "[]");
    },

    saveCollection: function(name, items) {
        localStorage.setItem(`mock_${name}`, JSON.stringify(items));
    }
};

MockDB.init();

/* ==========================================================================
   Firebase Authentication REST API
   ========================================================================== */

const AuthAPI = {
    signUp: function(email, password) {
        if (!isFirebaseConfigured()) {
            return $.Deferred(function(def) {
                setTimeout(function() {
                    const localId = "USR-" + Date.now();
                    def.resolve({ idToken: "mock-token-" + Date.now(), localId: localId, email: email });
                }, 300);
            }).promise();
        }

        return $.ajax({
            url: `${AUTH_BASE_URL}:signUp?key=${FIREBASE_CONFIG.apiKey}`,
            method: "POST",
            contentType: "application/json",
            data: JSON.stringify({ email, password, returnSecureToken: true })
        });
    },

    signIn: function(email, password) {
        if (!isFirebaseConfigured()) {
            return $.Deferred(function(def) {
                setTimeout(function() {
                    const users = MockDB.getCollection("users");
                    const user = users.find(u => u.email.toLowerCase() === email.toLowerCase());
                    if (user) {
                        def.resolve({ idToken: "mock-token-" + Date.now(), localId: user.id, email: user.email });
                    } else if (email === "admin@shopping.com") {
                        def.resolve({ idToken: "mock-token-admin", localId: "USR-ADMIN", email: email });
                    } else {
                        def.reject({ responseJSON: { error: { message: "INVALID_LOGIN_CREDENTIALS" } } });
                    }
                }, 300);
            }).promise();
        }

        return $.ajax({
            url: `${AUTH_BASE_URL}:signInWithPassword?key=${FIREBASE_CONFIG.apiKey}`,
            method: "POST",
            contentType: "application/json",
            data: JSON.stringify({ email, password, returnSecureToken: true })
        });
    },

    resetPassword: function(email) {
        if (!isFirebaseConfigured()) {
            return $.Deferred(function(def) {
                setTimeout(function() {
                    def.resolve({ email: email });
                }, 300);
            }).promise();
        }

        return $.ajax({
            url: `${AUTH_BASE_URL}:sendOobCode?key=${FIREBASE_CONFIG.apiKey}`,
            method: "POST",
            contentType: "application/json",
            data: JSON.stringify({ requestType: "PASSWORD_RESET", email: email })
        });
    },

    getToken: function() {
        return localStorage.getItem("idToken");
    }
};

/* ==========================================================================
   Cloud Firestore REST API (with seamless fallback)
   ========================================================================== */

const FirestoreAPI = {
    getHeaders: function() {
        const token = AuthAPI.getToken();
        return token && !token.startsWith("mock-") ? { "Authorization": `Bearer ${token}` } : {};
    },

    getDocuments: function(collection, pageSize = 100) {
        if (!isFirebaseConfigured()) {
            return $.Deferred(function(def) {
                const items = MockDB.getCollection(collection);
                def.resolve({ items: items });
            }).promise();
        }

        return $.ajax({
            url: `${getFirestoreBaseUrl()}/${collection}?pageSize=${pageSize}`,
            method: "GET",
            headers: this.getHeaders()
        }).then(res => {
            const items = (res.documents || []).map(fromFirestoreDocument);
            return { items: items, nextPageToken: res.nextPageToken || null };
        }).catch(() => {
            return { items: MockDB.getCollection(collection) };
        });
    },

    getDocument: function(collection, docId) {
        if (!isFirebaseConfigured()) {
            return $.Deferred(function(def) {
                const items = MockDB.getCollection(collection);
                const found = items.find(i => (i.id === docId || i._id === docId));
                def.resolve(found || null);
            }).promise();
        }

        return $.ajax({
            url: `${getFirestoreBaseUrl()}/${collection}/${docId}`,
            method: "GET",
            headers: this.getHeaders()
        }).then(fromFirestoreDocument).catch(() => {
            const items = MockDB.getCollection(collection);
            return items.find(i => (i.id === docId || i._id === docId)) || null;
        });
    },

    createDocumentWithId: function(collection, docId, data) {
        // Sync local mock
        const items = MockDB.getCollection(collection);
        const existingIdx = items.findIndex(i => (i.id === docId || i._id === docId));
        const record = { ...data, id: docId, _id: docId };
        if (existingIdx >= 0) items[existingIdx] = record;
        else items.push(record);
        MockDB.saveCollection(collection, items);

        if (!isFirebaseConfigured()) {
            return $.Deferred(function(def) { def.resolve(record); }).promise();
        }

        return $.ajax({
            url: `${getFirestoreBaseUrl()}/${collection}?documentId=${encodeURIComponent(docId)}`,
            method: "POST",
            contentType: "application/json",
            headers: this.getHeaders(),
            data: JSON.stringify(toFirestoreDocument(data))
        }).then(fromFirestoreDocument).catch(() => record);
    },

    updateDocument: function(collection, docId, fieldsToUpdate) {
        // Sync local mock
        const items = MockDB.getCollection(collection);
        const idx = items.findIndex(i => (i.id === docId || i._id === docId));
        if (idx >= 0) {
            items[idx] = { ...items[idx], ...fieldsToUpdate };
            MockDB.saveCollection(collection, items);
        }

        if (!isFirebaseConfigured()) {
            return $.Deferred(function(def) { def.resolve(items[idx] || fieldsToUpdate); }).promise();
        }

        const maskQuery = Object.keys(fieldsToUpdate)
            .map(k => `updateMask.fieldPaths=${encodeURIComponent(k)}`)
            .join("&");

        return $.ajax({
            url: `${getFirestoreBaseUrl()}/${collection}/${docId}?${maskQuery}`,
            method: "PATCH",
            contentType: "application/json",
            headers: this.getHeaders(),
            data: JSON.stringify(toFirestoreDocument(fieldsToUpdate))
        }).then(fromFirestoreDocument).catch(() => items[idx]);
    },

    deleteDocument: function(collection, docId) {
        // Sync local mock
        let items = MockDB.getCollection(collection);
        items = items.filter(i => (i.id !== docId && i._id !== docId));
        MockDB.saveCollection(collection, items);

        if (!isFirebaseConfigured()) {
            return $.Deferred(function(def) { def.resolve(true); }).promise();
        }

        return $.ajax({
            url: `${getFirestoreBaseUrl()}/${collection}/${docId}`,
            method: "DELETE",
            headers: this.getHeaders()
        }).catch(() => true);
    }
};
