<?php
/**
 * PHP API Endpoint: php_apis/transactions.php
 * Handles Stock Transactions History & Signatures Retrieval
 */

require_once __DIR__ . '/db_connection.php';

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $fyId = $_GET['financialYearId'] ?? $_GET['financial_year_id'] ?? null;

        $sql = "
            SELECT 
                t.id,
                t.transaction_code as transactionCode,
                t.type,
                t.batch_id as batchId,
                b.batch_number as batchNumber,
                t.item_id as itemId,
                i.serial_number as serialNumber,
                t.financial_year_id as financialYearId,
                t.department_id as departmentId,
                d1.name as departmentName,
                t.quantity,
                t.unit_cost as unitCost,
                t.total_value as totalValue,
                t.issued_by_user_id as issuedByUserId,
                u.full_name as issuedByName,
                t.received_by_name as receivedByName,
                t.receiver_department_id as receiverDepartmentId,
                d2.name as receiverDepartmentName,
                t.remarks,
                t.created_at as createdAt,
                s.issuer_signature_base64 as issuerSignatureBase64,
                s.receiver_signature_base64 as receiverSignatureBase64
            FROM stock_transactions t
            JOIN stock_batches b ON t.batch_id = b.id
            LEFT JOIN inventory_items i ON t.item_id = i.id
            JOIN departments d1 ON t.department_id = d1.id
            JOIN departments d2 ON t.receiver_department_id = d2.id
            JOIN users u ON t.issued_by_user_id = u.id
            LEFT JOIN signatures s ON t.id = s.transaction_id
            WHERE 1=1
        ";

        $params = [];
        if ($fyId) {
            $sql .= " AND t.financial_year_id = ?";
            $params[] = $fyId;
        }

        $sql .= " ORDER BY t.id DESC";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $transactions = $stmt->fetchAll();

        echo json_encode(['success' => true, 'transactions' => $transactions]);
        break;

    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
}
