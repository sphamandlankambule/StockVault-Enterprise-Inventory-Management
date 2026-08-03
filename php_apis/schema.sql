-- ============================================================================
-- StockVault Enterprise - MySQL Complete Relational Database Schema & Seeds
-- File: php_apis/schema.sql
-- ============================================================================

CREATE DATABASE IF NOT EXISTS `stockvault_db` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `stockvault_db`;

-- 1. Departments Table
CREATE TABLE IF NOT EXISTS `departments` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `code` VARCHAR(20) NOT NULL UNIQUE,
  `name` VARCHAR(100) NOT NULL,
  `description` TEXT NULL,
  `is_active` BOOLEAN DEFAULT TRUE,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `departments` (`id`, `code`, `name`, `description`) VALUES
(1, 'DEP-HQ', 'Corporate HQ Store Vault', 'Central main distribution warehouse'),
(2, 'DEP-IT', 'Information Technology', 'IT hardware, computing equipment & networking'),
(3, 'DEP-FIN', 'Finance & Accounting', 'Financial records, ledgers & audit equipment')
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- 2. Roles Table
CREATE TABLE IF NOT EXISTS `roles` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(50) NOT NULL UNIQUE,
  `description` VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `roles` (`id`, `name`, `description`) VALUES
(1, 'ADMIN', 'System Director with full administrative permissions'),
(2, 'STORE_KEEPER', 'Chief Store Keeper with Stock In/Out and inventory authority'),
(3, 'STAFF_RECEIVER', 'Staff Lead authorized to request and receive department inventory')
ON DUPLICATE KEY UPDATE `description` = VALUES(`description`);

-- 3. Users Table
CREATE TABLE IF NOT EXISTS `users` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `role_id` INT NOT NULL,
  `department_id` INT NOT NULL,
  `username` VARCHAR(50) NOT NULL UNIQUE,
  `full_name` VARCHAR(100) NOT NULL,
  `email` VARCHAR(150) NOT NULL UNIQUE,
  `password_hash` VARCHAR(255) NOT NULL,
  `status` ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE',
  `created_by` INT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`role_id`) REFERENCES `roles`(`id`),
  FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Passwords (plain text => bcrypt $2y$10$ hash):
-- Admin  => Admin@123  => $2y$10$HiSYb6f1bJKTzQ9thXmdfuiKvzpZnAgpTw1CYHuJLS3SezUzmKeva
-- Keeper => Keeper@123 => $2y$10$19.XVz15w5pXswdxDuCWIe.wHZo8zGe5FoyWKcffD3/bUWFEg53OW
-- Staff  => Staff@123  => $2y$10$BiuCHVJTzn3hb/pPJrfJZOKQFn9uSX9kV4rkY0V7uH.4rIFmdhFIq
INSERT INTO `users` (`id`, `role_id`, `department_id`, `username`, `full_name`, `email`, `password_hash`, `status`) VALUES
(1, 1, 1, 'Admin', 'David Sterling (System Director)', 'admin@stockvault.com', '$2y$10$HiSYb6f1bJKTzQ9thXmdfuiKvzpZnAgpTw1CYHuJLS3SezUzmKeva', 'ACTIVE'),
(2, 2, 2, 'Keeper', 'Marcus Vance (Chief Store Keeper)', 'marcus.vance@stockvault.com', '$2y$10$19.XVz15w5pXswdxDuCWIe.wHZo8zGe5FoyWKcffD3/bUWFEg53OW', 'ACTIVE'),
(3, 3, 3, 'Staff', 'Sarah Jenkins (Finance Lead Receiver)', 'sarah.jenkins@stockvault.com', '$2y$10$BiuCHVJTzn3hb/pPJrfJZOKQFn9uSX9kV4rkY0V7uH.4rIFmdhFIq', 'ACTIVE')
ON DUPLICATE KEY UPDATE `password_hash` = VALUES(`password_hash`), `full_name` = VALUES(`full_name`);

-- 4. Financial Years Table
CREATE TABLE IF NOT EXISTS `financial_years` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `label` VARCHAR(20) NOT NULL UNIQUE,
  `start_date` DATE NOT NULL,
  `end_date` DATE NOT NULL,
  `is_active` BOOLEAN DEFAULT FALSE,
  `is_closed` BOOLEAN DEFAULT FALSE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `financial_years` (`id`, `label`, `start_date`, `end_date`, `is_active`, `is_closed`) VALUES
