<?php
/**
 * PHP API Endpoint: php_apis/reports.php
 * Financial Year & Department Stock Valuation Analytics
 */

require_once __DIR__ . '/db_connection.php';

$fyId = $_GET['financialYearId'] ?? $_GET['financial_year_id'] ?? null;
$deptId = $_GET['departmentId'] ?? $_GET['department_id'] ?? null;

if (!$fyId) {
    $stmt = $pdo->query("SELECT id FROM financial_years WHERE is_active = TRUE LIMIT 1");
    $fyId = $stmt->fetchColumn() ?: 1;
}

$params = [$fyId];
$deptWhere = "";
if (!empty($deptId)) {
    $deptWhere = " AND b.department_id = ? ";
    $params[] = $deptId;
}

// 1. Total Incoming Stock Batches in FY
$incomingSql = "
    SELECT COUNT(b.id) as batch_count,
           COALESCE(SUM(b.total_quantity), 0) as total_incoming_qty,
           COALESCE(SUM(b.total_quantity * b.unit_cost), 0) as total_incoming_val
    FROM stock_batches b
    WHERE b.financial_year_id = ? $deptWhere
";
$inStmt = $pdo->prepare($incomingSql);
$inStmt->execute($params);
$incomingData = $inStmt->fetch();

// 2. Total Outgoing Stock Transactions in FY
$outgoingParams = [$fyId];
$outDeptWhere = "";
if (!empty($deptId)) {
    $outDeptWhere = " AND t.department_id = ? ";
    $outgoingParams[] = $deptId;
}
$outgoingSql = "
    SELECT COALESCE(SUM(t.quantity), 0) as total_outgoing_qty,
           COALESCE(SUM(t.total_value), 0) as total_outgoing_val
    FROM stock_transactions t
    WHERE t.financial_year_id = ? AND t.type = 'STOCK_OUT' $outDeptWhere
";
$outStmt = $pdo->prepare($outgoingSql);
$outStmt->execute($outgoingParams);
$outgoingData = $outStmt->fetch();

// 3. Current Active Stock Valuation
$balanceSql = "
    SELECT COALESCE(SUM(b.available_quantity), 0) as current_qty,
           COALESCE(SUM(b.available_quantity * b.unit_cost), 0) as current_val
    FROM stock_batches b
    WHERE b.financial_year_id = ? $deptWhere
";
$balStmt = $pdo->prepare($balanceSql);
$balStmt->execute($params);
$balanceData = $balStmt->fetch();

echo json_encode([
    'success' => true,
    'report' => [
        'financialYearId' => intval($fyId),
        'departmentId' => $deptId ? intval($deptId) : null,
        'incomingQuantity' => intval($incomingData['total_incoming_qty']),
        'incomingValuation' => floatval($incomingData['total_incoming_val']),
        'outgoingQuantity' => intval($outgoingData['total_outgoing_qty']),
        'outgoingValuation' => floatval($outgoingData['total_outgoing_val']),
        'remainingQuantity' => intval($balanceData['current_qty']),
        'remainingValuation' => floatval($balanceData['current_val']),
        'generatedAt' => date('Y-m-d H:i:s')
    ]
]);
