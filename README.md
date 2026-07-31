# StockVault / IMS Pro - Enterprise Inventory & Audit Management System

An Enterprise Inventory & Audit Compliance Management System built with React 18, TypeScript, Tailwind CSS, and Express.js (with optional XAMPP Apache + MySQL / PHP support).

---

## 📋 Features

- **Mobile-Friendly & Responsive UI**: Built with responsive layouts, fluid mobile navigation drawers, adaptable data grids, and touch-optimized digital signature canvases.
- **Dedicated Low Stock & Reorder Center**: Centralized low-stock alert system featuring real-time batch depletion monitoring, category/severity filters, auto-calculated reorder deficits, estimated restock budgets, CSV export, and printable requisition forms.
- **Multi-Department RBAC Scope**: Non-admin users are strictly scoped to view and manage inventory for their registered department. System Administrators (`ADMIN`) retain access across all departments.
- **Financial Year Ledger**: Track stock dispatches, valuations, and low-stock alerts tied to active financial year contexts (e.g. `FY 2025-2026`).
- **Dual Digital Signatures**: Secure stock out dispatches with dual signature verification (store keeper + recipient officer) on canvas.
- **Serial Number & Batch Tracking**: Batch and serialized item tracking with barcode/QR code generator.
- **Audit Logs**: Immutable system activity logging tracking user actions, IP logging, and timestamps.
- **Production-Hardened Security**: Sanitized API responses (no plain passwords in state/payloads), role-based endpoint access control, and clean authentication workflows.

---

## 🛠️ Local Installation Guide (XAMPP + Node.js)

