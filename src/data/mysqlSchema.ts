export const MYSQL_SCHEMA_DDL = `-- ============================================================================
-- StockVault Enterprise Inventory Management System - MySQL Database Schema
-- Version: 2.5.0
-- Compliant with Financial Year Separation, Serialized Tracking & Dual-Signature Audit
-- ============================================================================

CREATE DATABASE IF NOT EXISTS \`stockvault_db\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE \`stockvault_db\`;

-- ----------------------------------------------------------------------------
-- Table 1: Roles (Role-Based Access Control)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS \`roles\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`name\` VARCHAR(50) NOT NULL UNIQUE,
  \`description\` VARCHAR(255) DEFAULT NULL,
  \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO \`roles\` (\`id\`, \`name\`, \`description\`) VALUES
(1, 'ADMIN', 'Full system control, user provisioning, master configurations'),
(2, 'STORE_KEEPER', 'Stock in, stock out dispatch, dual signature capture, status updates'),
(3, 'STAFF_RECEIVER', 'Receive dispatched goods, view department inventory reports')
ON DUPLICATE KEY UPDATE \`description\` = VALUES(\`description\`);

-- ----------------------------------------------------------------------------
-- Table 2: Departments
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS \`departments\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`code\` VARCHAR(20) NOT NULL UNIQUE,
  \`name\` VARCHAR(100) NOT NULL,
  \`description\` TEXT DEFAULT NULL,
  \`budget_code\` VARCHAR(50) DEFAULT NULL,
  \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO \`departments\` (\`code\`, \`name\`, \`budget_code\`) VALUES
('IT', 'Information Technology', 'BUG-IT-2025'),
('LOG', 'Logistics & Warehouse', 'BUG-LOG-2025'),
('FIN', 'Finance & Accounting', 'BUG-FIN-2025'),
('HR', 'Human Resources', 'BUG-HR-2025'),
('OPS', 'Operations & Facilities', 'BUG-OPS-2025')
ON DUPLICATE KEY UPDATE \`name\` = VALUES(\`name\`);

-- ----------------------------------------------------------------------------
-- Table 3: Categories
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS \`categories\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`code\` VARCHAR(20) NOT NULL UNIQUE,
  \`name\` VARCHAR(100) NOT NULL,
  \`description\` TEXT DEFAULT NULL,
  \`low_stock_threshold\` INT DEFAULT 5,
  \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO \`categories\` (\`code\`, \`name\`, \`low_stock_threshold\`) VALUES
('COMP', 'Computers & Laptops', 5),
('NET', 'Networking Equipment', 3),
('PRN', 'Printers & Cartridges', 10),
('STAT', 'Office Stationery', 25),
('FUR', 'Furniture & Fixtures', 4)
ON DUPLICATE KEY UPDATE \`name\` = VALUES(\`name\`);

-- ----------------------------------------------------------------------------
-- Table 4: Financial Years
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS \`financial_years\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`year_code\` VARCHAR(20) NOT NULL UNIQUE, -- e.g. "2025-2026"
  \`start_date\` DATE NOT NULL,
  \`end_date\` DATE NOT NULL,
  \`is_active\` BOOLEAN DEFAULT FALSE,
  \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO \`financial_years\` (\`year_code\`, \`start_date\`, \`end_date\`, \`is_active\`) VALUES
('2024-2025', '2024-04-01', '2025-03-31', FALSE),
('2025-2026', '2025-04-01', '2026-03-31', TRUE),
('2026-2027', '2026-04-01', '2027-03-31', FALSE)
ON DUPLICATE KEY UPDATE \`is_active\` = VALUES(\`is_active\`);

-- ----------------------------------------------------------------------------
-- Table 5: Users (Admin-Managed Only - System Locked Authentication)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS \`users\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`role_id\` INT NOT NULL,
  \`department_id\` INT NOT NULL,
  \`username\` VARCHAR(50) NOT NULL UNIQUE,
  \`full_name\` VARCHAR(100) NOT NULL,
  \`email\` VARCHAR(150) NOT NULL UNIQUE,
  \`password_hash\` VARCHAR(255) NOT NULL,
  \`status\` ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE',
  \`created_by\` INT DEFAULT NULL,
  \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (\`role_id\`) REFERENCES \`roles\`(\`id\`),
  FOREIGN KEY (\`department_id\`) REFERENCES \`departments\`(\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed Default Admin & System Users
-- Passwords: Admin => Admin@123 | Keeper => Keeper@123 | Staff => Staff@123
INSERT INTO \`users\` (\`id\`, \`role_id\`, \`department_id\`, \`username\`, \`full_name\`, \`email\`, \`password_hash\`, \`status\`) VALUES
(1, 1, 1, 'Admin', 'David Sterling (System Director)', 'admin@stockvault.com', '$2y$10$HiSYb6f1bJKTzQ9thXmdfuiKvzpZnAgpTw1CYHuJLS3SezUzmKeva', 'ACTIVE'),
(2, 2, 2, 'Keeper', 'Marcus Vance (Chief Store Keeper)', 'marcus.vance@stockvault.com', '$2y$10$19.XVz15w5pXswdxDuCWIe.wHZo8zGe5FoyWKcffD3/bUWFEg53OW', 'ACTIVE'),
(3, 3, 3, 'Staff', 'Sarah Jenkins (Finance Lead Receiver)', 'sarah.jenkins@stockvault.com', '$2y$10$BiuCHVJTzn3hb/pPJrfJZOKQFn9uSX9kV4rkY0V7uH.4rIFmdhFIq', 'ACTIVE')
ON DUPLICATE KEY UPDATE \`password_hash\` = VALUES(\`password_hash\`), \`full_name\` = VALUES(\`full_name\`);

-- ----------------------------------------------------------------------------
-- Table 6: Stock Batches (Incoming Stock Lots)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS \`stock_batches\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`batch_number\` VARCHAR(50) NOT NULL UNIQUE,
  \`category_id\` INT NOT NULL,
  \`department_id\` INT NOT NULL,
  \`financial_year_id\` INT NOT NULL,
  \`supplier_name\` VARCHAR(150) NOT NULL,
  \`unit_cost\` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  \`is_serialized\` BOOLEAN DEFAULT FALSE,
  \`total_quantity\` INT NOT NULL DEFAULT 0,
  \`available_quantity\` INT NOT NULL DEFAULT 0,
  \`received_by_user_id\` INT NOT NULL,
  \`status\` ENUM('ACTIVE', 'DEPLETED', 'CLOSED') DEFAULT 'ACTIVE',
  \`remarks\` TEXT DEFAULT NULL,
  \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (\`category_id\`) REFERENCES \`categories\`(\`id\`),
  FOREIGN KEY (\`department_id\`) REFERENCES \`departments\`(\`id\`),
  FOREIGN KEY (\`financial_year_id\`) REFERENCES \`financial_years\`(\`id\`),
  FOREIGN KEY (\`received_by_user_id\`) REFERENCES \`users\`(\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- Table 7: Inventory Items (Individual Serialized/Non-Serialized Lifecycle)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS \`inventory_items\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`batch_id\` INT NOT NULL,
  \`item_code\` VARCHAR(50) NOT NULL,
  \`serial_number\` VARCHAR(100) DEFAULT NULL,
  \`category_id\` INT NOT NULL,
  \`department_id\` INT NOT NULL,
  \`financial_year_id\` INT NOT NULL,
  \`status\` ENUM('IN_STOCK', 'ISSUED', 'UNDER_MAINTENANCE', 'DECOMMISSIONED') DEFAULT 'IN_STOCK',
  \`unit_cost\` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  \`location\` VARCHAR(100) DEFAULT 'Main Warehouse',
  \`notes\` TEXT DEFAULT NULL,
  \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (\`batch_id\`) REFERENCES \`stock_batches\`(\`id\`),
  FOREIGN KEY (\`category_id\`) REFERENCES \`categories\`(\`id\`),
  FOREIGN KEY (\`department_id\`) REFERENCES \`departments\`(\`id\`),
  FOREIGN KEY (\`financial_year_id\`) REFERENCES \`financial_years\`(\`id\`),
  UNIQUE KEY \`uk_serial_active\` (\`serial_number\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- Table 8: Stock Transactions (Issuance, Dispatches & Replenishment)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS \`stock_transactions\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`transaction_code\` VARCHAR(50) NOT NULL UNIQUE,
  \`type\` ENUM('STOCK_IN', 'STOCK_OUT', 'REPLENISHMENT', 'STATUS_CHANGE', 'DECOMMISSION') NOT NULL,
  \`batch_id\` INT DEFAULT NULL,
  \`item_id\` INT DEFAULT NULL,
  \`financial_year_id\` INT NOT NULL,
  \`department_id\` INT NOT NULL, -- Originating department
  \`quantity\` INT NOT NULL DEFAULT 1,
  \`unit_cost\` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  \`total_value\` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  \`issued_by_user_id\` INT NOT NULL,
  \`received_by_name\` VARCHAR(100) NOT NULL,
  \`receiver_department_id\` INT NOT NULL,
  \`remarks\` TEXT DEFAULT NULL,
  \`ip_address\` VARCHAR(45) NOT NULL,
  \`timestamp\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (\`batch_id\`) REFERENCES \`stock_batches\`(\`id\`),
  FOREIGN KEY (\`item_id\`) REFERENCES \`inventory_items\`(\`id\`),
  FOREIGN KEY (\`financial_year_id\`) REFERENCES \`financial_years\`(\`id\`),
  FOREIGN KEY (\`department_id\`) REFERENCES \`departments\`(\`id\`),
  FOREIGN KEY (\`receiver_department_id\`) REFERENCES \`departments\`(\`id\`),
  FOREIGN KEY (\`issued_by_user_id\`) REFERENCES \`users\`(\`id\`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- Table 9: Signatures (Dual-Signature Non-Repudiation Audit)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS \`signatures\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`transaction_id\` INT NOT NULL,
  \`issuer_signature_base64\` LONGTEXT NOT NULL,
  \`issuer_name\` VARCHAR(100) NOT NULL,
  \`issuer_role\` VARCHAR(50) NOT NULL,
  \`receiver_signature_base64\` LONGTEXT NOT NULL,
  \`receiver_name\` VARCHAR(100) NOT NULL,
  \`receiver_role\` VARCHAR(50) NOT NULL,
  \`ip_address\` VARCHAR(45) NOT NULL,
  \`device_timestamp\` VARCHAR(50) NOT NULL,
  \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (\`transaction_id\`) REFERENCES \`stock_transactions\`(\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- Table 10: Audit Logs (Immutable Accountability Log)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS \`audit_logs\` (
  \`id\` INT AUTO_INCREMENT PRIMARY KEY,
  \`user_id\` INT DEFAULT NULL,
  \`user_name\` VARCHAR(100) NOT NULL,
  \`user_role\` VARCHAR(50) NOT NULL,
  \`action\` VARCHAR(100) NOT NULL,
  \`entity_type\` VARCHAR(50) NOT NULL,
  \`entity_id\` VARCHAR(50) NOT NULL,
  \`old_values_json\` JSON DEFAULT NULL,
  \`new_values_json\` JSON DEFAULT NULL,
  \`ip_address\` VARCHAR(45) NOT NULL,
  \`user_agent\` TEXT DEFAULT NULL,
  \`created_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------------------------------------------------------
-- Table 11: System Settings
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS \`system_settings\` (
  \`setting_key\` VARCHAR(100) PRIMARY KEY,
  \`setting_value\` TEXT NOT NULL,
  \`description\` TEXT DEFAULT NULL,
  \`updated_at\` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO \`system_settings\` (\`setting_key\`, \`setting_value\`, \`description\`) VALUES
('low_stock_global_threshold', '5', 'Default minimum stock units trigger threshold'),
('require_dual_signatures', '1', 'Mandate both issuer and receiver signatures on stock out'),
('company_name', 'StockVault Enterprise Systems', 'Organization name for PDF reports')
ON DUPLICATE KEY UPDATE \`setting_value\` = VALUES(\`setting_value\`);
`;
