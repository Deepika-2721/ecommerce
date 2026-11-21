# Online Shopping Web Application

A full-featured Online Shopping web application built with **HTML5, CSS3, JavaScript, and jQuery (Ajax)** communicating directly with **Google Firebase REST APIs** (Authentication REST API & Cloud Firestore REST API) without the Firebase Client SDK. Version control and CI/CD are managed via **GitHub and GitHub Actions**.

---

## Features

### 1. Authentication & User Roles
- **Single Admin Account**: Pre-configured admin email (`admin@shopping.com`) with role-based routing.
- **Customer Sign Up & Sign In**: Full form validations (name, email format, 10-digit mobile number, secure password).
- **Password Reset**: Automated password reset email dispatch via Firebase Auth Identity Toolkit REST API (`sendOobCode`).
- **Session Management**: JWT `idToken` and `localId` stored securely in `localStorage` with automated route guards.

### 2. Admin Inventory CRUD & Customer Management
- **Category Management**: Categories with `id` and `name`.
- **Product Inventory CRUD**:
  - Fields: `id`, `cat_id`, `title`, `des`, `qty`, `price`, `status`.
  - **Create**: Add new product with custom ID.
  - **Read & Pagination**: Filter by **All**, **Select by Category**, or **Search Individual Item** by title/ID with client-side pagination.
  - **Update**: Edit modal allowing updates to title, description, category, quantity, and price. **Product ID is strictly read-only**.
  - **Deactivate / Activate (Soft Delete)**: Toggle product availability without data loss.
  - **Hard Delete**: Delete action protected with a *"Confirm? Yes/No"* confirmation dialog.
- **Customer Credit Limit CRUD**:
  - View all registered customers.
  - Set and update individual credit limits (Default: `0`, e.g., set to `1000` for active shoppers).

### 3. Customer Storefront, Cart & Checkout
- **Catalog Browsing**: Real-time search across all columns, category dropdown filtering, and pagination.
- **Cart Management**: Add items to cart with quantity validation (cannot exceed in-stock quantity).
- **Payment & Credit Verification**:
  - Supports **Cash** and **Credit Limit** payment methods.
  - If Credit is selected, verifies `orderTotal <= (creditLimit - creditUsed)`. If exceeded, purchase is blocked with an alert.
  - On completion, decrements product inventory `qty` and updates customer `creditUsed`.
- **Billing & Order Invoices**:
  - Instant printable / downloadable invoice receipt modal.
  - Email notification trigger for customer confirmation.
- **Order History**: Dedicated order history page showing past orders, line items, and payment details.

### 4. Comprehensive Admin Analytics & Reporting Engine
Date-filtered analytics (`From Date` to `To Date`):
1. **Customer Reports**:
   - Master list (All columns).
   - Top 10 Customers by total spend in date range.
   - Cash purchase reports.
   - Credit purchase reports.
2. **Inventory Reports**:
   - Current Stock (All items & Category-wise totals).
   - Stock Alert Badges: **High Stock** (> 100 units) and **Low Stock** (< 15 units).
3. **Sales Reports**:
   - All Sales summary, Category-wise breakdown, Cash vs. Credit totals.
   - Top 10 Selling Items & Bottom 10 Selling Items by volume.

---

## Tech Stack & Architecture

- **Frontend**: HTML5, CSS3, Bootstrap 5, jQuery 3.7+
- **Network Layer**: Native jQuery `$.ajax` calls to Firebase REST APIs (Zero Firebase Client SDK dependency)
- **Database**: Cloud Firestore REST API (`v1`)
- **Authentication**: Firebase Identity Toolkit REST API (`v1`)
- **CI/CD**: GitHub Actions workflow (`.github/workflows/ci-cd.yml`)

---

## Configuration & Setup

1. Open `assets/js/firebase-api.js`.
2. Fill in your Firebase Web API Key and Project ID:
   ```javascript
   const FIREBASE_CONFIG = {
       apiKey: "YOUR_FIREBASE_WEB_API_KEY",
       projectId: "your-firebase-project-id"
   };
   ```
   > **Note**: An automatic offline/demo mock database is built into `firebase-api.js`. If Firebase credentials are empty or offline, the app seamlessly falls back to local storage with pre-seeded data, allowing immediate testing of all admin and customer flows!

3. To serve locally:
   - Use VS Code Live Server or run:
     ```bash
     npx serve .
     ```
   - Open `http://localhost:3000` (or `http://127.0.0.1:5500`) in your browser.

4. Default credentials for testing:
   - **Admin**: `admin@shopping.com` / `admin123`
   - **Customer**: `customer@shopping.com` / `cust123` (or register a new user)

---

## GitHub & GitHub Actions

Pushing to the `main` branch automatically triggers `.github/workflows/ci-cd.yml`, which runs syntax validation and deploys the static files to Firebase Hosting or GitHub Pages.
