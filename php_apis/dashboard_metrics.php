<?php
/**
 * PHP API Endpoint: php_apis/dashboard_metrics.php
 * Computes live dashboard metrics matching DashboardMetrics interface
 */

require_once __DIR__ . '/db_connection.php';

$fyId = $_GET['financialYearId'] ?? $_GET['financial_year_id'] ?? null;

// Get Active Financial Year Label
$fyLabel = "2025-2026";
if ($fyId) {
    $fyStmt = $pdo->prepare("SELECT label FROM financial_years WHERE id = ?");
    $fyStmt->execute([$fyId]);
    $lbl = $fyStmt->fetchColumn();
    if ($lbl) $fyLabel = $lbl;
} else {
    $fyStmt = $pdo->query("SELECT label FROM financial_years WHERE is_active = TRUE LIMIT 1");
    $lbl = $fyStmt->fetchColumn();
    if ($lbl) $fyLabel = $lbl;
}

// Total Valuation
$valSql = "SELECT COALESCE(SUM(available_quantity * unit_cost), 0) FROM stock_batches";
if ($fyId) $valSql .= " WHERE financial_year_id = " . intval($fyId);
$totalValuation = floatval($pdo->query($valSql)->fetchColumn());

// Total Available Items Count across batches
$qtySql = "SELECT COALESCE(SUM(available_quantity), 0) FROM stock_batches";
if ($fyId) $qtySql .= " WHERE financial_year_id = " . intval($fyId);
$totalItemsCount = intval($pdo->query($qtySql)->fetchColumn());

// Serialized Items Count
$iSql = "SELECT COUNT(*) FROM inventory_items";
if ($fyId) $iSql .= " WHERE financial_year_id = " . intval($fyId);
$totalSerializedItems = intval($pdo->query($iSql)->fetchColumn());

// Low Stock Alerts Count (batches with available_quantity <= 5)
$lowSql = "SELECT COUNT(*) FROM stock_batches WHERE available_quantity <= 5";
if ($fyId) $lowSql .= " AND financial_year_id = " . intval($fyId);
$lowStockAlertsCount = intval($pdo->query($lowSql)->fetchColumn());

// Stock In Value
$inSql = "SELECT COALESCE(SUM(total_value), 0) FROM stock_transactions WHERE type = 'STOCK_IN'";
if ($fyId) $inSql .= " AND financial_year_id = " . intval($fyId);
$monthlyStockInValue = floatval($pdo->query($inSql)->fetchColumn());

// Stock Out Value
$outSql = "SELECT COALESCE(SUM(total_value), 0) FROM stock_transactions WHERE type = 'STOCK_OUT'";
if ($fyId) $outSql .= " AND financial_year_id = " . intval($fyId);
$monthlyStockOutValue = floatval($pdo->query($outSql)->fetchColumn());

// Department Breakdown
$deptSql = "
    SELECT d.name as departmentName, COALESCE(SUM(b.available_quantity), 0) as count, COALESCE(SUM(b.available_quantity * b.unit_cost), 0) as value
    FROM departments d
    LEFT JOIN stock_batches b ON d.id = b.department_id " . ($fyId ? "AND b.financial_year_id = " . intval($fyId) : "") . "
    GROUP BY d.id, d.name
";
$deptStmt = $pdo->query($deptSql);
$departmentBreakdown = [];
while ($row = $deptStmt->fetch()) {
    $departmentBreakdown[] = [
        'departmentName' => $row['departmentName'],
        'count' => intval($row['count']),
        'value' => floatval($row['value'])
    ];
}

// Category Breakdown
$catSql = "
    SELECT c.name as categoryName, COALESCE(SUM(b.available_quantity), 0) as count, COALESCE(SUM(b.available_quantity * b.unit_cost), 0) as value
    FROM categories c
    LEFT JOIN stock_batches b ON c.id = b.category_id " . ($fyId ? "AND b.financial_year_id = " . intval($fyId) : "") . "
    GROUP BY c.id, c.name
";
$catStmt = $pdo->query($catSql);
$categoryBreakdown = [];
while ($row = $catStmt->fetch()) {
    $categoryBreakdown[] = [
        'categoryName' => $row['categoryName'],
        'count' => intval($row['count']),
        'value' => floatval($row['value'])
    ];
}

echo json_encode([
    'success' => true,
    'metrics' => [
        'totalInventoryValuation' => $totalValuation,
        'totalItemsCount' => $totalItemsCount,
        'totalSerializedCount' => $totalSerializedItems,
        'lowStockAlertsCount' => $lowStockAlertsCount,
        'activeFinancialYear' => $fyLabel,
        'pendingDispatchesCount' => 0,
        'monthlyStockInValue' => $monthlyStockInValue,
        'monthlyStockOutValue' => $monthlyStockOutValue,
        'departmentBreakdown' => $departmentBreakdown,
        'categoryBreakdown' => $categoryBreakdown
    ]
]);
