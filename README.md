# StockVault / IMS Pro - Enterprise Inventory & Audit Management System

An Enterprise Inventory & Audit Compliance Management System built with React, TypeScript, Tailwind CSS, and Node.js (with optional XAMPP Apache + MySQL / PHP support).

---

## 📋 Features

- **Multi-Department RBAC Scope**: Non-admin users are strictly scoped to view and manage inventory for their registered department. System Administrators (`ADMIN`) retain access across all departments.
- **Financial Year Ledger**: Track stock dispatches, valuations, and low-stock alerts tied to active financial year contexts (e.g. `FY 2025-2026`).
- **Dual Digital Signatures**: Secure stock out dispatches with dual signature verification (store keeper + recipient officer).
- **Serial Number Tracking**: Batch and serialized item tracking with barcode/QR code generator.
- **Audit Logs**: Immutable system activity logging tracking user actions, IP logging, and timestamps.
- **PHP & MySQL Integration Ready**: Native DDL schema & PHP REST API templates included for local XAMPP hosting.

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
5. Click on the `stockvault` database, go to the **SQL** tab, and execute the database schema (from `src/data/mysqlSchema.ts` or copy from the **MySQL & PHP API** view in the app):

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
       role ENUM('ADMIN', 'STORE_KEEPER', 'DEPT_OFFICER') NOT NULL,
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

### Step 3 (Optional): Hosting PHP Backend Scripts in XAMPP `htdocs`

If you want to run direct PHP API endpoints alongside XAMPP Apache:

1. Navigate to your XAMPP installation directory (usually `C:\xampp\htdocs\`).
2. Create a folder named `stockvault`:
   ```
   C:\xampp\htdocs\stockvault\api\
   ```
3. Create a `db_config.php` file inside `C:\xampp\htdocs\stockvault\api\`:
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
4. Copy the PHP REST endpoints (available in the **MySQL & PHP API** view in the web app) such as `users.php`, `add_stock.php`, and `stock_out.php` into `C:\xampp\htdocs\stockvault\api\`.
5. Test the PHP REST API endpoint in your browser or Postman:
   ```
   http://localhost/stockvault/api/users.php
   ```

---

## 🔒 User Roles & Access Scope

- **System Administrator (`ADMIN`)**: Access to all departments, system settings, financial year activations, and complete organization stock reports.
- **Store Keeper (`STORE_KEEPER`)**: Restricted to their registered department for stock entry, stock dispatch, and inventory tracking.
- **Department Officer (`DEPT_OFFICER`)**: Restricted to viewing and requesting dispatches for their assigned department.

---

## 🚀 Build for Production Deployment

To build the application for production hosting:

```bash
npm run build
npm start
```

The production build will output bundled assets in `dist/` ready to serve.
