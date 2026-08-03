<?php
/**
 * PHP API Endpoint: php_apis/settings.php
 * Handles System Configuration Settings
 */

require_once __DIR__ . '/db_connection.php';

$headers = getallheaders();
$userRole = $headers['X-User-Role'] ?? $headers['x-user-role'] ?? 'ADMIN';
$userId = $headers['X-User-Id'] ?? $headers['x-user-id'] ?? 1;

$method = $_SERVER['REQUEST_METHOD'];

// Active FY ID query helper
function getActiveFyId($pdo) {
    $stmt = $pdo->query("SELECT id FROM financial_years WHERE is_active = TRUE LIMIT 1");
    $activeId = $stmt->fetchColumn();
    return $activeId ? intval($activeId) : 1;
}

switch ($method) {
    case 'GET':
        $activeFyId = getActiveFyId($pdo);
        
        $settings = [
            'lowStockGlobalThreshold' => 5,
            'activeFinancialYearId' => $activeFyId,
            'companyName' => 'StockVault Enterprise Warehouse',
            'requireDualSignatures' => true,
            'currencyCode' => 'SZL',
            'currencySymbol' => 'E',
            'currencyName' => 'Eswatini Lilangeni',
            'phpApiBaseUrl' => 'http://localhost/stockvault/api',
            'phpBridgeMode' => true
        ];

        echo json_encode(['success' => true, 'settings' => $settings]);
        break;

    case 'PUT':
        if ($userRole !== 'ADMIN') {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Forbidden: Admin privilege required']);
            exit();
        }

        $input = json_decode(file_get_contents('php://input'), true);
        $activeFyId = getActiveFyId($pdo);

        $settings = [
            'lowStockGlobalThreshold' => intval($input['lowStockGlobalThreshold'] ?? 5),
            'activeFinancialYearId' => intval($input['activeFinancialYearId'] ?? $activeFyId),
            'companyName' => trim($input['companyName'] ?? 'StockVault Enterprise Warehouse'),
            'requireDualSignatures' => isset($input['requireDualSignatures']) ? boolval($input['requireDualSignatures']) : true,
            'currencyCode' => trim($input['currencyCode'] ?? 'SZL'),
            'currencySymbol' => trim($input['currencySymbol'] ?? 'E'),
            'currencyName' => trim($input['currencyName'] ?? 'Eswatini Lilangeni'),
            'phpApiBaseUrl' => trim($input['phpApiBaseUrl'] ?? 'http://localhost/stockvault/api'),
            'phpBridgeMode' => true
        ];

        logPhpAudit($pdo, $userId, 'SYSTEM_SETTINGS_UPDATED', 'SETTINGS', 1, $settings);

        echo json_encode(['success' => true, 'settings' => $settings, 'message' => 'Settings updated successfully']);
        break;

    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
}
