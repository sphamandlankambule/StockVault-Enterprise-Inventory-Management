<?php
/**
 * PHP API Endpoint: php_apis/settings.php
 * Handles System Configuration Settings with DB Persistence
 */

require_once __DIR__ . '/db_connection.php';

$headers = getallheaders();
$userRole = $headers['X-User-Role'] ?? $headers['x-user-role'] ?? 'ADMIN';
$userId = $headers['X-User-Id'] ?? $headers['x-user-id'] ?? 1;

$method = $_SERVER['REQUEST_METHOD'];

// Ensure system_settings table exists
$pdo->exec("
CREATE TABLE IF NOT EXISTS `system_settings` (
  `setting_key` VARCHAR(100) PRIMARY KEY,
  `setting_value` TEXT NOT NULL,
  `description` TEXT DEFAULT NULL,
  `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
");

// Active FY ID query helper
function getActiveFyId($pdo) {
    $stmt = $pdo->query("SELECT id FROM financial_years WHERE is_active = TRUE LIMIT 1");
    $activeId = $stmt->fetchColumn();
    return $activeId ? intval($activeId) : 1;
}

// Helper to load settings map from DB with defaults
function loadDbSettings($pdo) {
    $defaults = [
        'company_name' => 'StockVault Enterprise Warehouse',
        'currency_code' => 'SZL',
        'currency_symbol' => 'E',
        'currency_name' => 'Eswatini Lilangeni',
        'low_stock_global_threshold' => '5',
        'require_dual_signatures' => '1',
        'php_api_base_url' => 'http://localhost/stockvault/api',
        'php_bridge_mode' => '1'
    ];

    $stmt = $pdo->query("SELECT setting_key, setting_value FROM system_settings");
    $rows = $stmt->fetchAll();
    $dbMap = [];
    foreach ($rows as $r) {
        $dbMap[$r['setting_key']] = $r['setting_value'];
    }

    $merged = array_merge($defaults, $dbMap);
    $activeFyId = getActiveFyId($pdo);

    return [
        'companyName' => $merged['company_name'],
        'currencyCode' => $merged['currency_code'],
        'currencySymbol' => $merged['currency_symbol'],
        'currencyName' => $merged['currency_name'],
        'lowStockGlobalThreshold' => intval($merged['low_stock_global_threshold']),
        'requireDualSignatures' => ($merged['require_dual_signatures'] === '1' || $merged['require_dual_signatures'] === 'true'),
        'phpApiBaseUrl' => $merged['php_api_base_url'],
        'phpBridgeMode' => ($merged['php_bridge_mode'] === '1' || $merged['php_bridge_mode'] === 'true'),
        'activeFinancialYearId' => $activeFyId
    ];
}

// Helper to save settings map to DB
function saveDbSettings($pdo, $input) {
    $updates = [];
    if (isset($input['companyName'])) $updates['company_name'] = trim($input['companyName']);
    if (isset($input['currencyCode'])) $updates['currency_code'] = trim($input['currencyCode']);
    if (isset($input['currencySymbol'])) $updates['currency_symbol'] = trim($input['currencySymbol']);
    if (isset($input['currencyName'])) $updates['currency_name'] = trim($input['currencyName']);
    if (isset($input['lowStockGlobalThreshold'])) $updates['low_stock_global_threshold'] = strval(intval($input['lowStockGlobalThreshold']));
    if (isset($input['requireDualSignatures'])) $updates['require_dual_signatures'] = !empty($input['requireDualSignatures']) ? '1' : '0';
    if (isset($input['phpApiBaseUrl'])) $updates['php_api_base_url'] = trim($input['phpApiBaseUrl']);
    if (isset($input['phpBridgeMode'])) $updates['php_bridge_mode'] = !empty($input['phpBridgeMode']) ? '1' : '0';

    $stmt = $pdo->prepare("INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)");
    foreach ($updates as $k => $v) {
        $stmt->execute([$k, $v]);
    }

    return loadDbSettings($pdo);
}

switch ($method) {
    case 'GET':
        $settings = loadDbSettings($pdo);
        echo json_encode(['success' => true, 'settings' => $settings]);
        break;

    case 'PUT':
        if ($userRole !== 'ADMIN') {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Forbidden: Admin privilege required']);
            exit();
        }

        $input = json_decode(file_get_contents('php://input'), true) ?? [];
        $settings = saveDbSettings($pdo, $input);

        logPhpAudit($pdo, $userId, 'SYSTEM_SETTINGS_UPDATED', 'SETTINGS', 1, $settings);

        echo json_encode(['success' => true, 'settings' => $settings, 'message' => 'Settings updated successfully']);
        break;

    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
}
