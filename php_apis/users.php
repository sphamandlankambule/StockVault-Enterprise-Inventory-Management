<?php
/**
 * PHP API Endpoint: php_apis/users.php
 * Handles Admin-Only User Provisioning, Status Toggling, and Password Resets
 */

require_once __DIR__ . '/db_connection.php';

$headers = getallheaders();
$userRole = $headers['X-User-Role'] ?? $headers['x-user-role'] ?? 'ADMIN';
$adminUserId = $headers['X-User-Id'] ?? $headers['x-user-id'] ?? 1;

$method = $_SERVER['REQUEST_METHOD'];

switch ($method) {
    case 'GET':
        // List all users with department and role info
        $stmt = $pdo->query("
            SELECT u.id, u.username, u.full_name as fullName, u.email, u.status, u.created_at as createdAt,
                   r.name as role, d.id as departmentId, d.name as departmentName
            FROM users u
            JOIN roles r ON u.role_id = r.id
            JOIN departments d ON u.department_id = d.id
            ORDER BY u.id ASC
        ");
        $users = $stmt->fetchAll();
        echo json_encode(['success' => true, 'users' => $users]);
        break;

    case 'POST':
        if ($userRole !== 'ADMIN') {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Forbidden: Admin access required']);
            exit();
        }

        $input = json_decode(file_get_contents('php://input'), true);
        $fullName = trim($input['fullName'] ?? '');
        $email = trim($input['email'] ?? '');
        $username = trim($input['username'] ?? ($email ? explode('@', $email)[0] : ''));
        $roleName = $input['role'] ?? 'STORE_KEEPER';
        $departmentId = $input['departmentId'] ?? null;
        $rawPassword = $input['password'] ?? 'StockVault@2025';

        if (empty($fullName) || empty($email) || empty($departmentId)) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'Missing required fields: fullName, email, departmentId']);
            exit();
        }

        // Check if email or username already exists
        $chk = $pdo->prepare("SELECT id FROM users WHERE email = ? OR username = ?");
        $chk->execute([$email, $username]);
        if ($chk->fetch()) {
            http_response_code(409);
            echo json_encode(['success' => false, 'error' => 'User with this email or username already exists']);
            exit();
        }

        // Resolve role_id
        $roleStmt = $pdo->prepare("SELECT id FROM roles WHERE name = ?");
        $roleStmt->execute([$roleName]);
        $roleId = $roleStmt->fetchColumn() ?: 2;

        $passwordHash = password_hash($rawPassword, PASSWORD_BCRYPT);

        $stmt = $pdo->prepare("
            INSERT INTO users (role_id, department_id, username, full_name, email, password_hash, status, created_by)
            VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?)
        ");
        $stmt->execute([$roleId, $departmentId, $username, $fullName, $email, $passwordHash, $adminUserId]);
        $newUserId = $pdo->lastInsertId();

        logPhpAudit($pdo, $adminUserId, 'USER_PROVISIONED', 'USER', $newUserId, ['fullName' => $fullName, 'email' => $email]);

        echo json_encode(['success' => true, 'id' => $newUserId, 'message' => 'User account provisioned successfully']);
        break;

    case 'PUT':
        if ($userRole !== 'ADMIN') {
            http_response_code(403);
            echo json_encode(['success' => false, 'error' => 'Forbidden: Admin privilege required']);
            exit();
        }

        $input = json_decode(file_get_contents('php://input'), true);
        $targetUserId = $_GET['id'] ?? $input['id'] ?? null;
        $action = $_GET['action'] ?? $input['action'] ?? 'toggle_status';

        if (!$targetUserId) {
            http_response_code(400);
            echo json_encode(['success' => false, 'error' => 'User ID is required']);
            exit();
        }

        if ($action === 'reset_password') {
            $newPassword = $input['newPassword'] ?? '';
            if (strlen($newPassword) < 6) {
                http_response_code(400);
                echo json_encode(['success' => false, 'error' => 'New password must be at least 6 characters long']);
                exit();
            }

            $newHash = password_hash($newPassword, PASSWORD_BCRYPT);
            $updateStmt = $pdo->prepare("UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?");
            $updateStmt->execute([$newHash, $targetUserId]);

            logPhpAudit($pdo, $adminUserId, 'PASSWORD_RESET_BY_ADMIN', 'USER', $targetUserId);
            echo json_encode(['success' => true, 'message' => 'User password reset successfully']);
            exit();
        } else {
            // Toggle Status
            $stmt = $pdo->prepare("SELECT status FROM users WHERE id = ?");
            $stmt->execute([$targetUserId]);
            $currentStatus = $stmt->fetchColumn();

            if (!$currentStatus) {
                http_response_code(404);
                echo json_encode(['success' => false, 'error' => 'User not found']);
                exit();
            }

            $newStatus = ($currentStatus === 'ACTIVE') ? 'INACTIVE' : 'ACTIVE';
            $update = $pdo->prepare("UPDATE users SET status = ? WHERE id = ?");
            $update->execute([$newStatus, $targetUserId]);

            logPhpAudit($pdo, $adminUserId, 'USER_STATUS_TOGGLED', 'USER', $targetUserId, ['newStatus' => $newStatus]);
            echo json_encode(['success' => true, 'status' => $newStatus, 'message' => "User status updated to {$newStatus}"]);
            exit();
        }
        break;

    default:
        http_response_code(405);
        echo json_encode(['error' => 'Method not allowed']);
}
