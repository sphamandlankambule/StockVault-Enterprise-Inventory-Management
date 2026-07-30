<?php
/**
 * PHP API Endpoint: php_apis/add_stock.php
 * Handles Stock In Registration with Serial Duplication Validation
 */

require_once __DIR__ . '/db_connection.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed. Use POST.']);
    exit();
}

$input = json_decode(file_get_contents('php://input'), true);

if (empty($input['categoryId']) || empty($input['departmentId']) || empty($input['financialYearId'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing required parameter fields']);
    exit();
}

$pdo->beginTransaction();

try {
    $batchNumber = 'BAT-' . date('Ymd') . '-' . rand(1000, 9999);
    $categoryId = $input['categoryId'];
    $departmentId = $input['departmentId'];
    $financialYearId = $input['financialYearId'];
    $supplierName = trim($input['supplierName'] ?? 'General Supplier');
    $unitCost = floatval($input['unitCost'] ?? 0);
    $isSerialized = !empty($input['isSerialized']);
    $serials = $input['serials'] ?? [];
    $quantity = $isSerialized ? count($serials) : intval($input['quantity'] ?? 1);
    $receivedBy = $input['receivedByUserId'] ?? 1;

    // 1. Serial Number Duplication Check
    if ($isSerialized && !empty($serials)) {
        $inClause = implode(',', array_fill(0, count($serials), '?'));
        $chkStmt = $pdo->prepare("SELECT serial_number FROM inventory_items WHERE serial_number IN ($inClause) AND status != 'DECOMMISSIONED'");
        $chkStmt->execute($serials);
        $existing = $chkStmt->fetchAll(PDO::FETCH_COLUMN);

        if (!empty($existing)) {
            $pdo->rollBack();
            http_response_code(422);
            echo json_encode([
                'success' => false,
                'error' => 'Duplicate serial numbers detected in system database',
                'duplicates' => $existing
            ]);
            exit();
        }
    }

    // 2. Insert Stock Batch
    $batchStmt = $pdo->prepare("
        INSERT INTO stock_batches (batch_number, category_id, department_id, financial_year_id, supplier_name, unit_cost, is_serialized, total_quantity, available_quantity, received_by_user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $batchStmt->execute([
        $batchNumber, $categoryId, $departmentId, $financialYearId, $supplierName, $unitCost, $isSerialized ? 1 : 0, $quantity, $quantity, $receivedBy
    ]);
    $batchId = $pdo->lastInsertId();

    // 3. Insert Serialized Inventory Items
    if ($isSerialized) {
        $itemStmt = $pdo->prepare("
            INSERT INTO inventory_items (batch_id, item_code, serial_number, category_id, department_id, financial_year_id, status, unit_cost)
            VALUES (?, ?, ?, ?, ?, ?, 'IN_STOCK', ?)
        ");
        foreach ($serials as $idx => $sn) {
            $itemCode = 'ITM-' . date('Y') . '-' . str_pad($batchId, 4, '0', STR_PAD_LEFT) . '-' . str_pad($idx + 1, 3, '0', STR_PAD_LEFT);
            $itemStmt->execute([$batchId, $itemCode, trim($sn), $categoryId, $departmentId, $financialYearId, $unitCost]);
        }
    }

    // 4. Record Stock In Transaction
    $txCode = 'TX-IN-' . date('YmdHis') . '-' . rand(10, 99);
    $txStmt = $pdo->prepare("
        INSERT INTO stock_transactions (transaction_code, type, batch_id, financial_year_id, department_id, quantity, unit_cost, total_value, issued_by_user_id, received_by_name, receiver_department_id, ip_address)
        VALUES (?, 'STOCK_IN', ?, ?, ?, ?, ?, ?, ?, 'Store Vault Storage', ?, ?)
    ");
    $txStmt->execute([
        $txCode, $batchId, $financialYearId, $departmentId, $quantity, $unitCost, ($quantity * $unitCost), $receivedBy, $departmentId, $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1'
    ]);

    logPhpAudit($pdo, $receivedBy, 'STOCK_IN_REGISTERED', 'BATCH', $batchId, ['batchNumber' => $batchNumber, 'qty' => $quantity]);

    $pdo->commit();

    echo json_encode([
        'success' => true,
        'batchId' => $batchId,
        'batchNumber' => $batchNumber,
        'message' => 'Stock batch registered successfully'
    ]);

} catch (Exception $e) {
    $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
