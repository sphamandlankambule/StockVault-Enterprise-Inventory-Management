<?php
/**
 * PHP API Endpoint: php_apis/financial_years.php
 * Handles Financial Years Listing, Creation, Updating, Activation & Deletion
 */

require_once __DIR__ . '/db_connection.php';

$headers = getallheaders();
$userRole = $headers['X-User-Role'] ?? $headers['x-user-role'] ?? 'ADMIN';
$userId = $headers['X-User-Id'] ?? $headers['x-user-id'] ?? 1;

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $stmt = $pdo->query("
            SELECT id, label, label as yearCode, start_date as startDate, end_date as endDate,
                   is_active as isActive, is_closed as isClosed
            FROM financial_years
            ORDER BY id DESC
        ");
        $financialYears = $stmt->fetchAll();
        echo json_encode(['success' => true, 'financialYears' => $financialYears]);
        break;

    case 'POST':
        if ($userRole !== 'ADMIN') {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Forbidden: Admin privilege required']);
            exit();
        }

        $input = json_decode(file_get_contents('php://input'), true);
        $label = trim($input['label'] ?? $input['yearCode'] ?? '');
        $startDate = trim($input['startDate'] ?? '');
        $endDate = trim($input['endDate'] ?? '');
        $isActive = (!empty($input['isActive']) || !empty($input['setAsActive'])) ? 1 : 0;

        if (empty($label) || empty($startDate) || empty($endDate)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Label, Start Date, and End Date are required']);
            exit();
        }

        if ($isActive) {
            $pdo->query("UPDATE financial_years SET is_active = FALSE");
        }

        $stmt = $pdo->prepare("
            INSERT INTO financial_years (label, start_date, end_date, is_active, is_closed)
            VALUES (?, ?, ?, ?, FALSE)
        ");
        $stmt->execute([$label, $startDate, $endDate, $isActive]);
        $id = $pdo->lastInsertId();

        logPhpAudit($pdo, $userId, 'FINANCIAL_YEAR_CREATED', 'FINANCIAL_YEAR', $id, ['label' => $label]);

        $fyStmt = $pdo->prepare("SELECT id, label, label as yearCode, start_date as startDate, end_date as endDate, is_active as isActive, is_closed as isClosed FROM financial_years WHERE id = ?");
        $fyStmt->execute([$id]);
        $financialYear = $fyStmt->fetch();

        echo json_encode(['success' => true, 'financialYear' => $financialYear, 'message' => 'Financial year created successfully']);
        break;

    case 'PUT':
        if ($userRole !== 'ADMIN') {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Forbidden: Admin privilege required']);
            exit();
        }

        $input = json_decode(file_get_contents('php://input'), true);
        $id = $_GET['id'] ?? $input['id'] ?? null;
        $action = $_GET['action'] ?? $input['action'] ?? '';

        if (!$id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Financial Year ID is required']);
            exit();
        }

        if ($action === 'activate') {
            $pdo->query("UPDATE financial_years SET is_active = FALSE");
            $stmt = $pdo->prepare("UPDATE financial_years SET is_active = TRUE WHERE id = ?");
            $stmt->execute([$id]);

            logPhpAudit($pdo, $userId, 'FINANCIAL_YEAR_ACTIVATED', 'FINANCIAL_YEAR', $id);

            echo json_encode(['success' => true, 'message' => 'Financial year activated successfully']);
            exit();
        }

        $label = trim($input['label'] ?? $input['yearCode'] ?? '');
        $startDate = trim($input['startDate'] ?? '');
        $endDate = trim($input['endDate'] ?? '');
        $isActive = (!empty($input['isActive']) || !empty($input['setAsActive'])) ? 1 : 0;

        if ($isActive) {
            $pdo->query("UPDATE financial_years SET is_active = FALSE");
        }

        $stmt = $pdo->prepare("
            UPDATE financial_years
            SET label = ?, start_date = ?, end_date = ?, is_active = ?
            WHERE id = ?
        ");
        $stmt->execute([$label, $startDate, $endDate, $isActive, $id]);

        logPhpAudit($pdo, $userId, 'FINANCIAL_YEAR_UPDATED', 'FINANCIAL_YEAR', $id);

        $fyStmt = $pdo->prepare("SELECT id, label, label as yearCode, start_date as startDate, end_date as endDate, is_active as isActive, is_closed as isClosed FROM financial_years WHERE id = ?");
        $fyStmt->execute([$id]);
        $financialYear = $fyStmt->fetch();

        echo json_encode(['success' => true, 'financialYear' => $financialYear, 'message' => 'Financial year updated successfully']);
        break;

    case 'DELETE':
        if ($userRole !== 'ADMIN') {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Forbidden: Admin privilege required']);
            exit();
        }

        $id = $_GET['id'] ?? null;
        if (!$id) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Financial Year ID is required']);
            exit();
        }

        $stmt = $pdo->prepare("DELETE FROM financial_years WHERE id = ?");
        $stmt->execute([$id]);

        logPhpAudit($pdo, $userId, 'FINANCIAL_YEAR_DELETED', 'FINANCIAL_YEAR', $id);

        echo json_encode(['success' => true, 'message' => 'Financial year deleted successfully']);
        break;

    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
}
