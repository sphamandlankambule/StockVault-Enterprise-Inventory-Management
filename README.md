# StockVault / IMS Pro - Enterprise Inventory & Audit Management System

An Enterprise Inventory & Audit Compliance Management System built with React 18, TypeScript, Tailwind CSS, Express.js, and a direct **MySQL Database** driver (`mysql2`).

---

## 🗄️ Database Architecture & Direct MySQL Integration

The system communicates **strictly and directly with MySQL database** using Node.js `mysql2/promise` connection pooling.

- **No Static Fallback Data**: All static/mock in-memory fallback data has been completely removed.
- **Direct Node.js Database Queries**: PHP APIs and external PHP scripts are not used. All REST endpoints query the MySQL database directly via Express backend handlers in `server.ts`.
- **Database Availability Guarantee**: When the MySQL database is unreachable or misconfigured, the system returns explicit database connection error messages (`Database Connection Failed...`).

---

## ⚙️ Environment Variables (MySQL Configuration)

To connect to your MySQL database instance, set the following environment variables in `.env`:

```env
# MySQL Database Connection Settings
DB_HOST="127.0.0.1"
DB_PORT="3306"
DB_NAME="stockvault_db"
DB_USER="root"
DB_PASS=""
```

---

## 📋 Features

- **Mobile-Friendly & Responsive UI**: Built with responsive layouts, fluid mobile navigation drawers, adaptable data grids, and touch-optimized digital signature canvases.
- **Dedicated Low Stock & Reorder Center**: Centralized low-stock alert system featuring real-time batch depletion monitoring, category/severity filters, auto-calculated reorder deficits, estimated restock budgets, CSV export, and printable requisition forms.
- **Multi-Department RBAC Scope**: Non-admin users are strictly scoped to view and manage inventory for their registered department. System Administrators (`ADMIN`) retain access across all departments.
- **Financial Year Ledger**: Track stock dispatches, valuations, and low-stock alerts tied to active financial year contexts (e.g. `FY 2025-2026`).
- **Dual Digital Signatures**: Secure stock out dispatches with dual signature verification (store keeper + recipient officer) on canvas.
- **Serial Number & Batch Tracking**: Batch and serialized item tracking with barcode/QR code generator.
- **Audit Logs**: Immutable system activity logging tracking user actions, IP logging, and timestamps.
- **Production-Hardened Security**: Sanitized API responses, bcrypt password hashing, and role-based endpoint access control.

---

## 🛠️ Local Installation & Database Setup Guide

### Step 1: Initialize Database Schema

1. Start your **MySQL** server (via XAMPP, Docker, or native MySQL daemon).
2. Create the target database:
   ```sql
   CREATE DATABASE IF NOT EXISTS `stockvault_db` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
   ```
3. Import the clean relational database DDL schema from `php_apis/schema.sql`:
   ```bash
   mysql -u root -p stockvault_db < php_apis/schema.sql
   ```

*Note: `php_apis/schema.sql` contains strictly database table structures (`CREATE TABLE`). No hardcoded mock users or seed data are included in `schema.sql`.*

---

### Step 2: Install Dependencies & Run the Web Application

1. Install Node.js dependencies:
   ```bash
   npm install
   ```
2. Start the development server (runs on port `3000`):
   ```bash
   npm run dev
   ```
3. Open your browser:
   ```
   http://localhost:3000
   ```

---

## ⚡ First-Time System Setup Flow

On the first application run, the system automatically checks if database tables are available and populated. If the system detects an uninitialized or empty database, it launches the interactive **First-Time System Setup Wizard**:

1. **System Director Account**: Prompt to register your root administrator credentials (`Full Name`, `Username`, `Email`, and `Password`).
2. **Primary Store Vault Department**: Setup your central distribution warehouse department (`Code` and `Name`).
3. **Organization & Currency**: Define company name and currency symbols (e.g. `SZL`, `E`, `$`).
4. **Active Financial Year**: Configure the initial active financial period.

Once completed, the setup wizard dynamically hashes credentials using `bcrypt` and writes the default roles, administrator account, store vault department, and system settings directly to the SQL database.

---

## 🚀 Build for Production Deployment

To build and run in production:

```bash
npm run build
npm start
```

The production build bundles the Express server into `dist/server.cjs` and compiles the frontend static assets ready to serve on port `3000`.
