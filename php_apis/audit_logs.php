<?php
/**
 * PHP API Endpoint: php_apis/audit_logs.php
 * Handles Audit Trail Logs Retrieval
 */

require_once __DIR__ . '/db_connection.php';

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $stmt = $pdo->query("
            SELECT 
                a.id,
                a.user_id as userId,
                u.full_name as userName,
                u.username,
                a.action,
                a.entity_type as entityType,
                a.entity_id as entityId,
                a.new_values_json as newValuesJson,
                a.ip_address as ipAddress,
                a.created_at as createdAt
            FROM audit_logs a
            LEFT JOIN users u ON a.user_id = u.id
            ORDER BY a.id DESC
            LIMIT 200
        ");
        $logs = $stmt->fetchAll();

        echo json_encode(['success' => true, 'auditLogs' => $logs]);
        break;

    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
}