### Prerequisites
1. **XAMPP Control Panel**: [Download XAMPP](https://www.apachefriends.org/) (Includes Apache, MySQL, phpMyAdmin, and PHP).
2. **Node.js**: [Download Node.js](https://nodejs.org/) (v18 or higher recommended).

---

### Step 1: Set Up MySQL Database in XAMPP

1. Open **XAMPP Control Panel**.
2. Start both **Apache** and **MySQL** modules.
3. Click the **Admin** button next to MySQL (or open your browser and go to `http://localhost/phpmyadmin`).
4. Click **Databases** tab -> Create a new database named:
   ```sql
   stockvault
   ```
5. Click on the `stockvault` database, go to the **SQL** tab, and execute the database schema:

   ```sql
   CREATE TABLE IF NOT EXISTS departments (
       id VARCHAR(50) PRIMARY KEY,
       code VARCHAR(20) NOT NULL UNIQUE,
       name VARCHAR(100) NOT NULL,
       head_of_department VARCHAR(100),
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

   CREATE TABLE IF NOT EXISTS users (
       id VARCHAR(50) PRIMARY KEY,
       username VARCHAR(50) NOT NULL UNIQUE,
       full_name VARCHAR(100) NOT NULL,
       email VARCHAR(100) NOT NULL UNIQUE,
       role ENUM('ADMIN', 'STORE_KEEPER', 'DEPT_OFFICER', 'STAFF_RECEIVER') NOT NULL,
       department_id VARCHAR(50),
       is_active TINYINT(1) DEFAULT 1,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

   CREATE TABLE IF NOT EXISTS categories (
       id VARCHAR(50) PRIMARY KEY,
       name VARCHAR(100) NOT NULL,
       code VARCHAR(20) NOT NULL UNIQUE,
       description TEXT,
       low_stock_threshold INT DEFAULT 5,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

   CREATE TABLE IF NOT EXISTS financial_years (
       id VARCHAR(50) PRIMARY KEY,
       year_code VARCHAR(20) NOT NULL UNIQUE,
       start_date DATE NOT NULL,
       end_date DATE NOT NULL,
       is_active TINYINT(1) DEFAULT 0,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

   CREATE TABLE IF NOT EXISTS stock_batches (
       id VARCHAR(50) PRIMARY KEY,
       batch_code VARCHAR(50) NOT NULL UNIQUE,
       category_id VARCHAR(50) NOT NULL,
       department_id VARCHAR(50) NOT NULL,
       financial_year_id VARCHAR(50) NOT NULL,
       supplier_name VARCHAR(100),
       unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00,
       initial_quantity INT NOT NULL DEFAULT 0,
       available_quantity INT NOT NULL DEFAULT 0,
       received_by_user_id VARCHAR(50) NOT NULL,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       FOREIGN KEY (category_id) REFERENCES categories(id),
       FOREIGN KEY (department_id) REFERENCES departments(id),
       FOREIGN KEY (financial_year_id) REFERENCES financial_years(id)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

   CREATE TABLE IF NOT EXISTS inventory_items (
       id VARCHAR(50) PRIMARY KEY,
       item_code VARCHAR(50) NOT NULL UNIQUE,
       serial_number VARCHAR(100) UNIQUE,
       batch_id VARCHAR(50) NOT NULL,
       category_id VARCHAR(50) NOT NULL,
       department_id VARCHAR(50) NOT NULL,
       financial_year_id VARCHAR(50) NOT NULL,
       unit_cost DECIMAL(12,2) NOT NULL DEFAULT 0.00,
       status ENUM('AVAILABLE', 'DISPATCHED', 'UNDER_MAINTENANCE', 'DAMAGED', 'WRITTEN_OFF') DEFAULT 'AVAILABLE',
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       FOREIGN KEY (batch_id) REFERENCES stock_batches(id) ON DELETE CASCADE,
       FOREIGN KEY (category_id) REFERENCES categories(id),
       FOREIGN KEY (department_id) REFERENCES departments(id),
       FOREIGN KEY (financial_year_id) REFERENCES financial_years(id)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

   CREATE TABLE IF NOT EXISTS stock_transactions (
       id VARCHAR(50) PRIMARY KEY,
       transaction_code VARCHAR(50) NOT NULL UNIQUE,
       type ENUM('STOCK_IN', 'STOCK_OUT', 'TRANSFER', 'ADJUSTMENT') NOT NULL,
       batch_id VARCHAR(50) NOT NULL,
       department_id VARCHAR(50) NOT NULL,
       receiver_department_id VARCHAR(50),
       financial_year_id VARCHAR(50) NOT NULL,
       quantity INT NOT NULL,
       unit_cost DECIMAL(12,2) NOT NULL,
       total_value DECIMAL(14,2) NOT NULL,
       dispatched_by_user_id VARCHAR(50),
       received_by_user_id VARCHAR(50),
       sender_signature_data TEXT,
       receiver_signature_data TEXT,
       timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       FOREIGN KEY (batch_id) REFERENCES stock_batches(id),
       FOREIGN KEY (department_id) REFERENCES departments(id)
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

   CREATE TABLE IF NOT EXISTS audit_logs (
       id VARCHAR(50) PRIMARY KEY,
       user_id VARCHAR(50) NOT NULL,
       user_name VARCHAR(100) NOT NULL,
       user_role VARCHAR(50) NOT NULL,
       action VARCHAR(100) NOT NULL,
       entity_type VARCHAR(50) NOT NULL,
       entity_id VARCHAR(50) NOT NULL,
       ip_address VARCHAR(45) DEFAULT '127.0.0.1',
       timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
   ```

---

### Step 2: Install Dependencies & Run the Web Application

1. Open Terminal or Command Prompt in the project folder root.
2. Install Node.js dependencies:
   ```bash
   npm install
   ```
3. Start the application development server:
   ```bash
   npm run dev
   ```
4. Open your web browser and navigate to:
   ```
   http://localhost:3000
   ```

---

### Step 3 (Optional): Hosting PHP API Files in XAMPP (`htdocs`)

If you choose to run direct PHP REST API backend scripts with XAMPP Apache:

1. Open your XAMPP web root directory:
   - **Windows**: `C:\xampp\htdocs\`
   - **macOS**: `/Applications/XAMPP/htdocs/`
   - **Linux**: `/opt/lampp/htdocs/`

2. Create a directory structure for your API:
   ```
   C:\xampp\htdocs\stockvault\api\
   ```

3. Paste your PHP API script files (`db_config.php`, `users.php`, `add_stock.php`, `stock_out.php`, `get_inventory.php`, etc.) into:
   ```
   C:\xampp\htdocs\stockvault\api\
   ```

4. Create `db_config.php` inside `C:\xampp\htdocs\stockvault\api\`:
   ```php
   <?php
   $host = "localhost";
   $user = "root";
   $password = "";
   $dbname = "stockvault";

   $conn = new mysqli($host, $user, $password, $dbname);

   if ($conn->connect_error) {
       die(json_encode(["error" => "Database connection failed: " . $conn->connect_error]));
   }
   header('Content-Type: application/json');
   ?>
   ```

5. Access pre-generated PHP script templates directly in the application's **MySQL & PHP API** view.

6. Test your PHP endpoints in browser or Postman:
   ```
   http://localhost/stockvault/api/users.php
   ```

---

## 🔒 User Roles & Access Scope

- **System Administrator (`ADMIN`)**: Access to all departments, system settings, financial year activations, user provisioning, and organization-wide stock reports.
- **Store Keeper (`STORE_KEEPER`)**: Scoped to their registered department for stock entry, stock dispatch, low stock monitoring, and inventory tracking.
- **Staff Receiver (`STAFF_RECEIVER`)**: Scoped to receiving and signing dispatches for their assigned department.

---

## 🚀 Build for Production Deployment

To build the application for production hosting:

```bash
npm run build
npm start
```

The production build will bundle the backend server into `dist/server.cjs` and compile the frontend static assets ready to serve on port `3000`.

