<?php
/**
 * PHP API Endpoint: php_apis/dashboard_metrics.php
 * Computes live dashboard metrics from database tables
 */

require_once __DIR__ . '/db_connection.php';

$fyId = $_GET['financialYearId'] ?? $_GET['financial_year_id'] ?? null;

// Total Valuation
$valSql = "SELECT COALESCE(SUM(available_quantity * unit_cost), 0) FROM stock_batches";
if ($fyId) $valSql .= " WHERE financial_year_id = " . intval($fyId);
$totalValuation = floatval($pdo->query($valSql)->fetchColumn());

// Batches Count
$bSql = "SELECT COUNT(*) FROM stock_batches";
if ($fyId) $bSql .= " WHERE financial_year_id = " . intval($fyId);
$totalBatches = intval($pdo->query($bSql)->fetchColumn());

// Serialized Items Count
$iSql = "SELECT COUNT(*) FROM inventory_items";
if ($fyId) $iSql .= " WHERE financial_year_id = " . intval($fyId);
$totalSerializedItems = intval($pdo->query($iSql)->fetchColumn());

// Item Status Breakdown
$statusCounts = [
    'IN_STOCK' => 0,
    'ISSUED' => 0,
    'MAINTENANCE' => 0,
    'DECOMMISSIONED' => 0
];

$stSql = "SELECT status, COUNT(*) as cnt FROM inventory_items";
if ($fyId) $stSql .= " WHERE financial_year_id = " . intval($fyId);
$stSql .= " GROUP BY status";

$stStmt = $pdo->query($stSql);
while ($row = $stStmt->fetch()) {
    $statusCounts[$row['status']] = intval($row['cnt']);
}

// Low Stock Categories Count
$catSql = "
    SELECT COUNT(*) 
    FROM categories c
    JOIN (
        SELECT category_id, SUM(available_quantity) as total_qty
        FROM stock_batches
        " . ($fyId ? "WHERE financial_year_id = " . intval($fyId) : "") . "
        GROUP BY category_id
    ) b ON c.id = b.category_id
    WHERE b.total_qty <= c.reorder_level
";
$lowStockCategoriesCount = intval($pdo->query($catSql)->fetchColumn());

echo json_encode([
    'success' => true,
    'metrics' => [
        'totalInventoryValue' => $totalValuation,
        'totalBatches' => $totalBatches,
        'totalSerializedItems' => $totalSerializedItems,
        'inStockItems' => $statusCounts['IN_STOCK'],
        'issuedItems' => $statusCounts['ISSUED'],
        'maintenanceItems' => $statusCounts['MAINTENANCE'],
        'decommissionedItems' => $statusCounts['DECOMMISSIONED'],
        'lowStockCategoriesCount' => $lowStockCategoriesCount
    ]
]);
