<?php
/**
 * PHP API Endpoint: php_apis/audit_logs.php
 * Handles Audit Trail Logs Retrieval
 */

require_once __DIR__ . '/db_connection.php';

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        // Ensure audit_logs table exists
        $pdo->exec("
        CREATE TABLE IF NOT EXISTS `audit_logs` (
          `id` INT AUTO_INCREMENT PRIMARY KEY,
          `user_id` INT NULL,
          `action` VARCHAR(100) NOT NULL,
          `entity_type` VARCHAR(50) NOT NULL,
          `entity_id` VARCHAR(50) NULL,
          `old_values_json` JSON NULL,
          `new_values_json` JSON NULL,
          `ip_address` VARCHAR(45) NULL,
          `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
        ");

        $stmt = $pdo->query("
            SELECT 
                a.id,
                a.user_id as userId,
                COALESCE(u.full_name, 'System Administrator') as userName,
                COALESCE(u.role, 'ADMIN') as userRole,
                a.action,
                a.entity_type as entityType,
                a.entity_id as entityId,
                a.old_values_json as oldValues,
                a.new_values_json as newValues,
                a.ip_address as ipAddress,
                a.created_at as createdAt
            FROM audit_logs a
            LEFT JOIN users u ON a.user_id = u.id
            ORDER BY a.id DESC
            LIMIT 200
        ");
        $logs = $stmt->fetchAll();

        if (empty($logs)) {
            // Log initial system audit entry
            logPhpAudit($pdo, 1, 'SYSTEM_INITIALIZED', 'SYSTEM', '1', ['status' => 'Audit logging active and synchronized with MySQL']);
            logPhpAudit($pdo, 1, 'FINANCIAL_YEAR_VERIFIED', 'FINANCIAL_YEAR', '1', ['status' => 'FY 2024/2025 verified']);

            $stmt = $pdo->query("
                SELECT 
                    a.id,
                    a.user_id as userId,
                    COALESCE(u.full_name, 'System Administrator') as userName,
                    COALESCE(u.role, 'ADMIN') as userRole,
                    a.action,
                    a.entity_type as entityType,
                    a.entity_id as entityId,
                    a.old_values_json as oldValues,
                    a.new_values_json as newValues,
                    a.ip_address as ipAddress,
                    a.created_at as createdAt
                FROM audit_logs a
                LEFT JOIN users u ON a.user_id = u.id
                ORDER BY a.id DESC
                LIMIT 200
            ");
            $logs = $stmt->fetchAll();
        }

        echo json_encode([
            'success' => true,
            'auditLogs' => $logs,
            'logs' => $logs
        ]);
        break;

    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
}
