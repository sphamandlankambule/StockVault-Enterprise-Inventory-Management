<?php
/**
 * PHP API Endpoint: php_apis/categories.php
 * Handles Categories Listing, Creation, Updating, and Deletion
 */

require_once __DIR__ . '/db_connection.php';

$headers = getallheaders();
$userRole = $headers['X-User-Role'] ?? $headers['x-user-role'] ?? 'ADMIN';
$userId = $headers['X-User-Id'] ?? $headers['x-user-id'] ?? 1;

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        $stmt = $pdo->query("
            SELECT id, code, name, description, is_serialized as isSerialized, reorder_level as reorderLevel
            FROM categories
            ORDER BY id ASC
        ");
        $categories = $stmt->fetchAll();
        echo json_encode(['success' => true, 'categories' => $categories]);
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
        $isSerialized = isset($input['isSerialized']) ? ($input['isSerialized'] ? 1 : 0) : 1;
        $reorderLevel = intval($input['reorderLevel'] ?? 10);

        if (empty($code) || empty($name)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Code and Name are required']);
            exit();
        }

        $chk = $pdo->prepare("SELECT id FROM categories WHERE code = ?");
        $chk->execute([$code]);
        if ($chk->fetch()) {
            http_response_code(409);
            echo json_encode(['success' => false, 'error' => 'Category code already exists']);
            exit();
        }

        $stmt = $pdo->prepare("INSERT INTO categories (code, name, description, is_serialized, reorder_level) VALUES (?, ?, ?, ?, ?)");
        $stmt->execute([$code, $name, $description, $isSerialized, $reorderLevel]);
        $id = $pdo->lastInsertId();

        logPhpAudit($pdo, $userId, 'CATEGORY_CREATED', 'CATEGORY', $id, ['code' => $code, 'name' => $name]);

        echo json_encode(['success' => true, 'id' => $id, 'message' => 'Category created successfully']);
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
        $isSerialized = isset($input['isSerialized']) ? ($input['isSerialized'] ? 1 : 0) : 1;
        $reorderLevel = intval($input['reorderLevel'] ?? 10);

        if (!$id || empty($code) || empty($name)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'ID, Code, and Name are required']);
            exit();
        }

        $stmt = $pdo->prepare("UPDATE categories SET code = ?, name = ?, description = ?, is_serialized = ?, reorder_level = ? WHERE id = ?");
        $stmt->execute([$code, $name, $description, $isSerialized, $reorderLevel, $id]);

        logPhpAudit($pdo, $userId, 'CATEGORY_UPDATED', 'CATEGORY', $id, ['code' => $code, 'name' => $name]);

        echo json_encode(['success' => true, 'message' => 'Category updated successfully']);
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
            echo json_encode(['success' => false, 'error' => 'Category ID is required']);
            exit();
        }

        $stmt = $pdo->prepare("DELETE FROM categories WHERE id = ?");
        $stmt->execute([$id]);

        logPhpAudit($pdo, $userId, 'CATEGORY_DELETED', 'CATEGORY', $id);

        echo json_encode(['success' => true, 'message' => 'Category deleted successfully']);
        break;

    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
}
