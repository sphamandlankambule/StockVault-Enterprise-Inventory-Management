# StockVault Enterprise - PHP API Suite

This directory (`/php_apis`) contains the PHP backend API endpoints and MySQL schema for the StockVault Enterprise Inventory & Audit Management System.

---

## 📁 Directory Structure

```
php_apis/
├── db_connection.php   # PDO Database connection & CORS configuration
├── auth.php            # User authentication, login, password change & resets
├── users.php           # Admin-only user provisioning & status toggling
├── add_stock.php       # Stock In registration & serial duplicate checks
├── stock_out.php       # Stock Out dispatch with dual signature recording
├── reports.php         # Financial Year & Department valuation reporting
├── schema.sql          # Full MySQL DDL schema and initial seed data
└── README.md           # Documentation and setup instructions
```

---

## ⚙️ Requirements & Environment Variables

- **PHP**: 7.4 or 8.x with `pdo_mysql` enabled
- **MySQL / MariaDB**: 5.7+ or 8.0+

### Environment Variables (optional, defaults to local):
```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_NAME=stockvault_db
DB_USER=root
DB_PASS=
```

---

## 🚀 Quick Setup Instructions

1. **Import Database Schema**:
   Run the following MySQL command or import `schema.sql` via phpMyAdmin / MySQL Workbench:
   ```bash
   mysql -u root -p < php_apis/schema.sql
   ```

2. **Configure Connection**:
   Update `db_connection.php` credentials or set the environment variables above.

3. **Deploy API Files**:
   Copy the contents of `php_apis/` into your Web Server document root (e.g. `/var/www/html/stockvault/api/` or `C:\xampp\htdocs\stockvault\api\`).

---

## 🔑 Default Seed Credentials

| Role | Username | Password | Email |
| :--- | :--- | :--- | :--- |
| **System Admin** | `Admin` | `Admin@123` | `admin@stockvault.com` |
| **Store Keeper** | `Keeper` | `Keeper@123` | `marcus.vance@stockvault.com` |
| **Staff Receiver** | `Staff` | `Staff@123` | `sarah.jenkins@stockvault.com` |

---

## 🔐 Key Features Included

- **Serial Duplication Shield**: Pre-checks serial numbers before committing stock batches to prevent duplicates.
- **Dual Signature Recording**: Base64 image signature capture for store keepers and receivers during dispatches.
- **Admin Password Control**: Admins can reset user passwords directly, and users can update their own passwords.
- **Structured Audit Logging**: Every transaction and login attempt is logged with IP addresses.