(1, 'FY 2025-2026', '2025-04-01', '2026-03-31', TRUE, FALSE),
(2, 'FY 2024-2025', '2024-04-01', '2025-03-31', FALSE, TRUE)
ON DUPLICATE KEY UPDATE `is_active` = VALUES(`is_active`);

-- 5. Categories Table
CREATE TABLE IF NOT EXISTS `categories` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `code` VARCHAR(20) NOT NULL UNIQUE,
  `name` VARCHAR(100) NOT NULL,
  `description` VARCHAR(255) NULL,
  `is_serialized` BOOLEAN DEFAULT TRUE,
  `reorder_level` INT DEFAULT 10
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `categories` (`id`, `code`, `name`, `description`, `is_serialized`, `reorder_level`) VALUES
(1, 'CAT-LAPTOP', 'Enterprise Laptops', 'High-performance workstation laptops', TRUE, 5),
(2, 'CAT-SERVERS', 'Rack Servers & Network Switches', 'Data center enterprise gear', TRUE, 2),
(3, 'CAT-MONITOR', '4K Workstation Displays', '27" and 32" color-calibrated monitors', TRUE, 8),
(4, 'CAT-CABLE', 'Ethernet & Fiber Cabling', 'Network cabling rolls and patch cords', FALSE, 20)
ON DUPLICATE KEY UPDATE `name` = VALUES(`name`);

