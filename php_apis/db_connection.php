<?php
/**
 * StockVault Enterprise - Database Connection Script (MySQL PDO)
 * File: php_apis/db_connection.php
 */

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-User-Role, X-User-Id');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

$db_host = getenv('DB_HOST') ?: (getenv('MYSQL_HOST') ?: '127.0.0.1');
$db_port = getenv('DB_PORT') ?: (getenv('MYSQL_PORT') ?: '3306');
$db_name = getenv('DB_NAME') ?: (getenv('MYSQL_DATABASE') ?: 'stockvault_db');
$db_user = getenv('DB_USER') ?: (getenv('MYSQL_USER') ?: 'root');
$db_pass = getenv('DB_PASS') ?: (getenv('MYSQL_PASSWORD') ?: '');

try {
    $dsn = "mysql:host={$db_host};port={$db_port};dbname={$db_name};charset=utf8mb4";
    $pdo = new PDO($dsn, $db_user, $db_pass, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);

    // If script is executed directly (e.g. /api/db/status), output status JSON
    $scriptName = basename($_SERVER['SCRIPT_FILENAME'] ?? '');
    if ($scriptName === 'db_connection.php') {
        echo json_encode([
            'success' => true,
            'status' => 'connected',
            'message' => 'MySQL database connection established successfully via PDO (db_connection.php).',
            'database' => $db_name,
            'host' => $db_host,
            'port' => $db_port
        ]);
        exit();
    }
} catch (PDOException $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Database Connection Failed: Unable to connect to MySQL database (' . $e->getMessage() . ')'
    ]);
    exit();
}

/**
 * Helper to record audit log in PHP
 */
function logPhpAudit($pdo, $userId, $action, $entityType, $entityId = null, $newValues = null) {
    try {
        $stmt = $pdo->prepare("
            INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, new_values_json, ip_address)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ");
        $stmt->execute([
            'log-' . time() . '-' . rand(1000, 9999),
            $userId ?? 1,
            $action,
            $entityType,
            $entityId,
            $newValues ? json_encode($newValues) : null,
            $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1'
        ]);
    } catch (Exception $e) {
        // Silently handle audit log errors to prevent blocking main transaction
    }
}


