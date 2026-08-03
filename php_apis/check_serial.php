<?php
/**
 * PHP API Endpoint: php_apis/check_serial.php
 * Checks if a serial number already exists in inventory_items
 */

require_once __DIR__ . '/db_connection.php';

$serial = trim($_GET['serial'] ?? '');

if (empty($serial)) {
    echo json_encode(['exists' => false]);
    exit();
}

$stmt = $pdo->prepare("SELECT id, status FROM inventory_items WHERE serial_number = ?");
$stmt->execute([$serial]);
$item = $stmt->fetch();

if ($item) {
    echo json_encode([
        'exists' => true,
        'status' => $item['status'],
        'warning' => "Serial '{$serial}' is already registered in DB with status: {$item['status']}"
    ]);
} else {
    echo json_encode(['exists' => false]);
}