-- 6. Stock Batches Table
CREATE TABLE IF NOT EXISTS `stock_batches` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `batch_number` VARCHAR(50) NOT NULL UNIQUE,
  `category_id` INT NOT NULL,
  `department_id` INT NOT NULL,
  `financial_year_id` INT NOT NULL,
  `supplier_name` VARCHAR(100) NOT NULL,
  `unit_cost` DECIMAL(12, 2) NOT NULL,
  `is_serialized` BOOLEAN DEFAULT TRUE,
  `total_quantity` INT NOT NULL,
  `available_quantity` INT NOT NULL,
  `status` ENUM('ACTIVE', 'DEPLETED', 'DECOMMISSIONED') DEFAULT 'ACTIVE',
  `received_by_user_id` INT NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`),
  FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`),
  FOREIGN KEY (`financial_year_id`) REFERENCES `financial_years`(`id`),
  FOREIGN KEY (`received_by_user_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `stock_batches` (`id`, `batch_number`, `category_id`, `department_id`, `financial_year_id`, `supplier_name`, `unit_cost`, `is_serialized`, `total_quantity`, `available_quantity`, `status`, `received_by_user_id`) VALUES
(1, 'BATCH-2025-001', 1, 1, 1, 'Lenovo Enterprise Direct', 18500.00, TRUE, 5, 3, 'ACTIVE', 2),
(2, 'BATCH-2025-002', 2, 2, 1, 'Dell PowerEdge Systems', 85000.00, TRUE, 2, 1, 'ACTIVE', 2),
(3, 'BATCH-2025-003', 4, 1, 1, 'Cisco Cabling & Infra Supplies', 450.00, FALSE, 100, 75, 'ACTIVE', 2)
ON DUPLICATE KEY UPDATE `available_quantity` = VALUES(`available_quantity`);

-- 7. Inventory Items Table (Serialized Items)
CREATE TABLE IF NOT EXISTS `inventory_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `batch_id` INT NOT NULL,
  `item_code` VARCHAR(50) NOT NULL UNIQUE,
  `serial_number` VARCHAR(100) NOT NULL UNIQUE,
  `category_id` INT NOT NULL,
  `department_id` INT NOT NULL,
  `financial_year_id` INT NOT NULL,
  `status` ENUM('IN_STOCK', 'ISSUED', 'MAINTENANCE', 'DECOMMISSIONED') DEFAULT 'IN_STOCK',
  `unit_cost` DECIMAL(12, 2) NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`batch_id`) REFERENCES `stock_batches`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`category_id`) REFERENCES `categories`(`id`),
  FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`),
  FOREIGN KEY (`financial_year_id`) REFERENCES `financial_years`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `inventory_items` (`id`, `batch_id`, `item_code`, `serial_number`, `category_id`, `department_id`, `financial_year_id`, `status`, `unit_cost`) VALUES
(1, 1, 'CAT-LAPTOP-000001', 'LNV-TP-99201', 1, 1, 1, 'IN_STOCK', 18500.00),
(2, 1, 'CAT-LAPTOP-000002', 'LNV-TP-99202', 1, 1, 1, 'IN_STOCK', 18500.00),
(3, 1, 'CAT-LAPTOP-000003', 'LNV-TP-99203', 1, 1, 1, 'IN_STOCK', 18500.00),
(4, 1, 'CAT-LAPTOP-000004', 'LNV-TP-99204', 1, 1, 1, 'ISSUED', 18500.00),
(5, 1, 'CAT-LAPTOP-000005', 'LNV-TP-99205', 1, 1, 1, 'ISSUED', 18500.00),
(6, 2, 'CAT-SERVERS-000001', 'DELL-PE-8801', 2, 2, 1, 'IN_STOCK', 85000.00),
(7, 2, 'CAT-SERVERS-000002', 'DELL-PE-8802', 2, 2, 1, 'ISSUED', 85000.00)
ON DUPLICATE KEY UPDATE `status` = VALUES(`status`);

-- 8. Stock Transactions Table
CREATE TABLE IF NOT EXISTS `stock_transactions` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `transaction_code` VARCHAR(50) NOT NULL UNIQUE,
  `type` ENUM('STOCK_IN', 'STOCK_OUT', 'TRANSFER', 'ADJUSTMENT') NOT NULL,
  `batch_id` INT NOT NULL,
  `item_id` INT NULL,
  `financial_year_id` INT NOT NULL,
  `department_id` INT NOT NULL,
  `quantity` INT NOT NULL,
  `unit_cost` DECIMAL(12, 2) NOT NULL,
  `total_value` DECIMAL(14, 2) NOT NULL,
  `issued_by_user_id` INT NOT NULL,
  `received_by_name` VARCHAR(100) NOT NULL,
  `receiver_department_id` INT NOT NULL,
  `remarks` TEXT NULL,
  `ip_address` VARCHAR(45) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`batch_id`) REFERENCES `stock_batches`(`id`),
  FOREIGN KEY (`item_id`) REFERENCES `inventory_items`(`id`),
  FOREIGN KEY (`financial_year_id`) REFERENCES `financial_years`(`id`),
  FOREIGN KEY (`department_id`) REFERENCES `departments`(`id`),
  FOREIGN KEY (`issued_by_user_id`) REFERENCES `users`(`id`),
  FOREIGN KEY (`receiver_department_id`) REFERENCES `departments`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `stock_transactions` (`id`, `transaction_code`, `type`, `batch_id`, `item_id`, `financial_year_id`, `department_id`, `quantity`, `unit_cost`, `total_value`, `issued_by_user_id`, `received_by_name`, `receiver_department_id`, `remarks`) VALUES
(1, 'TX-IN-2025-001', 'STOCK_IN', 1, NULL, 1, 1, 5, 18500.00, 92500.00, 2, 'Marcus Vance', 1, 'Initial batch intake for FY 2025-2026 ThinkPad Laptops'),
(2, 'TX-OUT-2025-001', 'STOCK_OUT', 1, 4, 1, 1, 1, 18500.00, 18500.00, 2, 'Sarah Jenkins', 3, 'Issued ThinkPad LNV-TP-99204 to Finance Department'),
(3, 'TX-OUT-2025-002', 'STOCK_OUT', 1, 5, 1, 1, 1, 18500.00, 18500.00, 2, 'Sarah Jenkins', 3, 'Issued ThinkPad LNV-TP-99205 to Finance Department')
ON DUPLICATE KEY UPDATE `transaction_code` = VALUES(`transaction_code`);

-- 9. Dual Signatures Table
CREATE TABLE IF NOT EXISTS `signatures` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `transaction_id` INT NOT NULL UNIQUE,
  `issuer_signature_base64` MEDIUMTEXT NOT NULL,
  `issuer_name` VARCHAR(100) NOT NULL,
  `issuer_role` VARCHAR(50) NOT NULL,
  `receiver_signature_base64` MEDIUMTEXT NOT NULL,
  `receiver_name` VARCHAR(100) NOT NULL,
  `receiver_role` VARCHAR(50) NOT NULL,
  `ip_address` VARCHAR(45) NOT NULL,
  `device_timestamp` DATETIME NOT NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`transaction_id`) REFERENCES `stock_transactions`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 10. Audit Logs Table
CREATE TABLE IF NOT EXISTS `audit_logs` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `user_id` INT NULL,
  `action` VARCHAR(100) NOT NULL,
  `entity_type` VARCHAR(50) NOT NULL,
  `entity_id` VARCHAR(50) NULL,
  `new_values_json` JSON NULL,
  `ip_address` VARCHAR(45) NULL,
  `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
