export const PHP_API_EXAMPLES = {
  usersPhp: `<?php
/**
 * PHP API Endpoint: /api/admin/users.php
 * Handles Admin-Only User Provisioning (Creation, Listing, RBAC Check)
 */
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-User-Role');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once '../db_connection.php'; // PDO Database instance $pdo

// 1. RBAC Validation: Only Admin allowed
$headers = getallheaders();
$userRole = isset($headers['X-User-Role']) ? $headers['X-User-Role'] : '';

if ($userRole !== 'ADMIN') {
    http_response_code(403);
    echo json_encode(['success' => false, 'error' => 'Forbidden: Admin access required for user management']);
    exit();
}

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        // List all users with role and department details
        $stmt = $pdo->prepare("
            SELECT u.id, u.full_name, u.email, u.status, u.created_at,
                   r.name as role_name, d.name as department_name, d.id as department_id
            FROM users u
            JOIN roles r ON u.role_id = r.id
            JOIN departments d ON u.department_id = d.id
            ORDER BY u.created_at DESC
        ");
        $stmt->execute();
        $users = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode(['success' => true, 'data' => $users]);
        break;

    case 'POST':
        // Provision new user (ADMIN ONLY)
        $input = json_decode(file_get_contents('php://input'), true);
        
        if (empty($input['fullName']) || empty($input['email']) || empty($input['roleId']) || empty($input['departmentId'])) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Missing required fields: fullName, email, roleId, departmentId']);
            exit();
        }

        // Check if email already exists
        $chk = $pdo->prepare("SELECT id FROM users WHERE email = ?");
        $chk->execute([$input['email']]);
        if ($chk->fetch()) {
            http_response_code(409);
            echo json_encode(['success' => false, 'error' => 'User with this email already exists']);
            exit();
        }

        // Hash password securely
        $passwordHash = password_hash($input['password'] ?? 'StockVault@2025', PASSWORD_BCRYPT);

        $stmt = $pdo->prepare("
            INSERT INTO users (role_id, department_id, full_name, email, password_hash, status, created_by)
            VALUES (?, ?, ?, ?, ?, 'ACTIVE', ?)
        ");
        $stmt->execute([
            $input['roleId'],
            $input['departmentId'],
            $input['fullName'],
            $input['email'],
            $passwordHash,
            $input['adminUserId'] ?? 1
        ]);

        $newUserId = $pdo->lastInsertId();

        // Audit Log
        $audit = $pdo->prepare("
            INSERT INTO audit_logs (user_id, user_name, user_role, action, entity_type, entity_id, new_values_json, ip_address)
            VALUES (?, 'System Admin', 'ADMIN', 'USER_CREATED', 'USER', ?, ?, ?)
        ");
        $audit->execute([
            1, $newUserId, json_encode(['fullName' => $input['fullName'], 'email' => $input['email']]), $_SERVER['REMOTE_ADDR']
        ]);

        echo json_encode(['success' => true, 'id' => $newUserId, 'message' => 'User account created successfully']);
        break;

    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
}
`,

  addStockPhp: `<?php
/**
 * PHP API Endpoint: /api/add_stock.php
 * Stock In & Serial Number Duplication Check Logic
 */
header('Content-Type: application/json');
require_once 'db_connection.php';

$input = json_decode(file_get_contents('php://input'), true);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $pdo->beginTransaction();

    try {
        $batchNumber = 'BAT-' . date('Ymd') . '-' . rand(1000, 9999);
        $categoryId = $input['categoryId'];
        $departmentId = $input['departmentId'];
        $financialYearId = $input['financialYearId'];
        $supplierName = $input['supplierName'];
        $unitCost = $input['unitCost'];
        $isSerialized = !empty($input['isSerialized']);
        $quantity = $isSerialized ? count($input['serials']) : intval($input['quantity']);
        $receivedBy = $input['receivedByUserId'];

        // Serial number pre-validation
        if ($isSerialized && !empty($input['serials'])) {
            $inClause = implode(',', array_fill(0, count($input['serials']), '?'));
            $chkStmt = $pdo->prepare("SELECT serial_number FROM inventory_items WHERE serial_number IN ($inClause) AND status != 'DECOMMISSIONED'");
            $chkStmt->execute($input['serials']);
            $existing = $chkStmt->fetchAll(PDO::FETCH_COLUMN);

            if (!empty($existing)) {
                $pdo->rollBack();
                http_response_code(422);
                echo json_encode([
                    'success' => false,
                    'error' => 'Duplicate serial numbers detected in system',
                    'duplicates' => $existing
                ]);
                exit();
            }
        }

        // Create Stock Batch
        $batchStmt = $pdo->prepare("
            INSERT INTO stock_batches (batch_number, category_id, department_id, financial_year_id, supplier_name, unit_cost, is_serialized, total_quantity, available_quantity, received_by_user_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $batchStmt->execute([
            $batchNumber, $categoryId, $departmentId, $financialYearId, $supplierName, $unitCost, $isSerialized ? 1 : 0, $quantity, $quantity, $receivedBy
        ]);
        $batchId = $pdo->lastInsertId();

        // If Serialized, insert individual inventory items
        if ($isSerialized) {
            $itemStmt = $pdo->prepare("
                INSERT INTO inventory_items (batch_id, item_code, serial_number, category_id, department_id, financial_year_id, status, unit_cost)
                VALUES (?, ?, ?, ?, ?, ?, 'IN_STOCK', ?)
            ");
            foreach ($input['serials'] as $idx => $sn) {
                $itemCode = 'ITM-' . date('Y') . '-' . str_pad($batchId, 4, '0', STR_PAD_LEFT) . '-' . str_pad($idx + 1, 3, '0', STR_PAD_LEFT);
                $itemStmt->execute([$batchId, $itemCode, trim($sn), $categoryId, $departmentId, $financialYearId, $unitCost]);
            }
        }

        // Create Stock In Transaction
        $txCode = 'TX-IN-' . date('YmdHis') . '-' . rand(10, 99);
        $txStmt = $pdo->prepare("
            INSERT INTO stock_transactions (transaction_code, type, batch_id, financial_year_id, department_id, quantity, unit_cost, total_value, issued_by_user_id, received_by_name, receiver_department_id, ip_address)
            VALUES (?, 'STOCK_IN', ?, ?, ?, ?, ?, ?, ?, 'Store Vault', ?, ?)
        ");
        $txStmt->execute([
            $txCode, $batchId, $financialYearId, $departmentId, $quantity, $unitCost, ($quantity * $unitCost), $receivedBy, $departmentId, $_SERVER['REMOTE_ADDR']
        ]);

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
}
`,

  stockOutPhp: `<?php
/**
 * PHP API Endpoint: /api/stock_out.php
 * Stock Out Dispatch with Dual-Signature Non-Repudiation Recording
 */
header('Content-Type: application/json');
require_once 'db_connection.php';

$input = json_decode(file_get_contents('php://input'), true);

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $pdo->beginTransaction();

    try {
        $itemId = $input['itemId'] ?? null;
        $batchId = $input['batchId'];
        $financialYearId = $input['financialYearId'];
        $departmentId = $input['departmentId'];
        $quantity = intval($input['quantity'] ?? 1);
        $issuerUserId = $input['issuerUserId'];
        $receiverName = $input['receiverName'];
        $receiverDeptId = $input['receiverDepartmentId'];
        $remarks = $input['remarks'] ?? 'Standard Department Issuance';

        // Fetch Batch & Item
        $batchStmt = $pdo->prepare("SELECT * FROM stock_batches WHERE id = ? FOR UPDATE");
        $batchStmt->execute([$batchId]);
        $batch = $batchStmt->fetch(PDO::FETCH_ASSOC);

        if (!$batch || $batch['available_quantity'] < $quantity) {
            $pdo->rollBack();
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Insufficient batch stock available']);
            exit();
        }

        // If specific item selected (serialized)
        if (!empty($itemId)) {
            $updateItem = $pdo->prepare("UPDATE inventory_items SET status = 'ISSUED', department_id = ? WHERE id = ? AND status = 'IN_STOCK'");
            $updateItem->execute([$receiverDeptId, $itemId]);
            if ($updateItem->rowCount() === 0) {
                $pdo->rollBack();
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'Item is not in stock or already issued']);
                exit();
            }
        }

        // Deduct Batch Quantity
        $deductStmt = $pdo->prepare("
            UPDATE stock_batches 
            SET available_quantity = available_quantity - ?,
                status = CASE WHEN available_quantity - ? <= 0 THEN 'DEPLETED' ELSE 'ACTIVE' END
            WHERE id = ?
        ");
        $deductStmt->execute([$quantity, $quantity, $batchId]);

        // Insert Stock Transaction
        $txCode = 'TX-OUT-' . date('YmdHis') . '-' . rand(10, 99);
        $totalVal = $quantity * $batch['unit_cost'];
        $txStmt = $pdo->prepare("
            INSERT INTO stock_transactions (transaction_code, type, batch_id, item_id, financial_year_id, department_id, quantity, unit_cost, total_value, issued_by_user_id, received_by_name, receiver_department_id, remarks, ip_address)
            VALUES (?, 'STOCK_OUT', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ");
        $txStmt->execute([
            $txCode, $batchId, $itemId, $financialYearId, $departmentId, $quantity, $batch['unit_cost'], $totalVal, $issuerUserId, $receiverName, $receiverDeptId, $remarks, $_SERVER['REMOTE_ADDR']
        ]);
        $txId = $pdo->lastInsertId();

        // Store Dual Signatures
        if (!empty($input['signatures'])) {
            $sigStmt = $pdo->prepare("
                INSERT INTO signatures (transaction_id, issuer_signature_base64, issuer_name, issuer_role, receiver_signature_base64, receiver_name, receiver_role, ip_address, device_timestamp)
                VALUES (?, ?, ?, 'STORE_KEEPER', ?, ?, 'RECEIVER', ?, ?)
            ");
            $sigStmt->execute([
                $txId,
                $input['signatures']['issuerBase64'],
                $input['signatures']['issuerName'],
                $input['signatures']['receiverBase64'],
                $receiverName,
                $_SERVER['REMOTE_ADDR'],
                date('Y-m-d H:i:s')
            ]);
        }

        $pdo->commit();
        echo json_encode(['success' => true, 'transactionCode' => $txCode, 'message' => 'Stock dispatched and dual signatures archived successfully']);
    } catch (Exception $e) {
        $pdo->rollBack();
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
    }
}
`,

  reportsPhp: `<?php
/**
 * PHP API Endpoint: /api/reports.php
 * Generates Financial Year & Department-wise Stock Valuation Reports
 */
header('Content-Type: application/json');
require_once 'db_connection.php';

$fyId = $_GET['financialYearId'] ?? null;
$deptId = $_GET['departmentId'] ?? null;

if (!$fyId) {
    // Default to active financial year
    $stmt = $pdo->query("SELECT id FROM financial_years WHERE is_active = TRUE LIMIT 1");
    $fyId = $stmt->fetchColumn();
}

$params = [$fyId];
$deptWhere = "";
if (!empty($deptId)) {
    $deptWhere = " AND b.department_id = ? ";
    $params[] = $deptId;
}

// 1. Total Incoming Stock in FY
$incomingSql = "
    SELECT COUNT(b.id) as batch_count,
           SUM(b.total_quantity) as total_incoming_qty,
           SUM(b.total_quantity * b.unit_cost) as total_incoming_val
    FROM stock_batches b
    WHERE b.financial_year_id = ? $deptWhere
";
$inStmt = $pdo->prepare($incomingSql);
$inStmt->execute($params);
$incomingData = $inStmt->fetch(PDO::FETCH_ASSOC);

// 2. Total Outgoing Stock in FY
$outgoingSql = "
    SELECT SUM(t.quantity) as total_outgoing_qty,
           SUM(t.total_value) as total_outgoing_val
    FROM stock_transactions t
    WHERE t.financial_year_id = ? AND t.type = 'STOCK_OUT'
";
$outStmt = $pdo->prepare($outgoingSql);
$outStmt->execute([$fyId]);
$outgoingData = $outStmt->fetch(PDO::FETCH_ASSOC);

// 3. Current Balance
$balanceSql = "
    SELECT SUM(b.available_quantity) as current_qty,
           SUM(b.available_quantity * b.unit_cost) as current_val
    FROM stock_batches b
    WHERE b.financial_year_id = ? $deptWhere
";
$balStmt = $pdo->prepare($balanceSql);
$balStmt->execute($params);
$balanceData = $balStmt->fetch(PDO::FETCH_ASSOC);

echo json_encode([
    'success' => true,
    'report' => [
        'financialYearId' => $fyId,
        'departmentId' => $deptId,
        'incomingQuantity' => intval($incomingData['total_incoming_qty'] ?? 0),
        'incomingValuation' => floatval($incomingData['total_incoming_val'] ?? 0),
        'outgoingQuantity' => intval($outgoingData['total_outgoing_qty'] ?? 0),
        'outgoingValuation' => floatval($outgoingData['total_outgoing_val'] ?? 0),
        'remainingQuantity' => intval($balanceData['current_qty'] ?? 0),
        'remainingValuation' => floatval($balanceData['current_val'] ?? 0),
        'generatedAt' => date('Y-m-d H:i:s')
    ]
]);
`,

  nodejsClientCode: `/**
 * Node.js / Express Axios Client Service Layer
 * Bridge between Node.js Application Layer and PHP Backend APIs
 */
import axios from 'axios';

const PHP_API_BASE_URL = process.env.PHP_API_BASE_URL || 'http://localhost/stockvault/api';

export class PhpInventoryApiClient {
  private client;

  constructor() {
    this.client = axios.create({
      baseURL: PHP_API_BASE_URL,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  // 1. RBAC User Creation via PHP API (Admin Only)
  async createUser(adminRole: string, userData: any) {
    const response = await this.client.post('/admin/users.php', userData, {
      headers: { 'X-User-Role': adminRole },
    });
    return response.data;
  }

  // 2. Add Stock Batch with Serial Number pre-checking
  async addStockBatch(stockPayload: any) {
    const response = await this.client.post('/add_stock.php', stockPayload);
    return response.data;
  }

  // 3. Dispatch Stock with Dual Signatures
  async dispatchStockWithSignatures(dispatchPayload: any) {
    const response = await this.client.post('/stock_out.php', dispatchPayload);
    return response.data;
  }

  // 4. Fetch Financial Year Valuation Report
  async fetchFinancialYearReport(financialYearId: string, departmentId?: string) {
    const response = await this.client.get('/reports.php', {
      params: { financialYearId, departmentId },
    });
    return response.data;
  }
}
`
};
