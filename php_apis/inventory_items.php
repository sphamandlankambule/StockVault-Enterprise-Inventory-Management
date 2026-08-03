<?php
/**
 * PHP API Endpoint: php_apis/inventory_items.php
 * Handles Serialized Inventory Items Listing and Status Updates
 */

require_once __DIR__ . '/db_connection.php';

$headers = getallheaders();
$userId = $headers['X-User-Id'] ?? $headers['x-user-id'] ?? 1;

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $fyId = $_GET['financialYearId'] ?? $_GET['financial_year_id'] ?? null;
        $batchId = $_GET['batchId'] ?? null;
        $status = $_GET['status'] ?? null;

        $sql = "
            SELECT 
                i.id,
                i.batch_id as batchId,
                b.batch_number as batchNumber,
                i.item_code as itemCode,
                i.serial_number as serialNumber,
                i.category_id as categoryId,
                c.name as categoryName,
                i.department_id as departmentId,
                d.name as departmentName,
                i.financial_year_id as financialYearId,
                fy.label as financialYearLabel,
                i.status,
                i.unit_cost as unitCost,
                i.created_at as createdAt
            FROM inventory_items i
            JOIN stock_batches b ON i.batch_id = b.id
            JOIN categories c ON i.category_id = c.id
            JOIN departments d ON i.department_id = d.id
            JOIN financial_years fy ON i.financial_year_id = fy.id
            WHERE 1=1
        ";

        $params = [];
        if ($fyId) {
            $sql .= " AND i.financial_year_id = ?";
            $params[] = $fyId;
        }
        if ($batchId) {
            $sql .= " AND i.batch_id = ?";
            $params[] = $batchId;
        }
        if ($status) {
            $sql .= " AND i.status = ?";
            $params[] = $status;
        }

        $sql .= " ORDER BY i.id DESC";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $items = $stmt->fetchAll();

        echo json_encode(['success' => true, 'items' => $items]);
        break;

    case 'PUT':
        $input = json_decode(file_get_contents('php://input'), true);
        $itemId = $_GET['id'] ?? $input['id'] ?? null;
        $newStatus = $input['status'] ?? null;
        $notes = trim($input['notes'] ?? '');

        if (!$itemId || !$newStatus) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Item ID and Status are required']);
            exit();
        }

        $allowedStatuses = ['IN_STOCK', 'ISSUED', 'MAINTENANCE', 'DECOMMISSIONED'];
        if (!in_array($newStatus, $allowedStatuses)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Invalid status value']);
            exit();
        }

        $stmt = $pdo->prepare("UPDATE inventory_items SET status = ? WHERE id = ?");
        $stmt->execute([$newStatus, $itemId]);

        logPhpAudit($pdo, $userId, 'ITEM_STATUS_UPDATED', 'INVENTORY_ITEM', $itemId, [
            'newStatus' => $newStatus,
            'notes' => $notes
        ]);

        echo json_encode(['success' => true, 'message' => "Item status updated to {$newStatus}"]);
        break;

    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
}
