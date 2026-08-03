<?php
/**
 * PHP API Endpoint: php_apis/departments.php
 * Handles Departments Listing, Creation, Updating, and Deletion
 */

require_once __DIR__ . '/db_connection.php';

$headers = getallheaders();
$userRole = $headers['X-User-Role'] ?? $headers['x-user-role'] ?? 'ADMIN';
$userId = $headers['X-User-Id'] ?? $headers['x-user-id'] ?? 1;

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $stmt = $pdo->query("
            SELECT id, code, name, description, is_active as isActive, created_at as createdAt
            FROM departments
            ORDER BY id ASC
        ");
        $departments = $stmt->fetchAll();
        echo json_encode(['success' => true, 'departments' => $departments]);
        break;

    case 'POST':
        if ($userRole !== 'ADMIN') {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Forbidden: Admin privilege required']);
            exit();
        }

        $input = json_decode(file_get_contents('php://input'), true);
        $code = trim($input['code'] ?? '');
        $name = trim($input['name'] ?? '');
        $description = trim($input['description'] ?? '');

        if (empty($code) || empty($name)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Code and Name are required']);
            exit();
        }

        // Duplicate code check
        $chk = $pdo->prepare("SELECT id FROM departments WHERE code = ?");
        $chk->execute([$code]);
        if ($chk->fetch()) {
            http_response_code(409);
            echo json_encode(['success' => false, 'error' => 'Department code already exists']);
            exit();
        }

        $stmt = $pdo->prepare("INSERT INTO departments (code, name, description) VALUES (?, ?, ?)");
        $stmt->execute([$code, $name, $description]);
        $id = $pdo->lastInsertId();

        logPhpAudit($pdo, $userId, 'DEPARTMENT_CREATED', 'DEPARTMENT', $id, ['code' => $code, 'name' => $name]);

        echo json_encode(['success' => true, 'id' => $id, 'message' => 'Department created successfully']);
        break;

    case 'PUT':
        if ($userRole !== 'ADMIN') {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Forbidden: Admin privilege required']);
            exit();
        }

        $input = json_decode(file_get_contents('php://input'), true);
        $id = $_GET['id'] ?? $input['id'] ?? null;
        $code = trim($input['code'] ?? '');
        $name = trim($input['name'] ?? '');
        $description = trim($input['description'] ?? '');

        if (!$id || empty($code) || empty($name)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'ID, Code, and Name are required']);
            exit();
        }

        $stmt = $pdo->prepare("UPDATE departments SET code = ?, name = ?, description = ? WHERE id = ?");
        $stmt->execute([$code, $name, $description, $id]);

        logPhpAudit($pdo, $userId, 'DEPARTMENT_UPDATED', 'DEPARTMENT', $id, ['code' => $code, 'name' => $name]);

        echo json_encode(['success' => true, 'message' => 'Department updated successfully']);
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
            echo json_encode(['success' => false, 'error' => 'Department ID is required']);
            exit();
        }

        // Check if referenced by users or inventory
        $chk = $pdo->prepare("SELECT COUNT(*) FROM users WHERE department_id = ?");
        $chk->execute([$id]);
        if ($chk->fetchColumn() > 0) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Cannot delete department assigned to existing users']);
            exit();
        }

        $stmt = $pdo->prepare("DELETE FROM departments WHERE id = ?");
        $stmt->execute([$id]);

        logPhpAudit($pdo, $userId, 'DEPARTMENT_DELETED', 'DEPARTMENT', $id);

        echo json_encode(['success' => true, 'message' => 'Department deleted successfully']);
        break;

    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
}
