import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import mysql, { RowDataPacket, ResultSetHeader } from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import { UserRole } from './src/types';

const PORT = 3000;

// MySQL Database Pool Configuration
const dbConfig = {
  host: process.env.DB_HOST || process.env.MYSQL_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || process.env.MYSQL_PORT || 3306),
  user: process.env.DB_USER || process.env.MYSQL_USER || 'root',
  password: process.env.DB_PASSWORD || process.env.DB_PASS || process.env.MYSQL_PASSWORD || '',
  database: process.env.DB_NAME || process.env.MYSQL_DATABASE || 'stockvault_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  connectTimeout: 5000
};

const pool = mysql.createPool(dbConfig);
let isMysqlConnected = false;

async function initMysqlDatabase(): Promise<void> {
  // 1. Attempt to create database if missing on MySQL host
  try {
    const rootConn = await mysql.createConnection({
      host: dbConfig.host,
      port: dbConfig.port,
      user: dbConfig.user,
      password: dbConfig.password,
      connectTimeout: 5000
    });
    await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${dbConfig.database}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
    await rootConn.end();
  } catch (err: any) {
    console.warn('[MySQL Database Check Notice]:', err.message);
  }

  // 2. Ensure all relational tables exist in MySQL
  const ddlStatements = [
    `CREATE TABLE IF NOT EXISTS departments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(20) NOT NULL UNIQUE,
      name VARCHAR(100) NOT NULL,
      description TEXT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS roles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(50) NOT NULL UNIQUE,
      description VARCHAR(255) NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      role_id INT NOT NULL,
      department_id INT NOT NULL,
      username VARCHAR(50) NOT NULL UNIQUE,
      full_name VARCHAR(100) NOT NULL,
      email VARCHAR(150) NOT NULL UNIQUE,
      password_hash VARCHAR(255) NOT NULL,
      status ENUM('ACTIVE', 'INACTIVE') DEFAULT 'ACTIVE',
      created_by INT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      FOREIGN KEY (role_id) REFERENCES roles(id),
      FOREIGN KEY (department_id) REFERENCES departments(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS financial_years (
      id INT AUTO_INCREMENT PRIMARY KEY,
      label VARCHAR(20) NOT NULL UNIQUE,
      start_date DATE NOT NULL,
      end_date DATE NOT NULL,
      is_active BOOLEAN DEFAULT FALSE,
      is_closed BOOLEAN DEFAULT FALSE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS categories (
      id INT AUTO_INCREMENT PRIMARY KEY,
      code VARCHAR(20) NOT NULL UNIQUE,
      name VARCHAR(100) NOT NULL,
      description VARCHAR(255) NULL,
      is_serialized BOOLEAN DEFAULT TRUE,
      reorder_level INT DEFAULT 10
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS stock_batches (
      id INT AUTO_INCREMENT PRIMARY KEY,
      batch_number VARCHAR(50) NOT NULL UNIQUE,
      category_id INT NOT NULL,
      department_id INT NOT NULL,
      financial_year_id INT NOT NULL,
      supplier_name VARCHAR(100) NOT NULL,
      unit_cost DECIMAL(12, 2) NOT NULL,
      is_serialized BOOLEAN DEFAULT TRUE,
      total_quantity INT NOT NULL,
      available_quantity INT NOT NULL,
      status ENUM('ACTIVE', 'DEPLETED', 'DECOMMISSIONED') DEFAULT 'ACTIVE',
      received_by_user_id INT NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (category_id) REFERENCES categories(id),
      FOREIGN KEY (department_id) REFERENCES departments(id),
      FOREIGN KEY (financial_year_id) REFERENCES financial_years(id),
      FOREIGN KEY (received_by_user_id) REFERENCES users(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS inventory_items (
      id INT AUTO_INCREMENT PRIMARY KEY,
      batch_id INT NOT NULL,
      item_code VARCHAR(50) NOT NULL UNIQUE,
      serial_number VARCHAR(100) NOT NULL UNIQUE,
      category_id INT NOT NULL,
      department_id INT NOT NULL,
      financial_year_id INT NOT NULL,
      status ENUM('IN_STOCK', 'ISSUED', 'MAINTENANCE', 'DECOMMISSIONED') DEFAULT 'IN_STOCK',
      unit_cost DECIMAL(12, 2) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES stock_batches(id) ON DELETE CASCADE,
      FOREIGN KEY (category_id) REFERENCES categories(id),
      FOREIGN KEY (department_id) REFERENCES departments(id),
      FOREIGN KEY (financial_year_id) REFERENCES financial_years(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS stock_transactions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      transaction_code VARCHAR(50) NOT NULL UNIQUE,
      type ENUM('STOCK_IN', 'STOCK_OUT', 'TRANSFER', 'ADJUSTMENT') NOT NULL,
      batch_id INT NOT NULL,
      item_id INT NULL,
      financial_year_id INT NOT NULL,
      department_id INT NOT NULL,
      quantity INT NOT NULL,
      unit_cost DECIMAL(12, 2) NOT NULL,
      total_value DECIMAL(14, 2) NOT NULL,
      issued_by_user_id INT NOT NULL,
      received_by_name VARCHAR(100) NOT NULL,
      receiver_department_id INT NOT NULL,
      remarks TEXT NULL,
      ip_address VARCHAR(45) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (batch_id) REFERENCES stock_batches(id),
      FOREIGN KEY (item_id) REFERENCES inventory_items(id),
      FOREIGN KEY (financial_year_id) REFERENCES financial_years(id),
      FOREIGN KEY (department_id) REFERENCES departments(id),
      FOREIGN KEY (issued_by_user_id) REFERENCES users(id),
      FOREIGN KEY (receiver_department_id) REFERENCES departments(id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS signatures (
      id INT AUTO_INCREMENT PRIMARY KEY,
      transaction_id INT NOT NULL UNIQUE,
      issuer_signature_base64 MEDIUMTEXT NOT NULL,
      issuer_name VARCHAR(100) NOT NULL,
      issuer_role VARCHAR(50) NOT NULL,
      receiver_signature_base64 MEDIUMTEXT NOT NULL,
      receiver_name VARCHAR(100) NOT NULL,
      receiver_role VARCHAR(50) NOT NULL,
      ip_address VARCHAR(45) NOT NULL,
      device_timestamp DATETIME NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (transaction_id) REFERENCES stock_transactions(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS audit_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NULL,
      action VARCHAR(100) NOT NULL,
      entity_type VARCHAR(50) NOT NULL,
      entity_id VARCHAR(50) NULL,
      new_values_json JSON NULL,
      ip_address VARCHAR(45) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,

    `CREATE TABLE IF NOT EXISTS system_settings (
      setting_key VARCHAR(100) PRIMARY KEY,
      setting_value TEXT NOT NULL,
      description TEXT DEFAULT NULL,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`
  ];

  for (const stmt of ddlStatements) {
    try {
      await pool.query(stmt);
    } catch (err: any) {
      console.warn('[MySQL DDL Statement Warning]:', err.message);
    }
  }

  // Ensure core system roles exist in MySQL
  await pool.query(`
    INSERT INTO roles (id, name, description) VALUES
    (1, 'ADMIN', 'System Director with full administrative permissions'),
    (2, 'STORE_KEEPER', 'Chief Store Keeper with Stock In/Out and inventory authority'),
    (3, 'STAFF_RECEIVER', 'Staff Lead authorized to request and receive department inventory')
    ON DUPLICATE KEY UPDATE description = VALUES(description);
  `);

  isMysqlConnected = true;
  console.log('[MySQL Driver]: Connected and verified database schema.');
}

// Database Query Execution Wrapper for MySQL
async function dbQuery<T = any>(sql: string, params: any[] = []): Promise<T> {
  try {
    const [rows] = await pool.execute(sql, params);
    return rows as T;
  } catch (err: any) {
    throw new Error(`MySQL Database Error: ${err.message} (Host: ${dbConfig.host}:${dbConfig.port}, Database: ${dbConfig.database})`);
  }
}

// Audit Log Helper
async function addAuditLog(
  userId: string | number | null,
  action: string,
  entityType: string,
  entityId: string | number | null,
  newValues: any,
  req: Request
) {
  try {
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    const jsonVal = typeof newValues === 'string' ? newValues : JSON.stringify(newValues || {});
    await dbQuery(
      `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values_json, ip_address) VALUES (?, ?, ?, ?, ?, ?)`,
      [userId ? Number(userId) : null, action, entityType, entityId ? String(entityId) : null, jsonVal, ip]
    );
  } catch (err) {
    console.warn('[Audit Log Insert Warning]:', err);
  }
}

// Financial Year Resolution Helper
async function getResolvedFyId(fyParam?: any): Promise<number | null> {
  const rows = await dbQuery<RowDataPacket[]>('SELECT id, label, is_active FROM financial_years');
  if (rows.length === 0) return null;

  if (fyParam) {
    const paramStr = String(fyParam);
    const match = rows.find(f => String(f.id) === paramStr || f.label === paramStr || f.label.endsWith(paramStr));
    if (match) return match.id;
  }
  const active = rows.find(f => f.is_active);
  return active ? active.id : rows[0].id;
}

async function startServer() {
  try {
    await initMysqlDatabase();
  } catch (err: any) {
    console.error('[MySQL Connection Error]: Unable to connect to MySQL database:', err.message);
    console.error('Please verify process.env.DB_HOST / MYSQL_HOST, DB_USER, DB_PASSWORD, DB_NAME, DB_PORT credentials.');
  }

  const app = express();
  app.use(express.json({ limit: '10mb' }));

  // ---------------- HEALTH & DB STATUS ROUTES ----------------
  app.get('/api/health', async (_req: Request, res: Response) => {
    try {
      const users = await dbQuery<RowDataPacket[]>('SELECT COUNT(*) as count FROM users');
      const batches = await dbQuery<RowDataPacket[]>('SELECT COUNT(*) as count FROM stock_batches');
      res.json({
        status: 'ok',
        mode: 'MySQL Database Engine (Node.js mysql2)',
        activeUsers: users[0]?.count || 0,
        activeBatches: batches[0]?.count || 0
      });
    } catch (err: any) {
      res.status(500).json({ success: false, mode: 'MySQL', error: err.message });
    }
  });

  app.get('/api/db/status', async (_req: Request, res: Response) => {
    try {
      const users = await dbQuery<RowDataPacket[]>('SELECT COUNT(*) as count FROM users');
      const departments = await dbQuery<RowDataPacket[]>('SELECT COUNT(*) as count FROM departments');
      const categories = await dbQuery<RowDataPacket[]>('SELECT COUNT(*) as count FROM categories');
      const financialYears = await dbQuery<RowDataPacket[]>('SELECT COUNT(*) as count FROM financial_years');
      const stockBatches = await dbQuery<RowDataPacket[]>('SELECT COUNT(*) as count FROM stock_batches');
      const inventoryItems = await dbQuery<RowDataPacket[]>('SELECT COUNT(*) as count FROM inventory_items');
      const stockTransactions = await dbQuery<RowDataPacket[]>('SELECT COUNT(*) as count FROM stock_transactions');
      const auditLogs = await dbQuery<RowDataPacket[]>('SELECT COUNT(*) as count FROM audit_logs');

      res.json({
        success: true,
        connected: isMysqlConnected,
        engine: 'MySQL Database (Node.js mysql2)',
        host: dbConfig.host,
        port: dbConfig.port,
        database: dbConfig.database,
        tables: {
          users: users[0]?.count || 0,
          departments: departments[0]?.count || 0,
          categories: categories[0]?.count || 0,
          financialYears: financialYears[0]?.count || 0,
          stockBatches: stockBatches[0]?.count || 0,
          inventoryItems: inventoryItems[0]?.count || 0,
          stockTransactions: stockTransactions[0]?.count || 0,
          auditLogs: auditLogs[0]?.count || 0
        }
      });
    } catch (err: any) {
      res.status(500).json({
        success: false,
        connected: false,
        engine: 'SQL Database',
        error: err.message
      });
    }
  });

  // ---------------- FIRST-TIME SETUP ROUTES ----------------
  app.get('/api/setup/status', async (req: Request, res: Response) => {
    try {
      const userCountRows = await dbQuery<RowDataPacket[]>('SELECT COUNT(*) as count FROM users');
      const userCount = Number(userCountRows[0]?.count || 0);

      const deptCountRows = await dbQuery<RowDataPacket[]>('SELECT COUNT(*) as count FROM departments');
      const deptCount = Number(deptCountRows[0]?.count || 0);

      return res.json({
        success: true,
        setupRequired: userCount === 0 || deptCount === 0,
        userCount,
        deptCount
      });
    } catch (err: any) {
      return res.json({
        success: true,
        setupRequired: true,
        error: err.message
      });
    }
  });

  app.post('/api/setup/init', async (req: Request, res: Response) => {
    try {
      const {
        adminFullName,
        adminUsername,
        adminEmail,
        adminPassword,
        departmentCode,
        departmentName,
        companyName,
        currencyCode,
        currencySymbol,
        currencyName,
        fyLabel,
        startDate,
        endDate
      } = req.body || {};

      if (!adminUsername || !adminPassword || !adminFullName || !adminEmail || !departmentCode || !departmentName) {
        return res.status(400).json({
          success: false,
          error: 'Please fill in all required fields (Admin account and Primary Department details).'
        });
      }

      // 1. Ensure Roles exist
      await dbQuery(`
        INSERT INTO roles (id, name, description) VALUES
        (1, 'ADMIN', 'System Director with full administrative permissions'),
        (2, 'STORE_KEEPER', 'Chief Store Keeper with Stock In/Out and inventory authority'),
        (3, 'STAFF_RECEIVER', 'Staff Lead authorized to request and receive department inventory')
        ON DUPLICATE KEY UPDATE description = VALUES(description);
      `);

      // 2. Insert primary department
      let deptId = 1;
      const existingDept = await dbQuery<RowDataPacket[]>('SELECT id FROM departments WHERE code = ? OR name = ? LIMIT 1', [departmentCode, departmentName]);
      if (existingDept.length > 0) {
        deptId = existingDept[0].id;
      } else {
        const deptRes = await dbQuery<ResultSetHeader>(
          'INSERT INTO departments (code, name, description, is_active) VALUES (?, ?, ?, 1)',
          [departmentCode, departmentName, 'Primary Enterprise Corporate Vault']
        );
        deptId = deptRes.insertId || 1;
      }

      // 3. Hash password and insert Admin User
      const salt = bcrypt.genSaltSync(10);
      const passwordHash = bcrypt.hashSync(adminPassword, salt);

      const userRes = await dbQuery<ResultSetHeader>(
        `INSERT INTO users (role_id, department_id, username, full_name, email, password_hash, status)
         VALUES (1, ?, ?, ?, ?, ?, 'ACTIVE')`,
        [deptId, adminUsername, adminFullName, adminEmail, passwordHash]
      );
      const adminId = userRes.insertId || 1;

      // 4. Create Active Financial Year
      const fyLabelVal = fyLabel || '2025-2026';
      const startVal = startDate || '2025-04-01';
      const endVal = endDate || '2026-03-31';

      await dbQuery(
        `INSERT INTO financial_years (label, start_date, end_date, is_active, is_closed)
         VALUES (?, ?, ?, 1, 0)
         ON DUPLICATE KEY UPDATE is_active = VALUES(is_active)`,
        [fyLabelVal, startVal, endVal]
      );

      // 5. System settings
      const compName = companyName || 'StockVault Enterprise Warehouse';
      const currCode = currencyCode || 'SZL';
      const currSym = currencySymbol || 'E';
      const currName = currencyName || 'Eswatini Lilangeni';

      const settings = [
        ['company_name', compName],
        ['currency_code', currCode],
        ['currency_symbol', currSym],
        ['currency_name', currName],
        ['low_stock_global_threshold', '5'],
        ['require_dual_signatures', '1']
      ];

      for (const [key, val] of settings) {
        await dbQuery(
          `INSERT INTO system_settings (setting_key, setting_value) VALUES (?, ?)
           ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
          [key, val]
        );
      }

      // 6. Audit Log
      await dbQuery(
        `INSERT INTO audit_logs (user_id, action, entity_type, entity_id, new_values_json, ip_address)
         VALUES (?, 'FIRST_TIME_SETUP', 'SETUP', '1', ?, ?)`,
        [adminId, JSON.stringify({ adminUsername, adminFullName, departmentName, companyName }), req.ip || '127.0.0.1']
      );

      const createdUser = {
        id: String(adminId),
        username: adminUsername,
        role: 'ADMIN' as UserRole,
        fullName: adminFullName,
        email: adminEmail,
        departmentId: String(deptId),
        departmentName: departmentName,
        status: 'ACTIVE'
      };

      return res.json({
        success: true,
        message: 'First-time setup completed successfully! Primary admin account initialized.',
        user: createdUser
      });
    } catch (err: any) {
      console.error('[Setup Init Error]:', err);
      return res.status(500).json({
        success: false,
        error: `Setup failed: ${err.message}`
      });
    }
  });

  // ---------------- AUTHENTICATION ROUTES ----------------
  app.post(['/api/login', '/api/auth/login', '/api/auth.php'], async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body || {};
      if (!username || !password) {
        return res.status(400).json({ success: false, error: 'Username and password are required' });
      }

      const rows = await dbQuery<RowDataPacket[]>(
        `SELECT u.id, u.username, u.full_name, u.email, u.password_hash, u.status, u.department_id,
                r.name as role_name, d.name as department_name
         FROM users u
         JOIN roles r ON u.role_id = r.id
         LEFT JOIN departments d ON u.department_id = d.id
         WHERE LOWER(u.username) = LOWER(?) OR LOWER(u.email) = LOWER(?)
         LIMIT 1`,
        [username, username]
      );

      if (rows.length === 0) {
        return res.status(401).json({ success: false, error: 'Invalid username or password' });
      }

      const u = rows[0];
      let isPasswordValid = false;
      if (u.password_hash.startsWith('$2a$') || u.password_hash.startsWith('$2b$') || u.password_hash.startsWith('$2y$')) {
        const normalizedHash = u.password_hash.replace(/^\$2y\$/, '$2a$');
        isPasswordValid = bcrypt.compareSync(password, normalizedHash);
      } else {
        isPasswordValid = (u.password_hash === password);
      }

      if (!isPasswordValid) {
        return res.status(401).json({ success: false, error: 'Invalid username or password' });
      }

      if (u.status !== 'ACTIVE') {
        return res.status(403).json({ success: false, error: 'User account is inactive. Please contact system admin.' });
      }

      const userObj = {
        id: String(u.id),
        username: u.username,
        role: u.role_name,
        fullName: u.full_name,
        email: u.email,
        departmentId: String(u.department_id),
        departmentName: u.department_name || '',
        status: u.status
      };

      await addAuditLog(u.id, 'USER_LOGIN', 'USER', u.id, { username }, req);

      res.json({ success: true, user: userObj, token: `token-${u.id}` });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post(['/api/auth/change-password', '/api/auth/change_password.php'], async (req: Request, res: Response) => {
    try {
      const { userId, oldPassword, newPassword } = req.body || {};
      const rows = await dbQuery<RowDataPacket[]>('SELECT * FROM users WHERE id = ?', [userId]);
      if (rows.length === 0) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
      const u = rows[0];
      let isPasswordValid = false;
      if (u.password_hash.startsWith('$2a$') || u.password_hash.startsWith('$2b$') || u.password_hash.startsWith('$2y$')) {
        const normalizedHash = u.password_hash.replace(/^\$2y\$/, '$2a$');
        isPasswordValid = bcrypt.compareSync(oldPassword, normalizedHash);
      } else {
        isPasswordValid = (u.password_hash === oldPassword);
      }

      if (!isPasswordValid) {
        return res.status(400).json({ success: false, error: 'Current password is incorrect' });
      }

      const newHash = bcrypt.hashSync(newPassword, 10);
      await dbQuery('UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?', [newHash, userId]);
      await addAuditLog(userId, 'PASSWORD_CHANGED', 'USER', userId, {}, req);

      res.json({ success: true, message: 'Password updated successfully' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ---------------- USER MANAGEMENT ROUTES ----------------
  app.get(['/api/users', '/api/users.php'], async (_req: Request, res: Response) => {
    try {
      const rows = await dbQuery<RowDataPacket[]>(
        `SELECT u.id, u.username, u.full_name, u.email, u.status, u.created_by, u.created_at, u.updated_at, u.department_id,
                r.name as role, d.name as department_name
         FROM users u
         JOIN roles r ON u.role_id = r.id
         LEFT JOIN departments d ON u.department_id = d.id
         ORDER BY u.id ASC`
      );
      const users = rows.map(u => ({
        id: String(u.id),
        username: u.username,
        role: u.role,
        fullName: u.full_name,
        email: u.email,
        departmentId: String(u.department_id),
        departmentName: u.department_name || '',
        status: u.status,
        createdBy: String(u.created_by || ''),
        createdAt: u.created_at,
        updatedAt: u.updated_at
      }));
      res.json({ success: true, users });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post(['/api/users', '/api/users.php'], async (req: Request, res: Response) => {
    try {
      const body = req.body || {};
      const roleRows = await dbQuery<RowDataPacket[]>('SELECT id FROM roles WHERE name = ? LIMIT 1', [body.role || 'STAFF_RECEIVER']);
      const roleId = roleRows[0]?.id || 3;

      const deptRows = await dbQuery<RowDataPacket[]>('SELECT id FROM departments WHERE id = ? LIMIT 1', [body.departmentId || 1]);
      const deptId = deptRows[0]?.id || 1;

      const hash = bcrypt.hashSync(body.password || 'User@123', 10);
      const creatorId = req.headers['x-user-id'] ? Number(req.headers['x-user-id']) : null;

      const result = await dbQuery<ResultSetHeader>(
        `INSERT INTO users (role_id, department_id, username, full_name, email, password_hash, status, created_by)
         VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE', ?)`,
        [roleId, deptId, body.username || `user_${Date.now()}`, body.fullName || 'New User', body.email || `user_${Date.now()}@stockvault.com`, hash, creatorId]
      );

      const newUserId = result.insertId;
      await addAuditLog(creatorId, 'USER_CREATED', 'USER', newUserId, { fullName: body.fullName, role: body.role }, req);

      const usersRows = await dbQuery<RowDataPacket[]>(
        `SELECT u.id, u.username, u.full_name, u.email, u.status, u.created_by, u.created_at, u.updated_at, u.department_id,
                r.name as role, d.name as department_name
         FROM users u
         JOIN roles r ON u.role_id = r.id
         LEFT JOIN departments d ON u.department_id = d.id
         ORDER BY u.id ASC`
      );
      const users = usersRows.map(u => ({
        id: String(u.id),
        username: u.username,
        role: u.role,
        fullName: u.full_name,
        email: u.email,
        departmentId: String(u.department_id),
        departmentName: u.department_name || '',
        status: u.status,
        createdBy: String(u.created_by || ''),
        createdAt: u.created_at,
        updatedAt: u.updated_at
      }));

      const newUser = users.find(u => String(u.id) === String(newUserId));
      res.json({ success: true, user: newUser, users });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.put(['/api/users/:id/status', '/api/users/:id/status.php'], async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status } = req.body || {};
      await dbQuery('UPDATE users SET status = ?, updated_at = NOW() WHERE id = ?', [status || 'ACTIVE', id]);
      await addAuditLog(req.headers['x-user-id'] ? Number(req.headers['x-user-id']) : null, 'USER_STATUS_UPDATED', 'USER', id, { status }, req);

      const rows = await dbQuery<RowDataPacket[]>(
        `SELECT u.id, u.username, u.full_name, u.email, u.status, u.created_by, u.created_at, u.updated_at, u.department_id,
                r.name as role, d.name as department_name
         FROM users u
         JOIN roles r ON u.role_id = r.id
         LEFT JOIN departments d ON u.department_id = d.id
         WHERE u.id = ?`,
        [id]
      );

      if (rows.length === 0) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
      const u = rows[0];
      res.json({
        success: true,
        user: {
          id: String(u.id),
          username: u.username,
          role: u.role,
          fullName: u.full_name,
          email: u.email,
          departmentId: String(u.department_id),
          departmentName: u.department_name || '',
          status: u.status,
          createdBy: String(u.created_by || ''),
          createdAt: u.created_at,
          updatedAt: u.updated_at
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post(['/api/users/:id/reset-password', '/api/users/:id/reset_password.php'], async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { newPassword } = req.body || {};
      const hash = bcrypt.hashSync(newPassword || 'StockVault@123', 10);
      await dbQuery('UPDATE users SET password_hash = ?, updated_at = NOW() WHERE id = ?', [hash, id]);
      await addAuditLog(req.headers['x-user-id'] ? Number(req.headers['x-user-id']) : null, 'PASSWORD_RESET', 'USER', id, {}, req);
      res.json({ success: true, message: 'Password reset successful' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ---------------- DEPARTMENTS ROUTES ----------------
  app.get(['/api/departments', '/api/departments.php'], async (_req: Request, res: Response) => {
    try {
      const rows = await dbQuery<RowDataPacket[]>('SELECT id, code, name, description, created_at FROM departments ORDER BY id ASC');
      const departments = rows.map(d => ({
        id: String(d.id),
        code: d.code,
        name: d.name,
        description: d.description || '',
        budgetCode: d.code,
        createdAt: d.created_at
      }));
      res.json({ success: true, departments });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post(['/api/departments', '/api/departments.php'], async (req: Request, res: Response) => {
    try {
      const body = req.body || {};
      const code = body.code || `DEP-${Date.now()}`;
      const name = body.name || 'New Department';
      const description = body.description || '';

      const result = await dbQuery<ResultSetHeader>(
        'INSERT INTO departments (code, name, description) VALUES (?, ?, ?)',
        [code, name, description]
      );

      await addAuditLog(req.headers['x-user-id'] ? Number(req.headers['x-user-id']) : null, 'DEPARTMENT_CREATED', 'DEPARTMENT', result.insertId, { name }, req);

      const rows = await dbQuery<RowDataPacket[]>('SELECT id, code, name, description, created_at FROM departments ORDER BY id ASC');
      const departments = rows.map(d => ({
        id: String(d.id),
        code: d.code,
        name: d.name,
        description: d.description || '',
        budgetCode: d.code,
        createdAt: d.created_at
      }));

      const newDept = departments.find(d => String(d.id) === String(result.insertId));
      res.json({ success: true, department: newDept, departments });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ---------------- CATEGORIES ROUTES ----------------
  app.get(['/api/categories', '/api/categories.php'], async (_req: Request, res: Response) => {
    try {
      const rows = await dbQuery<RowDataPacket[]>('SELECT id, code, name, description, is_serialized, reorder_level FROM categories ORDER BY id ASC');
      const categories = rows.map(c => ({
        id: String(c.id),
        code: c.code,
        name: c.name,
        description: c.description || '',
        isSerialized: Boolean(c.is_serialized),
        lowStockThreshold: c.reorder_level || 5,
        createdAt: new Date().toISOString()
      }));
      res.json({ success: true, categories });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post(['/api/categories', '/api/categories.php'], async (req: Request, res: Response) => {
    try {
      const body = req.body || {};
      const code = body.code || `CAT-${Date.now()}`;
      const name = body.name || 'New Category';
      const description = body.description || '';
      const isSerialized = body.isSerialized !== false;
      const reorderLevel = Number(body.lowStockThreshold) || 5;

      const result = await dbQuery<ResultSetHeader>(
        'INSERT INTO categories (code, name, description, is_serialized, reorder_level) VALUES (?, ?, ?, ?, ?)',
        [code, name, description, isSerialized, reorderLevel]
      );

      await addAuditLog(req.headers['x-user-id'] ? Number(req.headers['x-user-id']) : null, 'CATEGORY_CREATED', 'CATEGORY', result.insertId, { name }, req);

      const rows = await dbQuery<RowDataPacket[]>('SELECT id, code, name, description, is_serialized, reorder_level FROM categories ORDER BY id ASC');
      const categories = rows.map(c => ({
        id: String(c.id),
        code: c.code,
        name: c.name,
        description: c.description || '',
        isSerialized: Boolean(c.is_serialized),
        lowStockThreshold: c.reorder_level || 5,
        createdAt: new Date().toISOString()
      }));

      const newCat = categories.find(c => String(c.id) === String(result.insertId));
      res.json({ success: true, category: newCat, categories });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ---------------- FINANCIAL YEARS ROUTES ----------------
  app.get(['/api/financial-years', '/api/financial_years.php'], async (_req: Request, res: Response) => {
    try {
      const rows = await dbQuery<RowDataPacket[]>('SELECT id, label, start_date, end_date, is_active, is_closed FROM financial_years ORDER BY id ASC');
      const financialYears = rows.map(f => ({
        id: String(f.id),
        yearCode: f.label,
        startDate: f.start_date,
        endDate: f.end_date,
        isActive: Boolean(f.is_active),
        isClosed: Boolean(f.is_closed),
        createdAt: f.start_date
      }));
      res.json({ success: true, financialYears });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post(['/api/financial-years', '/api/financial_years.php'], async (req: Request, res: Response) => {
    try {
      const body = req.body || {};
      const label = body.yearCode || body.label || '2025-2026';
      const startDate = body.startDate || '2025-04-01';
      const endDate = body.endDate || '2026-03-31';
      const isActive = Boolean(body.isActive);

      if (isActive) {
        await dbQuery('UPDATE financial_years SET is_active = FALSE');
      }

      const result = await dbQuery<ResultSetHeader>(
        'INSERT INTO financial_years (label, start_date, end_date, is_active, is_closed) VALUES (?, ?, ?, ?, FALSE)',
        [label, startDate, endDate, isActive]
      );

      await addAuditLog(req.headers['x-user-id'] ? Number(req.headers['x-user-id']) : null, 'FINANCIAL_YEAR_CREATED', 'FINANCIAL_YEAR', result.insertId, { label }, req);

      const rows = await dbQuery<RowDataPacket[]>('SELECT id, label, start_date, end_date, is_active, is_closed FROM financial_years ORDER BY id ASC');
      const financialYears = rows.map(f => ({
        id: String(f.id),
        yearCode: f.label,
        startDate: f.start_date,
        endDate: f.end_date,
        isActive: Boolean(f.is_active),
        isClosed: Boolean(f.is_closed),
        createdAt: f.start_date
      }));

      const newFy = financialYears.find(f => String(f.id) === String(result.insertId));
      res.json({ success: true, financialYear: newFy, financialYears });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.put(['/api/financial-years/:id/activate', '/api/financial_years/:id/activate'], async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      await dbQuery('UPDATE financial_years SET is_active = FALSE');
      await dbQuery('UPDATE financial_years SET is_active = TRUE WHERE id = ?', [id]);
      await addAuditLog(req.headers['x-user-id'] ? Number(req.headers['x-user-id']) : null, 'FINANCIAL_YEAR_ACTIVATED', 'FINANCIAL_YEAR', id, { activeId: id }, req);

      const rows = await dbQuery<RowDataPacket[]>('SELECT id, label, start_date, end_date, is_active, is_closed FROM financial_years ORDER BY id ASC');
      const financialYears = rows.map(f => ({
        id: String(f.id),
        yearCode: f.label,
        startDate: f.start_date,
        endDate: f.end_date,
        isActive: Boolean(f.is_active),
        isClosed: Boolean(f.is_closed),
        createdAt: f.start_date
      }));

      res.json({ success: true, financialYears });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ---------------- STOCK BATCHES ROUTES ----------------
  app.get(['/api/stock/batches', '/api/stock_batches.php'], async (req: Request, res: Response) => {
    try {
      const { financialYearId, departmentId } = req.query;
      let sql = `
        SELECT b.id, b.batch_number, b.category_id, cat.name as category_name,
               b.department_id, dept.name as department_name,
               b.financial_year_id, fy.label as financial_year_code,
               b.supplier_name, b.unit_cost, b.is_serialized, b.total_quantity, b.available_quantity,
               b.status, b.received_by_user_id, u.full_name as received_by_name, b.created_at
        FROM stock_batches b
        LEFT JOIN categories cat ON b.category_id = cat.id
        LEFT JOIN departments dept ON b.department_id = dept.id
        LEFT JOIN financial_years fy ON b.financial_year_id = fy.id
        LEFT JOIN users u ON b.received_by_user_id = u.id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (financialYearId) {
        const resolvedFy = await getResolvedFyId(financialYearId);
        if (resolvedFy) {
          sql += ' AND b.financial_year_id = ?';
          params.push(resolvedFy);
        }
      }
      if (departmentId && String(departmentId).trim() !== '') {
        sql += ' AND b.department_id = ?';
        params.push(departmentId);
      }
      sql += ' ORDER BY b.id DESC';

      const rows = await dbQuery<RowDataPacket[]>(sql, params);
      const batches = rows.map(b => ({
        id: String(b.id),
        batchNumber: b.batch_number,
        categoryId: String(b.category_id),
        categoryName: b.category_name || 'General',
        departmentId: String(b.department_id),
        departmentName: b.department_name || 'Central Store',
        financialYearId: String(b.financial_year_id),
        financialYearCode: b.financial_year_code || '2025-2026',
        supplierName: b.supplier_name,
        unitCost: Number(b.unit_cost),
        isSerialized: Boolean(b.is_serialized),
        totalQuantity: b.total_quantity,
        availableQuantity: b.available_quantity,
        receivedByUserId: String(b.received_by_user_id),
        receivedByName: b.received_by_name || 'Chief Store Keeper',
        status: b.status,
        remarks: b.supplier_name,
        createdAt: b.created_at
      }));

      res.json({ success: true, batches });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post(['/api/stock/batches', '/api/add-stock', '/api/add_stock.php', '/api/stock_batches.php'], async (req: Request, res: Response) => {
    try {
      const body = req.body || {};
      const fyId = await getResolvedFyId(body.financialYearId);
      const categoryId = Number(body.categoryId) || 1;
      const departmentId = Number(body.departmentId) || 1;
      const totalQty = Number(body.totalQuantity) || Number(body.quantity) || 1;
      const unitCost = Number(body.unitCost) || 0;
      const isSerialized = Boolean(body.isSerialized);

      const receivedByUserId = req.headers['x-user-id'] ? Number(req.headers['x-user-id']) : 2;
      const batchNumber = body.batchNumber || `BAT-${Date.now()}`;
      const supplierName = body.supplierName || 'Vendor Direct Supply';

      const batchRes = await dbQuery<ResultSetHeader>(
        `INSERT INTO stock_batches (batch_number, category_id, department_id, financial_year_id, supplier_name, unit_cost, is_serialized, total_quantity, available_quantity, status, received_by_user_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)`,
        [batchNumber, categoryId, departmentId, fyId, supplierName, unitCost, isSerialized, totalQty, totalQty, receivedByUserId]
      );

      const batchId = batchRes.insertId;

      if (isSerialized) {
        const rawSerials = body.serials || body.serialNumbers || body.serialsList || body.serial_numbers;
        const serials: string[] = Array.isArray(rawSerials)
          ? rawSerials
          : (typeof rawSerials === 'string' ? rawSerials.split(/[\n,]/).map(s => s.trim()).filter(Boolean) : []);

        for (let i = 0; i < totalQty; i++) {
          const itemCode = `ITM-${batchNumber}-${i + 1}`;
          const serial = (serials[i] && serials[i].trim().length > 0) ? serials[i].trim() : `SN-${batchNumber}-${i + 1}`;
          await dbQuery(
            `INSERT INTO inventory_items (batch_id, item_code, serial_number, category_id, department_id, financial_year_id, status, unit_cost)
             VALUES (?, ?, ?, ?, ?, ?, 'IN_STOCK', ?)`,
            [batchId, itemCode, serial, categoryId, departmentId, fyId, unitCost]
          );
        }
      }

      const txCode = `TX-IN-${Date.now()}`;
      await dbQuery(
        `INSERT INTO stock_transactions (transaction_code, type, batch_id, financial_year_id, department_id, quantity, unit_cost, total_value, issued_by_user_id, received_by_name, receiver_department_id, remarks, ip_address)
         VALUES (?, 'STOCK_IN', ?, ?, ?, ?, ?, ?, ?, 'Store Vault Central', ?, ?, ?)`,
        [txCode, batchId, fyId, departmentId, totalQty, unitCost, totalQty * unitCost, receivedByUserId, departmentId, body.remarks || `Received batch ${batchNumber}`, (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1']
      );

      await addAuditLog(receivedByUserId, 'STOCK_IN_BATCH', 'STOCK_BATCH', batchId, { batchNumber, totalQty }, req);

      const rows = await dbQuery<RowDataPacket[]>(
        `SELECT b.id, b.batch_number, b.category_id, cat.name as category_name,
                b.department_id, dept.name as department_name,
                b.financial_year_id, fy.label as financial_year_code,
                b.supplier_name, b.unit_cost, b.is_serialized, b.total_quantity, b.available_quantity,
                b.status, b.received_by_user_id, u.full_name as received_by_name, b.created_at
         FROM stock_batches b
         LEFT JOIN categories cat ON b.category_id = cat.id
         LEFT JOIN departments dept ON b.department_id = dept.id
         LEFT JOIN financial_years fy ON b.financial_year_id = fy.id
         LEFT JOIN users u ON b.received_by_user_id = u.id
         ORDER BY b.id DESC`
      );
      const batches = rows.map(b => ({
        id: String(b.id),
        batchNumber: b.batch_number,
        categoryId: String(b.category_id),
        categoryName: b.category_name || 'General',
        departmentId: String(b.department_id),
        departmentName: b.department_name || 'Central Store',
        financialYearId: String(b.financial_year_id),
        financialYearCode: b.financial_year_code || '2025-2026',
        supplierName: b.supplier_name,
        unitCost: Number(b.unit_cost),
        isSerialized: Boolean(b.is_serialized),
        totalQuantity: b.total_quantity,
        availableQuantity: b.available_quantity,
        receivedByUserId: String(b.received_by_user_id),
        receivedByName: b.received_by_name || 'Chief Store Keeper',
        status: b.status,
        remarks: b.supplier_name,
        createdAt: b.created_at
      }));

      const newBatch = batches.find(b => String(b.id) === String(batchId));
      res.json({ success: true, batch: newBatch, batches });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ---------------- INVENTORY ITEMS ROUTES ----------------
  app.get(['/api/stock/items', '/api/inventory_items.php'], async (req: Request, res: Response) => {
    try {
      const { financialYearId, departmentId } = req.query;
      let sql = `
        SELECT i.id, i.batch_id, b.batch_number, i.item_code, i.serial_number,
               i.category_id, cat.name as category_name,
               i.department_id, dept.name as department_name,
               i.financial_year_id, fy.label as financial_year_code,
               i.status, i.unit_cost, i.created_at
        FROM inventory_items i
        LEFT JOIN stock_batches b ON i.batch_id = b.id
        LEFT JOIN categories cat ON i.category_id = cat.id
        LEFT JOIN departments dept ON i.department_id = dept.id
        LEFT JOIN financial_years fy ON i.financial_year_id = fy.id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (financialYearId) {
        const resolvedFy = await getResolvedFyId(financialYearId);
        if (resolvedFy) {
          sql += ' AND i.financial_year_id = ?';
          params.push(resolvedFy);
        }
      }
      if (departmentId && String(departmentId).trim() !== '') {
        sql += ' AND i.department_id = ?';
        params.push(departmentId);
      }
      sql += ' ORDER BY i.id DESC';

      const rows = await dbQuery<RowDataPacket[]>(sql, params);
      const items = rows.map(i => ({
        id: String(i.id),
        batchId: String(i.batch_id),
        batchNumber: i.batch_number || '',
        itemCode: i.item_code,
        serialNumber: i.serial_number,
        categoryId: String(i.category_id),
        categoryName: i.category_name || 'General',
        departmentId: String(i.department_id),
        departmentName: i.department_name || 'Central Store',
        financialYearId: String(i.financial_year_id),
        financialYearCode: i.financial_year_code || '2025-2026',
        status: i.status,
        unitCost: Number(i.unit_cost),
        location: 'Warehouse Storage',
        notes: 'Stored in Database',
        createdAt: i.created_at,
        updatedAt: i.created_at
      }));

      res.json({ success: true, items });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.get(['/api/stock/check-serial', '/api/check_serial.php'], async (req: Request, res: Response) => {
    try {
      const serial = req.query.serial ? String(req.query.serial).trim() : '';
      if (!serial) {
        return res.json({ exists: false });
      }

      const rows = await dbQuery<RowDataPacket[]>(
        `SELECT i.id, i.batch_id, b.batch_number, i.item_code, i.serial_number,
                i.category_id, cat.name as category_name,
                i.department_id, dept.name as department_name,
                i.financial_year_id, fy.label as financial_year_code,
                i.status, i.unit_cost, i.created_at
         FROM inventory_items i
         LEFT JOIN stock_batches b ON i.batch_id = b.id
         LEFT JOIN categories cat ON i.category_id = cat.id
         LEFT JOIN departments dept ON i.department_id = dept.id
         LEFT JOIN financial_years fy ON i.financial_year_id = fy.id
         WHERE LOWER(i.serial_number) = LOWER(?) LIMIT 1`,
        [serial]
      );

      if (rows.length === 0) {
        return res.json({ exists: false });
      }

      const i = rows[0];
      res.json({
        exists: true,
        item: {
          id: String(i.id),
          batchId: String(i.batch_id),
          batchNumber: i.batch_number || '',
          itemCode: i.item_code,
          serialNumber: i.serial_number,
          categoryId: String(i.category_id),
          categoryName: i.category_name || 'General',
          departmentId: String(i.department_id),
          departmentName: i.department_name || 'Central Store',
          financialYearId: String(i.financial_year_id),
          financialYearCode: i.financial_year_code || '2025-2026',
          status: i.status,
          unitCost: Number(i.unit_cost),
          createdAt: i.created_at
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.put(['/api/stock/items/:id/status', '/api/inventory_items/:id/status'], async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { status } = req.body || {};
      await dbQuery('UPDATE inventory_items SET status = ? WHERE id = ?', [status, id]);
      await addAuditLog(req.headers['x-user-id'] ? Number(req.headers['x-user-id']) : null, 'ITEM_STATUS_CHANGED', 'INVENTORY_ITEM', id, { newStatus: status }, req);

      const rows = await dbQuery<RowDataPacket[]>('SELECT * FROM inventory_items WHERE id = ?', [id]);
      if (rows.length === 0) {
        return res.status(404).json({ success: false, error: 'Item not found' });
      }
      const item = rows[0];
      res.json({
        success: true,
        item: {
          id: String(item.id),
          batchId: String(item.batch_id),
          itemCode: item.item_code,
          serialNumber: item.serial_number,
          status: item.status,
          unitCost: Number(item.unit_cost),
          updatedAt: new Date().toISOString()
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ---------------- STOCK DISPATCH / OUT ROUTES ----------------
  app.post(['/api/stock/dispatch', '/api/stock-out', '/api/stock_out.php'], async (req: Request, res: Response) => {
    try {
      const body = req.body || {};
      const batchId = Number(body.batchId);
      const batchRows = await dbQuery<RowDataPacket[]>('SELECT * FROM stock_batches WHERE id = ?', [batchId]);

      if (batchRows.length === 0) {
        return res.status(400).json({ success: false, error: 'Invalid batch selected for dispatch' });
      }

      const batch = batchRows[0];
      const qty = Number(body.quantity) || 1;
      if (batch.available_quantity < qty) {
        return res.status(400).json({ success: false, error: `Insufficient stock in batch. Available: ${batch.available_quantity}` });
      }

      await dbQuery('UPDATE stock_batches SET available_quantity = available_quantity - ? WHERE id = ?', [qty, batchId]);

      let itemId: number | null = null;
      let serialNumber: string | undefined = undefined;
      if (body.itemId) {
        itemId = Number(body.itemId);
        const itemRows = await dbQuery<RowDataPacket[]>('SELECT serial_number FROM inventory_items WHERE id = ?', [itemId]);
        if (itemRows.length > 0) {
          serialNumber = itemRows[0].serial_number;
        }
        await dbQuery("UPDATE inventory_items SET status = 'ISSUED' WHERE id = ?", [itemId]);
      }

      const issuerUserId = req.headers['x-user-id'] ? Number(req.headers['x-user-id']) : 2;
      const receiverDeptId = Number(body.receiverDepartmentId || body.departmentId || batch.department_id);
      const txCode = `TX-OUT-${Date.now()}`;
      const sigs = body.signatures || {};

      const txRes = await dbQuery<ResultSetHeader>(
        `INSERT INTO stock_transactions (transaction_code, type, batch_id, item_id, financial_year_id, department_id, quantity, unit_cost, total_value, issued_by_user_id, received_by_name, receiver_department_id, remarks, ip_address)
         VALUES (?, 'STOCK_OUT', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          txCode,
          batchId,
          itemId,
          batch.financial_year_id,
          batch.department_id,
          qty,
          batch.unit_cost,
          qty * Number(batch.unit_cost),
          issuerUserId,
          body.receiverName || sigs.receiverName || 'Sarah Jenkins',
          receiverDeptId,
          body.remarks || 'Dispatched with verified dual signatures',
          (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1'
        ]
      );

      const transactionId = txRes.insertId;

      if (sigs.issuerSignatureBase64 || sigs.receiverSignatureBase64) {
        await dbQuery(
          `INSERT INTO signatures (transaction_id, issuer_signature_base64, issuer_name, issuer_role, receiver_signature_base64, receiver_name, receiver_role, ip_address, device_timestamp)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
          [
            transactionId,
            sigs.issuerSignatureBase64 || sigs.issuerBase64 || '',
            sigs.issuerName || 'Marcus Vance',
            'STORE_KEEPER',
            sigs.receiverSignatureBase64 || sigs.receiverBase64 || '',
            body.receiverName || sigs.receiverName || 'Sarah Jenkins',
            'STAFF_RECEIVER',
            (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1'
          ]
        );
      }

      await addAuditLog(issuerUserId, 'STOCK_DISPATCH_DUAL_SIG', 'STOCK_TRANSACTION', transactionId, { txCode, batchId, qty }, req);

      res.json({
        success: true,
        transaction: {
          id: String(transactionId),
          transactionCode: txCode,
          type: 'STOCK_OUT',
          batchId: String(batchId),
          itemId: itemId ? String(itemId) : undefined,
          serialNumber,
          quantity: qty,
          unitCost: Number(batch.unit_cost),
          totalValue: qty * Number(batch.unit_cost),
          issuedByUserId: String(issuerUserId),
          issuedByName: sigs.issuerName || 'Marcus Vance',
          receivedByName: body.receiverName || sigs.receiverName || 'Sarah Jenkins',
          receiverDepartmentId: String(receiverDeptId),
          timestamp: new Date().toISOString()
        },
        batch: {
          id: String(batch.id),
          batchNumber: batch.batch_number,
          availableQuantity: batch.available_quantity - qty
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ---------------- TRANSACTIONS ROUTES ----------------
  app.get(['/api/transactions', '/api/transactions.php'], async (_req: Request, res: Response) => {
    try {
      const rows = await dbQuery<RowDataPacket[]>(
        `SELECT t.id, t.transaction_code, t.type, t.batch_id, t.item_id, i.serial_number,
                cat.name as category_name, t.financial_year_id, fy.label as financial_year_code,
                t.department_id, dept.name as department_name, t.quantity, t.unit_cost, t.total_value,
                t.issued_by_user_id, u.full_name as issued_by_name, t.received_by_name,
                t.receiver_department_id, rdept.name as receiver_department_name,
                t.remarks, t.ip_address, t.created_at,
                sig.issuer_signature_base64, sig.issuer_name as sig_issuer_name, sig.issuer_role as sig_issuer_role,
                sig.receiver_signature_base64, sig.receiver_name as sig_receiver_name, sig.receiver_role as sig_receiver_role,
                sig.ip_address as sig_ip, sig.device_timestamp as sig_timestamp
         FROM stock_transactions t
         LEFT JOIN stock_batches b ON t.batch_id = b.id
         LEFT JOIN categories cat ON b.category_id = cat.id
         LEFT JOIN departments dept ON t.department_id = dept.id
         LEFT JOIN departments rdept ON t.receiver_department_id = rdept.id
         LEFT JOIN financial_years fy ON t.financial_year_id = fy.id
         LEFT JOIN users u ON t.issued_by_user_id = u.id
         LEFT JOIN inventory_items i ON t.item_id = i.id
         LEFT JOIN signatures sig ON t.id = sig.transaction_id
         ORDER BY t.id DESC`
      );

      const transactions = rows.map(t => ({
        id: String(t.id),
        transactionCode: t.transaction_code,
        type: t.type,
        batchId: String(t.batch_id),
        itemId: t.item_id ? String(t.item_id) : undefined,
        serialNumber: t.serial_number || undefined,
        categoryName: t.category_name || 'General',
        financialYearId: String(t.financial_year_id),
        financialYearCode: t.financial_year_code || '2025-2026',
        departmentId: String(t.department_id),
        departmentName: t.department_name || 'Central Store',
        quantity: t.quantity,
        unitCost: Number(t.unit_cost),
        totalValue: Number(t.total_value),
        issuedByUserId: String(t.issued_by_user_id),
        issuedByName: t.issued_by_name || 'Marcus Vance',
        receivedByName: t.received_by_name || 'Sarah Jenkins',
        receiverDepartmentId: String(t.receiver_department_id),
        receiverDepartmentName: t.receiver_department_name || 'Receiving Department',
        remarks: t.remarks || '',
        signatures: t.sig_issuer_name ? {
          issuerSignatureBase64: t.issuer_signature_base64,
          issuerName: t.sig_issuer_name,
          issuerRole: t.sig_issuer_role,
          receiverSignatureBase64: t.receiver_signature_base64,
          receiverName: t.sig_receiver_name,
          receiverRole: t.sig_receiver_role,
          receiverDepartmentId: String(t.receiver_department_id),
          ipAddress: t.sig_ip || t.ip_address,
          deviceTimestamp: t.sig_timestamp || t.created_at
        } : undefined,
        ipAddress: t.ip_address,
        timestamp: t.created_at
      }));

      res.json({ success: true, transactions });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ---------------- AUDIT LOGS ROUTES ----------------
  app.get(['/api/audit-logs', '/api/audit_logs.php'], async (_req: Request, res: Response) => {
    try {
      const rows = await dbQuery<RowDataPacket[]>(
        `SELECT a.id, a.user_id, u.full_name as user_name, r.name as user_role,
                a.action, a.entity_type, a.entity_id, a.new_values_json, a.ip_address, a.created_at
         FROM audit_logs a
         LEFT JOIN users u ON a.user_id = u.id
         LEFT JOIN roles r ON u.role_id = r.id
         ORDER BY a.id DESC
         LIMIT 100`
      );

      const logs = rows.map(a => ({
        id: String(a.id),
        userId: String(a.user_id || '1'),
        userName: a.user_name || 'System Administrator',
        userRole: (a.user_role || 'ADMIN') as UserRole,
        action: a.action,
        entityType: a.entity_type,
        entityId: String(a.entity_id || '1'),
        newValues: typeof a.new_values_json === 'string' ? a.new_values_json : JSON.stringify(a.new_values_json || {}),
        ipAddress: a.ip_address || '127.0.0.1',
        userAgent: 'StockVault Enterprise System',
        createdAt: a.created_at
      }));

      res.json({ success: true, auditLogs: logs, logs });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post(['/api/audit-logs', '/api/audit_logs.php'], async (req: Request, res: Response) => {
    try {
      const body = req.body || {};
      const userId = body.userId || req.headers['x-user-id'] || 1;
      await addAuditLog(userId, body.action || 'CUSTOM_ACTION', body.entityType || 'SYSTEM', body.entityId || 1, body.newValues || {}, req);

      const rows = await dbQuery<RowDataPacket[]>(
        `SELECT a.id, a.user_id, u.full_name as user_name, r.name as user_role,
                a.action, a.entity_type, a.entity_id, a.new_values_json, a.ip_address, a.created_at
         FROM audit_logs a
         LEFT JOIN users u ON a.user_id = u.id
         LEFT JOIN roles r ON u.role_id = r.id
         ORDER BY a.id DESC
         LIMIT 100`
      );

      const logs = rows.map(a => ({
        id: String(a.id),
        userId: String(a.user_id || '1'),
        userName: a.user_name || 'System Administrator',
        userRole: (a.user_role || 'ADMIN') as UserRole,
        action: a.action,
        entityType: a.entity_type,
        entityId: String(a.entity_id || '1'),
        newValues: typeof a.new_values_json === 'string' ? a.new_values_json : JSON.stringify(a.new_values_json || {}),
        ipAddress: a.ip_address || '127.0.0.1',
        userAgent: 'StockVault Enterprise System',
        createdAt: a.created_at
      }));

      res.json({ success: true, auditLogs: logs, logs });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ---------------- SETTINGS ROUTES ----------------
  app.get(['/api/settings', '/api/settings.php'], async (_req: Request, res: Response) => {
    try {
      const rows = await dbQuery<RowDataPacket[]>('SELECT setting_key, setting_value FROM system_settings');
      const settingsMap: Record<string, string> = {};
      rows.forEach(r => {
        settingsMap[r.setting_key] = r.setting_value;
      });

      const activeFy = await getResolvedFyId(null);

      const settings = {
        companyName: settingsMap['company_name'] || 'StockVault Enterprise Warehouse',
        currencyCode: settingsMap['currency_code'] || 'SZL',
        currencySymbol: settingsMap['currency_symbol'] || 'E',
        currencyName: settingsMap['currency_name'] || 'Eswatini Lilangeni',
        activeFinancialYearId: String(activeFy || '1'),
        lowStockGlobalThreshold: Number(settingsMap['low_stock_global_threshold'] || 5),
        requireDualSignatures: settingsMap['require_dual_signatures'] === '1' || settingsMap['require_dual_signatures'] === 'true'
      };

      res.json({ success: true, settings });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  app.post(['/api/settings', '/api/settings.php'], async (req: Request, res: Response) => {
    try {
      const body = req.body || {};
      if (body.companyName !== undefined) {
        await dbQuery('INSERT INTO system_settings (setting_key, setting_value) VALUES ("company_name", ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)', [body.companyName]);
      }
      if (body.currencyCode !== undefined) {
        await dbQuery('INSERT INTO system_settings (setting_key, setting_value) VALUES ("currency_code", ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)', [body.currencyCode]);
      }
      if (body.currencySymbol !== undefined) {
        await dbQuery('INSERT INTO system_settings (setting_key, setting_value) VALUES ("currency_symbol", ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)', [body.currencySymbol]);
      }
      if (body.currencyName !== undefined) {
        await dbQuery('INSERT INTO system_settings (setting_key, setting_value) VALUES ("currency_name", ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)', [body.currencyName]);
      }
      if (body.lowStockGlobalThreshold !== undefined) {
        await dbQuery('INSERT INTO system_settings (setting_key, setting_value) VALUES ("low_stock_global_threshold", ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)', [String(body.lowStockGlobalThreshold)]);
      }
      if (body.requireDualSignatures !== undefined) {
        await dbQuery('INSERT INTO system_settings (setting_key, setting_value) VALUES ("require_dual_signatures", ?) ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)', [body.requireDualSignatures ? '1' : '0']);
      }

      await addAuditLog(req.headers['x-user-id'] ? Number(req.headers['x-user-id']) : null, 'SETTINGS_UPDATED', 'SYSTEM', '1', body, req);

      res.json({ success: true, message: 'Settings updated' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ---------------- REPORTS & VALUATION ROUTES ----------------
  app.all(['/api/reports*', '/api/reports.php*'], async (req: Request, res: Response) => {
    try {
      const fyParam = req.query.financialYearId || req.query.financial_year_id;
      const deptId = req.query.departmentId || req.query.department_id;

      const fyId = await getResolvedFyId(fyParam);

      let fyLabel = '2025-2026';
      if (fyId) {
        const fyRows = await dbQuery<RowDataPacket[]>('SELECT label FROM financial_years WHERE id = ?', [fyId]);
        if (fyRows.length > 0) fyLabel = fyRows[0].label;
      }

      let deptName = 'All Organization Departments';
      if (deptId && String(deptId).trim() !== '') {
        const deptRows = await dbQuery<RowDataPacket[]>('SELECT name FROM departments WHERE id = ?', [deptId]);
        if (deptRows.length > 0) deptName = deptRows[0].name;
      }

      let batchSql = `
        SELECT b.id, b.batch_number, b.category_id, cat.name as category_name,
               b.department_id, dept.name as department_name,
               b.financial_year_id, fy.label as financial_year_code,
               b.supplier_name, b.unit_cost, b.is_serialized, b.total_quantity, b.available_quantity,
               b.status, b.received_by_user_id, u.full_name as received_by_name, b.created_at
        FROM stock_batches b
        LEFT JOIN categories cat ON b.category_id = cat.id
        LEFT JOIN departments dept ON b.department_id = dept.id
        LEFT JOIN financial_years fy ON b.financial_year_id = fy.id
        LEFT JOIN users u ON b.received_by_user_id = u.id
        WHERE 1=1
      `;
      const batchParams: any[] = [];
      if (fyId) {
        batchSql += ' AND b.financial_year_id = ?';
        batchParams.push(fyId);
      }
      if (deptId && String(deptId).trim() !== '') {
        batchSql += ' AND b.department_id = ?';
        batchParams.push(deptId);
      }
      const batchRows = await dbQuery<RowDataPacket[]>(batchSql, batchParams);
      const matchingBatches = batchRows.map(b => ({
        id: String(b.id),
        batchNumber: b.batch_number,
        categoryId: String(b.category_id),
        categoryName: b.category_name || 'General',
        departmentId: String(b.department_id),
        departmentName: b.department_name || 'Central Store',
        financialYearId: String(b.financial_year_id),
        financialYearCode: b.financial_year_code || '2025-2026',
        supplierName: b.supplier_name,
        unitCost: Number(b.unit_cost),
        isSerialized: Boolean(b.is_serialized),
        totalQuantity: b.total_quantity,
        availableQuantity: b.available_quantity,
        receivedByUserId: String(b.received_by_user_id),
        receivedByName: b.received_by_name || 'Chief Store Keeper',
        status: b.status,
        remarks: b.supplier_name,
        createdAt: b.created_at
      }));

      let txSql = `
        SELECT t.id, t.transaction_code, t.type, t.batch_id, t.item_id, i.serial_number,
               cat.name as category_name, t.financial_year_id, fy.label as financial_year_code,
               t.department_id, dept.name as department_name, t.quantity, t.unit_cost, t.total_value,
               t.issued_by_user_id, u.full_name as issued_by_name, t.received_by_name,
               t.receiver_department_id, rdept.name as receiver_department_name,
               t.remarks, t.ip_address, t.created_at
        FROM stock_transactions t
        LEFT JOIN stock_batches b ON t.batch_id = b.id
        LEFT JOIN categories cat ON b.category_id = cat.id
        LEFT JOIN departments dept ON t.department_id = dept.id
        LEFT JOIN departments rdept ON t.receiver_department_id = rdept.id
        LEFT JOIN financial_years fy ON t.financial_year_id = fy.id
        LEFT JOIN users u ON t.issued_by_user_id = u.id
        LEFT JOIN inventory_items i ON t.item_id = i.id
        WHERE 1=1
      `;
      const txParams: any[] = [];
      if (fyId) {
        txSql += ' AND t.financial_year_id = ?';
        txParams.push(fyId);
      }
      if (deptId && String(deptId).trim() !== '') {
        txSql += ' AND (t.department_id = ? OR t.receiver_department_id = ?)';
        txParams.push(deptId, deptId);
      }
      const txRows = await dbQuery<RowDataPacket[]>(txSql, txParams);
      const matchingTxs = txRows.map(t => ({
        id: String(t.id),
        transactionCode: t.transaction_code,
        type: t.type,
        batchId: String(t.batch_id),
        itemId: t.item_id ? String(t.item_id) : undefined,
        serialNumber: t.serial_number || undefined,
        categoryName: t.category_name || 'General',
        financialYearId: String(t.financial_year_id),
        financialYearCode: t.financial_year_code || '2025-2026',
        departmentId: String(t.department_id),
        departmentName: t.department_name || 'Central Store',
        quantity: t.quantity,
        unitCost: Number(t.unit_cost),
        totalValue: Number(t.total_value),
        issuedByUserId: String(t.issued_by_user_id),
        issuedByName: t.issued_by_name || 'Marcus Vance',
        receivedByName: t.received_by_name || 'Sarah Jenkins',
        receiverDepartmentId: String(t.receiver_department_id),
        receiverDepartmentName: t.receiver_department_name || 'Receiving Department',
        remarks: t.remarks || '',
        ipAddress: t.ip_address,
        timestamp: t.created_at
      }));

      let itemSql = 'SELECT status FROM inventory_items WHERE 1=1';
      const itemParams: any[] = [];
      if (fyId) {
        itemSql += ' AND financial_year_id = ?';
        itemParams.push(fyId);
      }
      if (deptId && String(deptId).trim() !== '') {
        itemSql += ' AND department_id = ?';
        itemParams.push(deptId);
      }
      const itemRows = await dbQuery<RowDataPacket[]>(itemSql, itemParams);

      const totalIncomingQuantity = matchingBatches.reduce((acc, b) => acc + (Number(b.totalQuantity) || 0), 0);
      const totalIncomingValue = matchingBatches.reduce((acc, b) => acc + (Number(b.totalQuantity) || 0) * (Number(b.unitCost) || 0), 0);

      const remainingStockCount = matchingBatches.reduce((acc, b) => acc + (Number(b.availableQuantity) || 0), 0);
      const remainingStockValue = matchingBatches.reduce((acc, b) => acc + (Number(b.availableQuantity) || 0) * (Number(b.unitCost) || 0), 0);

      const stockOutTxs = matchingTxs.filter(t => t.type === 'STOCK_OUT');
      const totalOutgoingQuantity = stockOutTxs.reduce((acc, t) => acc + (Number(t.quantity) || 0), 0);
      const totalOutgoingValue = stockOutTxs.reduce((acc, t) => acc + (Number(t.totalValue) || 0), 0);

      const itemsUnderMaintenance = itemRows.filter(i => i.status === 'MAINTENANCE' || i.status === 'UNDER_MAINTENANCE').length;
      const decommissionedItems = itemRows.filter(i => i.status === 'DECOMMISSIONED').length;

      const summaryData = {
        financialYearCode: fyLabel,
        departmentName: deptName,
        totalIncomingQuantity,
        totalIncomingValue: Math.round(totalIncomingValue * 100) / 100,
        totalOutgoingQuantity,
        totalOutgoingValue: Math.round(totalOutgoingValue * 100) / 100,
        remainingStockCount,
        remainingStockValue: Math.round(remainingStockValue * 100) / 100,
        itemsUnderMaintenance,
        decommissionedItems,
        generatedAt: new Date().toISOString().replace('T', ' ').substring(0, 19)
      };

      res.json({
        success: true,
        summary: summaryData,
        report: summaryData,
        batches: matchingBatches,
        transactions: matchingTxs
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // ---------------- DASHBOARD METRICS ROUTES ----------------
  app.get(['/api/dashboard/metrics', '/api/dashboard_metrics.php'], async (req: Request, res: Response) => {
    try {
      const fyParam = req.query.financialYearId;
      const userDeptId = (req.headers['x-user-department-id'] as string) || '';
      const userRole = (req.headers['x-user-role'] as string) || 'ADMIN';

      const fyId = await getResolvedFyId(fyParam);

      let batchSql = `
        SELECT b.available_quantity, b.unit_cost, cat.name as category_name
        FROM stock_batches b
        LEFT JOIN categories cat ON b.category_id = cat.id
        WHERE 1=1
      `;
      const batchParams: any[] = [];
      if (fyId) {
        batchSql += ' AND b.financial_year_id = ?';
        batchParams.push(fyId);
      }
      if (userRole !== 'ADMIN' && userDeptId) {
        batchSql += ' AND b.department_id = ?';
        batchParams.push(userDeptId);
      }
      const batchRows = await dbQuery<RowDataPacket[]>(batchSql, batchParams);

      const totalStockValue = batchRows.reduce((acc, b) => acc + (Number(b.available_quantity) || 0) * (Number(b.unit_cost) || 0), 0);
      const lowStockAlerts = batchRows.filter(b => Number(b.available_quantity) <= (b.category_name === 'Office Stationery' ? 20 : 5)).length;

      let itemSql = 'SELECT status FROM inventory_items WHERE 1=1';
      const itemParams: any[] = [];
      if (fyId) {
        itemSql += ' AND financial_year_id = ?';
        itemParams.push(fyId);
      }
      if (userRole !== 'ADMIN' && userDeptId) {
        itemSql += ' AND department_id = ?';
        itemParams.push(userDeptId);
      }
      const itemRows = await dbQuery<RowDataPacket[]>(itemSql, itemParams);

      const totalItemsIssued = itemRows.filter(i => i.status === 'ISSUED').length;
      const pendingMaintenance = itemRows.filter(i => i.status === 'MAINTENANCE' || i.status === 'UNDER_MAINTENANCE').length;
      const decommissionedCount = itemRows.filter(i => i.status === 'DECOMMISSIONED').length;

      const deptRows = await dbQuery<RowDataPacket[]>('SELECT COUNT(*) as cnt FROM departments');
      const txRows = await dbQuery<RowDataPacket[]>('SELECT id, transaction_code, type, total_value, created_at FROM stock_transactions ORDER BY id DESC LIMIT 5');

      res.json({
        success: true,
        metrics: {
          totalStockBatches: batchRows.length,
          totalStockValue,
          lowStockAlerts,
          totalItemsIssued,
          pendingMaintenance,
          decommissionedCount,
          activeDepartmentsCount: deptRows[0]?.cnt || 0,
          recentTransactions: txRows
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`StockVault Node.js Express server running on http://0.0.0.0:${PORT}`);
    console.log(`Connected to MySQL host: ${dbConfig.host}:${dbConfig.port}, DB: ${dbConfig.database}`);
  });
}

startServer();
