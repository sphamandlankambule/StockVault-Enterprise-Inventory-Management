<?php
/**
 * PHP API Endpoint: php_apis/reports.php
 * Financial Year & Department Stock Valuation Analytics
 */

require_once __DIR__ . '/db_connection.php';

$fyId = $_GET['financialYearId'] ?? $_GET['financial_year_id'] ?? null;
$deptId = $_GET['departmentId'] ?? $_GET['department_id'] ?? null;

if ($deptId !== null && trim((string)$deptId) === '') {
    $deptId = null;
}

if (!$fyId) {
    $stmt = $pdo->query("SELECT id FROM financial_years WHERE is_active = TRUE LIMIT 1");
    $fyId = $stmt->fetchColumn() ?: 1;
}

// 1. Get Financial Year Code / Label
$fyStmt = $pdo->prepare("SELECT label FROM financial_years WHERE id = ?");
$fyStmt->execute([$fyId]);
$fyCode = $fyStmt->fetchColumn() ?: "FY-{$fyId}";

// 2. Get Department Name
$deptName = "All Organization Departments";
if (!empty($deptId)) {
    $dStmt = $pdo->prepare("SELECT name FROM departments WHERE id = ?");
    $dStmt->execute([$deptId]);
    $foundDept = $dStmt->fetchColumn();
    if ($foundDept) {
        $deptName = $foundDept;
    }
}

// Params & WHERE clauses
$batchParams = [$fyId];
$batchDeptWhere = "";
if (!empty($deptId)) {
    $batchDeptWhere = " AND b.department_id = ? ";
    $batchParams[] = $deptId;
}

// 3. Batches Query
$bSql = "
    SELECT b.id,
           b.batch_number as batchNumber,
           COALESCE(b.supplier_name, 'Direct Warehouse Supplier') as supplierName,
           CAST(b.unit_cost AS DOUBLE) as unitCost,
           b.total_quantity as totalQuantity,
           b.available_quantity as availableQuantity,
           b.category_id as categoryId,
           b.department_id as departmentId,
           b.financial_year_id as financialYearId,
           b.is_serialized as isSerialized,
           b.created_at as receivedDate
    FROM stock_batches b
    WHERE b.financial_year_id = ? $batchDeptWhere
    ORDER BY b.id DESC
";
$bStmt = $pdo->prepare($bSql);
$bStmt->execute($batchParams);
$batches = $bStmt->fetchAll();

$totalIncomingQty = 0;
$totalIncomingVal = 0;
$remainingQty = 0;
$remainingVal = 0;

foreach ($batches as $b) {
    $totalIncomingQty += intval($b['totalQuantity']);
    $totalIncomingVal += floatval($b['totalQuantity']) * floatval($b['unitCost']);
    $remainingQty += intval($b['availableQuantity']);
    $remainingVal += floatval($b['availableQuantity']) * floatval($b['unitCost']);
}

// 4. Transactions Query (Stock Out)
$txParams = [$fyId];
$txDeptWhere = "";
if (!empty($deptId)) {
    $txDeptWhere = " AND t.department_id = ? ";
    $txParams[] = $deptId;
}

$txSql = "
    SELECT t.id,
           t.transaction_code as transactionCode,
           t.type,
           t.batch_id as batchId,
           t.quantity,
           CAST(t.unit_cost AS DOUBLE) as unitCost,
           CAST(t.total_value AS DOUBLE) as totalValue,
           t.received_by_name as receivedByName,
           t.created_at as timestamp
    FROM stock_transactions t
    WHERE t.financial_year_id = ? $txDeptWhere
    ORDER BY t.id DESC
";
$txStmt = $pdo->prepare($txSql);
$txStmt->execute($txParams);
$transactions = $txStmt->fetchAll();

$totalOutgoingQty = 0;
$totalOutgoingVal = 0;
foreach ($transactions as $t) {
    if ($t['type'] === 'STOCK_OUT') {
        $totalOutgoingQty += intval($t['quantity']);
        $totalOutgoingVal += floatval($t['totalValue']);
    }
}

// 5. Items Status Breakdown (Maintenance / Scrapped)
$itemsMaintenance = 0;
$itemsDecommissioned = 0;
try {
    $itemParams = [$fyId];
    $itemDeptWhere = "";
    if (!empty($deptId)) {
        $itemDeptWhere = " AND b.department_id = ? ";
        $itemParams[] = $deptId;
    }
    $itemSql = "
        SELECT i.status, COUNT(i.id) as cnt
        FROM inventory_items i
        JOIN stock_batches b ON i.batch_id = b.id
        WHERE b.financial_year_id = ? $itemDeptWhere
        GROUP BY i.status
    ";
    $iStmt = $pdo->prepare($itemSql);
    $iStmt->execute($itemParams);
    while ($row = $iStmt->fetch()) {
        if ($row['status'] === 'MAINTENANCE') $itemsMaintenance = intval($row['cnt']);
        if ($row['status'] === 'DECOMMISSIONED') $itemsDecommissioned = intval($row['cnt']);
    }
} catch (Exception $e) {
    // Ignore if table not present
}

$summary = [
    'financialYearCode' => $fyCode,
    'departmentName' => $deptName,
    'totalIncomingQuantity' => $totalIncomingQty,
    'totalIncomingValue' => round($totalIncomingVal, 2),
    'totalOutgoingQuantity' => $totalOutgoingQty,
    'totalOutgoingValue' => round($totalOutgoingVal, 2),
    'remainingStockCount' => $remainingQty,
    'remainingStockValue' => round($remainingVal, 2),
    'itemsUnderMaintenance' => $itemsMaintenance,
    'decommissionedItems' => $itemsDecommissioned,
    'generatedAt' => date('Y-m-d H:i:s')
];

echo json_encode([
    'success' => true,
    'summary' => $summary,
    'report' => $summary,
    'batches' => $batches,
    'transactions' => $transactions
]);
