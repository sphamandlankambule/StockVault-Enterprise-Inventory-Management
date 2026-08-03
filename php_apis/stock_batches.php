<?php
/**
 * PHP API Endpoint: php_apis/stock_batches.php
 * Handles Stock Batches Listing and Management
 */

require_once __DIR__ . '/db_connection.php';

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $fyId = $_GET['financialYearId'] ?? $_GET['financial_year_id'] ?? null;
        
        $sql = "
            SELECT 
                b.id,
                b.batch_number as batchNumber,
                b.category_id as categoryId,
                c.name as categoryName,
                c.code as categoryCode,
                b.department_id as departmentId,
                d.name as departmentName,
                b.financial_year_id as financialYearId,
                fy.label as financialYearLabel,
                b.supplier_name as supplierName,
                b.unit_cost as unitCost,
                b.is_serialized as isSerialized,
                b.total_quantity as totalQuantity,
                b.available_quantity as availableQuantity,
                b.status,
                b.received_by_user_id as receivedByUserId,
                u.full_name as receivedByName,
                b.created_at as createdAt
            FROM stock_batches b
            JOIN categories c ON b.category_id = c.id
            JOIN departments d ON b.department_id = d.id
            JOIN financial_years fy ON b.financial_year_id = fy.id
            JOIN users u ON b.received_by_user_id = u.id
        ";

        $params = [];
        if ($fyId) {
            $sql .= " WHERE b.financial_year_id = ?";
            $params[] = $fyId;
        }

        $sql .= " ORDER BY b.id DESC";

        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $batches = $stmt->fetchAll();

        echo json_encode(['success' => true, 'batches' => $batches]);
        break;

    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
}
