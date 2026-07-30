<?php
/**
 * PHP API Endpoint: php_apis/stock_out.php
 * Handles Stock Out Dispatch & Dual Signature Non-Repudiation Recording
 */

require_once __DIR__ . '/db_connection.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method not allowed. Use POST.']);
    exit();
}

$input = json_decode(file_get_contents('php://input'), true);

if (empty($input['batchId']) || empty($input['financialYearId']) || empty($input['departmentId']) || empty($input['receiverName']) || empty($input['receiverDepartmentId'])) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing required stock out dispatch details']);
    exit();
}

$pdo->beginTransaction();

try {
    $itemId = $input['itemId'] ?? null;
    $batchId = $input['batchId'];
    $financialYearId = $input['financialYearId'];
    $departmentId = $input['departmentId'];
    $quantity = intval($input['quantity'] ?? 1);
    $issuerUserId = $input['issuerUserId'] ?? 1;
    $receiverName = trim($input['receiverName']);
    $receiverDeptId = $input['receiverDepartmentId'];
    $remarks = trim($input['remarks'] ?? 'Standard Department Issuance');

    // 1. Fetch & Lock Stock Batch
    $batchStmt = $pdo->prepare("SELECT * FROM stock_batches WHERE id = ? FOR UPDATE");
    $batchStmt->execute([$batchId]);
    $batch = $batchStmt->fetch();

    if (!$batch || $batch['available_quantity'] < $quantity) {
        $pdo->rollBack();
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Insufficient available batch stock']);
        exit();
    }

    // 2. Mark specific serialized item if selected
    if (!empty($itemId)) {
        $updateItem = $pdo->prepare("UPDATE inventory_items SET status = 'ISSUED', department_id = ? WHERE id = ? AND status = 'IN_STOCK'");
        $updateItem->execute([$receiverDeptId, $itemId]);
        if ($updateItem->rowCount() === 0) {
            $pdo->rollBack();
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Selected serial item is not in stock or already issued']);
            exit();
        }
    }

    // 3. Deduct Batch Stock Quantity
    $deductStmt = $pdo->prepare("
        UPDATE stock_batches 
        SET available_quantity = available_quantity - ?,
            status = CASE WHEN available_quantity - ? <= 0 THEN 'DEPLETED' ELSE 'ACTIVE' END
        WHERE id = ?
    ");
    $deductStmt->execute([$quantity, $quantity, $batchId]);

    // 4. Record Stock Out Transaction
    $txCode = 'TX-OUT-' . date('YmdHis') . '-' . rand(10, 99);
    $totalVal = $quantity * $batch['unit_cost'];
    $txStmt = $pdo->prepare("
        INSERT INTO stock_transactions (transaction_code, type, batch_id, item_id, financial_year_id, department_id, quantity, unit_cost, total_value, issued_by_user_id, received_by_name, receiver_department_id, remarks, ip_address)
        VALUES (?, 'STOCK_OUT', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ");
    $txStmt->execute([
        $txCode, $batchId, $itemId, $financialYearId, $departmentId, $quantity, $batch['unit_cost'], $totalVal, $issuerUserId, $receiverName, $receiverDeptId, $remarks, $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1'
    ]);
    $txId = $pdo->lastInsertId();

    // 5. Store Dual Signatures
    if (!empty($input['signatures'])) {
        $sigStmt = $pdo->prepare("
            INSERT INTO signatures (transaction_id, issuer_signature_base64, issuer_name, issuer_role, receiver_signature_base64, receiver_name, receiver_role, ip_address, device_timestamp)
            VALUES (?, ?, ?, 'STORE_KEEPER', ?, ?, 'RECEIVER', ?, ?)
        ");
        $sigStmt->execute([
            $txId,
            $input['signatures']['issuerBase64'] ?? '',
            $input['signatures']['issuerName'] ?? 'Store Keeper',
            $input['signatures']['receiverBase64'] ?? '',
            $receiverName,
            $_SERVER['REMOTE_ADDR'] ?? '127.0.0.1',
            date('Y-m-d H:i:s')
        ]);
    }

    logPhpAudit($pdo, $issuerUserId, 'STOCK_OUT_DISPATCHED', 'TRANSACTION', $txId, ['txCode' => $txCode, 'receiver' => $receiverName]);

    $pdo->commit();

    echo json_encode([
        'success' => true,
        'transactionCode' => $txCode,
        'message' => 'Stock dispatched and dual signatures archived successfully'
    ]);

} catch (Exception $e) {
    $pdo->rollBack();
    http_response_code(500);
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
