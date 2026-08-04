-- ============================================================================
-- StockVault Enterprise - MySQL Complete Relational Database Schema
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

-- 4. Financial Years Table
CREATE TABLE IF NOT EXISTS `financial_years` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `label` VARCHAR(20) NOT NULL UNIQUE,
  `start_date` DATE NOT NULL,
  `end_date` DATE NOT NULL,
  `is_active` BOOLEAN DEFAULT FALSE,
  `is_closed` BOOLEAN DEFAULT FALSE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 5. Categories Table
CREATE TABLE IF NOT EXISTS `categories` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `code` VARCHAR(20) NOT NULL UNIQUE,
  `name` VARCHAR(100) NOT NULL,
  `description` VARCHAR(255) NULL,
  `is_serialized` BOOLEAN DEFAULT TRUE,
  `reorder_level` INT DEFAULT 10
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

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

-- 11. System Settings Table
CREATE TABLE IF NOT EXISTS `system_settings` (
  `setting_key` VARCHAR(100) PRIMARY KEY,
  `setting_value` TEXT NOT NULL,
  `description` TEXT DEFAULT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

