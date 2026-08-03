import express, { Request, Response } from 'express';
import path from 'path';
import mysql from 'mysql2/promise';
import { createServer as createViteServer } from 'vite';
import {
  User,
  Department,
  Category,
  FinancialYear,
  StockBatch,
  InventoryItem,
  StockTransaction,
  AuditLog,
  SystemSettings,
  ItemStatus
} from './src/types.js';
import {
  INITIAL_USERS,
  INITIAL_DEPARTMENTS,
  INITIAL_CATEGORIES,
  INITIAL_FINANCIAL_YEARS,
  INITIAL_BATCHES,
  INITIAL_ITEMS,
  INITIAL_TRANSACTIONS,
  INITIAL_AUDIT_LOGS,
  INITIAL_SETTINGS
} from './src/data/mockDatabase.js';

const MYSQL_HOST = process.env.DB_HOST || process.env.MYSQL_HOST || '127.0.0.1';
const MYSQL_PORT = parseInt(process.env.DB_PORT || process.env.MYSQL_PORT || '3306', 10);
const MYSQL_USER = process.env.DB_USER || process.env.MYSQL_USER || 'root';
const MYSQL_PASSWORD = process.env.DB_PASS || process.env.MYSQL_PASSWORD || '';
const MYSQL_DATABASE = process.env.DB_NAME || process.env.MYSQL_DATABASE || 'stockvault_db';

let mysqlPool: mysql.Pool | null = null;
let isMysqlConnected = false;
let dbConnectionError: string = 'Database Connection Failed';

async function initMysqlDatabase(): Promise<boolean> {
  try {
    try {
      const rootConn = await mysql.createConnection({
        host: MYSQL_HOST,
        port: MYSQL_PORT,
        user: MYSQL_USER,
        password: MYSQL_PASSWORD,
        connectTimeout: 3000
      });
      await rootConn.query(`CREATE DATABASE IF NOT EXISTS \`${MYSQL_DATABASE}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`);
      await rootConn.end();
    } catch (e) {
      // Ignore database auto-creation error if privileges are restricted or database already exists
    }

    mysqlPool = mysql.createPool({
      host: MYSQL_HOST,
      port: MYSQL_PORT,
      user: MYSQL_USER,
      password: MYSQL_PASSWORD,
      database: MYSQL_DATABASE,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      connectTimeout: 5000
    });

    const conn = await mysqlPool.getConnection();
    conn.release();

    isMysqlConnected = true;
    dbConnectionError = '';
    console.log(`[MySQL Database] Successfully connected to MySQL at ${MYSQL_HOST}:${MYSQL_PORT}/${MYSQL_DATABASE}`);

    await createMysqlTablesAndSeed();
    return true;
  } catch (err: any) {
    isMysqlConnected = false;
    dbConnectionError = err?.message || 'Unable to connect to MySQL database';
    console.error(`[MySQL Database Error]:`, err);
    return false;
  }
}

async function createMysqlTablesAndSeed() {
  if (!mysqlPool) return;

  await mysqlPool.query(`
    CREATE TABLE IF NOT EXISTS departments (
      id VARCHAR(50) PRIMARY KEY,
      code VARCHAR(20) NOT NULL UNIQUE,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      budget_code VARCHAR(50),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await mysqlPool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(50) PRIMARY KEY,
      username VARCHAR(50) NOT NULL UNIQUE,
      full_name VARCHAR(100) NOT NULL,
      email VARCHAR(150) NOT NULL UNIQUE,
      password VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL,
      department_id VARCHAR(50) NOT NULL,
      department_name VARCHAR(100),
      status VARCHAR(20) DEFAULT 'ACTIVE',
      created_by VARCHAR(50),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await mysqlPool.query(`
    CREATE TABLE IF NOT EXISTS categories (
      id VARCHAR(50) PRIMARY KEY,
      code VARCHAR(20) NOT NULL UNIQUE,
      name VARCHAR(100) NOT NULL,
      description TEXT,
      low_stock_threshold INT DEFAULT 5,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await mysqlPool.query(`
    CREATE TABLE IF NOT EXISTS financial_years (
      id VARCHAR(50) PRIMARY KEY,
      year_code VARCHAR(20) NOT NULL UNIQUE,
      start_date VARCHAR(20) NOT NULL,
      end_date VARCHAR(20) NOT NULL,
      is_active TINYINT(1) DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await mysqlPool.query(`
    CREATE TABLE IF NOT EXISTS stock_batches (
      id VARCHAR(50) PRIMARY KEY,
      batch_number VARCHAR(50) NOT NULL UNIQUE,
      category_id VARCHAR(50) NOT NULL,
      department_id VARCHAR(50) NOT NULL,
      financial_year_id VARCHAR(50) NOT NULL,
      supplier_name VARCHAR(100) NOT NULL,
      unit_cost DECIMAL(12, 2) NOT NULL,
      is_serialized TINYINT(1) DEFAULT 1,
      total_quantity INT NOT NULL,
      available_quantity INT NOT NULL,
      status VARCHAR(20) DEFAULT 'ACTIVE',
      received_by_user_id VARCHAR(50) NOT NULL,
      remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await mysqlPool.query(`
    CREATE TABLE IF NOT EXISTS inventory_items (
      id VARCHAR(50) PRIMARY KEY,
      batch_id VARCHAR(50) NOT NULL,
      item_code VARCHAR(50) NOT NULL UNIQUE,
      serial_number VARCHAR(100) NOT NULL UNIQUE,
      category_id VARCHAR(50) NOT NULL,
      department_id VARCHAR(50) NOT NULL,
      financial_year_id VARCHAR(50) NOT NULL,
      status VARCHAR(20) DEFAULT 'IN_STOCK',
      unit_cost DECIMAL(12, 2) NOT NULL,
      location VARCHAR(100),
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await mysqlPool.query(`
    CREATE TABLE IF NOT EXISTS stock_transactions (
      id VARCHAR(50) PRIMARY KEY,
      transaction_code VARCHAR(50) NOT NULL UNIQUE,
      type VARCHAR(20) NOT NULL,
      batch_id VARCHAR(50) NOT NULL,
      item_id VARCHAR(50),
      financial_year_id VARCHAR(50) NOT NULL,
      department_id VARCHAR(50) NOT NULL,
      quantity INT NOT NULL,
      unit_cost DECIMAL(12, 2) NOT NULL,
      total_value DECIMAL(14, 2) NOT NULL,
      issued_by_user_id VARCHAR(50) NOT NULL,
      received_by_name VARCHAR(100) NOT NULL,
      receiver_department_id VARCHAR(50) NOT NULL,
      remarks TEXT,
      signatures_json LONGTEXT,
      ip_address VARCHAR(45),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await mysqlPool.query(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id VARCHAR(50) PRIMARY KEY,
      user_id VARCHAR(50),
      user_name VARCHAR(100),
      user_role VARCHAR(50),
      action VARCHAR(100) NOT NULL,
      entity_type VARCHAR(50) NOT NULL,
      entity_id VARCHAR(50),
      old_values_json LONGTEXT,
      new_values_json LONGTEXT,
      ip_address VARCHAR(45),
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  await mysqlPool.query(`
    CREATE TABLE IF NOT EXISTS system_settings (
      key_name VARCHAR(50) PRIMARY KEY,
      value_text LONGTEXT NOT NULL,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  // Seed default records if MySQL database tables are brand new
  const [userRows]: any = await mysqlPool.query('SELECT COUNT(*) as count FROM users');
  if (userRows[0].count === 0) {
    for (const u of INITIAL_USERS) {
      await mysqlPool.query(`
        INSERT IGNORE INTO users (id, username, full_name, email, password, role, department_id, department_name, status, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', 'SYSTEM')
      `, [u.id, u.username, u.fullName, u.email, u.password, u.role, u.departmentId, u.departmentName || null]);
    }
    for (const d of INITIAL_DEPARTMENTS) {
      await mysqlPool.query(`
        INSERT IGNORE INTO departments (id, code, name, description, budget_code)
        VALUES (?, ?, ?, ?, ?)
      `, [d.id, d.code, d.name, d.description || null, d.budgetCode || null]);
    }
    for (const c of INITIAL_CATEGORIES) {
      await mysqlPool.query(`
        INSERT IGNORE INTO categories (id, code, name, description, low_stock_threshold)
        VALUES (?, ?, ?, ?, ?)
      `, [c.id, c.code, c.name, c.description || null, c.lowStockThreshold || 5]);
    }
    for (const fy of INITIAL_FINANCIAL_YEARS) {
      await mysqlPool.query(`
        INSERT IGNORE INTO financial_years (id, year_code, start_date, end_date, is_active)
        VALUES (?, ?, ?, ?, ?)
      `, [fy.id, fy.yearCode, fy.startDate, fy.endDate, fy.isActive ? 1 : 0]);
    }
    for (const b of INITIAL_BATCHES) {
      await mysqlPool.query(`
        INSERT IGNORE INTO stock_batches (id, batch_number, category_id, department_id, financial_year_id, supplier_name, unit_cost, is_serialized, total_quantity, available_quantity, status, received_by_user_id, remarks)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)
      `, [b.id, b.batchNumber, b.categoryId, b.departmentId, b.financialYearId, b.supplierName, b.unitCost, b.isSerialized ? 1 : 0, b.totalQuantity, b.availableQuantity, b.receivedByUserId, b.remarks || null]);
    }
    for (const item of INITIAL_ITEMS) {
      await mysqlPool.query(`
        INSERT IGNORE INTO inventory_items (id, batch_id, item_code, serial_number, category_id, department_id, financial_year_id, status, unit_cost, location, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [item.id, item.batchId, item.itemCode, item.serialNumber, item.categoryId, item.departmentId, item.financialYearId, item.status, item.unitCost, item.location || null, item.notes || null]);
    }
    for (const tx of INITIAL_TRANSACTIONS) {
      await mysqlPool.query(`
        INSERT IGNORE INTO stock_transactions (id, transaction_code, type, batch_id, item_id, financial_year_id, department_id, quantity, unit_cost, total_value, issued_by_user_id, received_by_name, receiver_department_id, remarks, ip_address)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [tx.id, tx.transactionCode, tx.type, tx.batchId, tx.itemId || null, tx.financialYearId, tx.departmentId, tx.quantity, tx.unitCost, tx.totalValue, tx.issuedByUserId, tx.receivedByName, tx.receiverDepartmentId, tx.remarks || null, tx.ipAddress || null]);
    }
    for (const log of INITIAL_AUDIT_LOGS) {
      await mysqlPool.query(`
        INSERT IGNORE INTO audit_logs (id, user_id, user_name, user_role, action, entity_type, entity_id, old_values_json, new_values_json, ip_address)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [log.id, log.userId || null, log.userName || null, log.userRole || null, log.action, log.entityType, log.entityId || null, log.oldValues ? JSON.stringify(log.oldValues) : null, log.newValues ? JSON.stringify(log.newValues) : null, log.ipAddress || null]);
    }
    await mysqlPool.query(`
      INSERT IGNORE INTO system_settings (key_name, value_text)
      VALUES ('global_settings', ?)
    `, [JSON.stringify(INITIAL_SETTINGS)]);
  }
}

// Check database connection and enforce strict error message if not connected
function checkDbConnection(res: Response): boolean {
  if (!isMysqlConnected || !mysqlPool) {
    res.status(500).json({
      success: false,
      error: `Database Connection Failed: Unable to connect to MySQL database (${dbConnectionError || 'No connection pool active'})`
    });
    return false;
  }
  return true;
}

// Row mappings from MySQL snake_case to JavaScript camelCase objects
function mapUserRow(r: any): User {
  return {
    id: String(r.id),
    username: r.username,
    password: r.password,
    fullName: r.full_name,
    email: r.email,
    role: r.role,
    departmentId: String(r.department_id),
    departmentName: r.department_name || '',
    status: r.status,
    createdBy: r.created_by,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
  };
}

function mapDepartmentRow(r: any): Department {
  return {
    id: String(r.id),
    code: r.code,
    name: r.name,
    description: r.description || '',
    budgetCode: r.budget_code || '',
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
  };
}

function mapCategoryRow(r: any): Category {
  return {
    id: String(r.id),
    code: r.code,
    name: r.name,
    description: r.description || '',
    lowStockThreshold: Number(r.low_stock_threshold || 5),
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
  };
}

function mapFinancialYearRow(r: any): FinancialYear {
  return {
    id: String(r.id),
    yearCode: r.year_code,
    startDate: r.start_date,
    endDate: r.end_date,
    isActive: Boolean(r.is_active),
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
  };
}

function mapStockBatchRow(r: any): StockBatch {
  return {
    id: String(r.id),
    batchNumber: r.batch_number,
    categoryId: String(r.category_id),
    categoryName: r.category_name || '',
    departmentId: String(r.department_id),
    departmentName: r.department_name || '',
    financialYearId: String(r.financial_year_id),
    financialYearCode: r.financial_year_code || '',
    supplierName: r.supplier_name,
    unitCost: Number(r.unit_cost),
    isSerialized: Boolean(r.is_serialized),
    totalQuantity: Number(r.total_quantity),
    availableQuantity: Number(r.available_quantity),
    receivedByUserId: String(r.received_by_user_id),
    receivedByName: r.received_by_name || '',
    status: r.status,
    remarks: r.remarks || '',
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
  };
}

function mapInventoryItemRow(r: any): InventoryItem {
  return {
    id: String(r.id),
    batchId: String(r.batch_id),
    batchNumber: r.batch_number || '',
    itemCode: r.item_code,
    serialNumber: r.serial_number,
    categoryId: String(r.category_id),
    categoryName: r.category_name || '',
    departmentId: String(r.department_id),
    departmentName: r.department_name || '',
    financialYearId: String(r.financial_year_id),
    financialYearCode: r.financial_year_code || '',
    status: r.status,
    unitCost: Number(r.unit_cost),
    location: r.location || '',
    notes: r.notes || '',
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
    updatedAt: r.updated_at ? new Date(r.updated_at).toISOString() : new Date().toISOString(),
  };
}

function mapStockTransactionRow(r: any): StockTransaction {
  return {
    id: String(r.id),
    transactionCode: r.transaction_code,
    type: r.type,
    batchId: String(r.batch_id),
    itemId: r.item_id ? String(r.item_id) : undefined,
    serialNumber: r.serial_number || undefined,
    categoryName: r.category_name || undefined,
    financialYearId: String(r.financial_year_id),
    financialYearCode: r.financial_year_code || undefined,
    departmentId: String(r.department_id),
    departmentName: r.department_name || undefined,
    quantity: Number(r.quantity),
    unitCost: Number(r.unit_cost),
    totalValue: Number(r.total_value),
    issuedByUserId: String(r.issued_by_user_id),
    issuedByName: r.issued_by_name || '',
    receivedByName: r.received_by_name,
    receiverDepartmentId: String(r.receiver_department_id),
    receiverDepartmentName: r.receiver_department_name || undefined,
    remarks: r.remarks || undefined,
    signatures: r.signatures_json ? JSON.parse(r.signatures_json) : undefined,
    ipAddress: r.ip_address || undefined,
    timestamp: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
  };
}

function mapAuditLogRow(r: any): AuditLog {
  return {
    id: String(r.id),
    userId: r.user_id ? String(r.user_id) : '',
    userName: r.user_name || '',
    userRole: r.user_role || 'ADMIN',
    action: r.action,
    entityType: r.entity_type,
    entityId: r.entity_id ? String(r.entity_id) : undefined,
    oldValues: r.old_values_json || undefined,
    newValues: r.new_values_json || undefined,
    ipAddress: r.ip_address || undefined,
    userAgent: r.user_agent || undefined,
    createdAt: r.created_at ? new Date(r.created_at).toISOString() : new Date().toISOString(),
  };
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // Initialize MySQL database pool
  await initMysqlDatabase();

  const sanitizeUser = (u: User) => {
    const { password, ...safeUser } = u;
    return safeUser;
  };

  const getUserScope = (req: Request) => {
    const userId = (req.headers['x-user-id'] as string) || '';
    const userRole = (req.headers['x-user-role'] as string) || 'ADMIN';
    const userDeptId = (req.headers['x-user-department-id'] as string) || '';
    return { userId, role: userRole, deptId: userDeptId, isAdmin: userRole === 'ADMIN' };
  };

  const logAudit = async (req: Request, action: string, entityType: string, entityId: string, oldVal?: any, newVal?: any) => {
    if (!mysqlPool || !isMysqlConnected) return;
    try {
      const { userId, role: userRole } = getUserScope(req);
      const logId = `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      await mysqlPool.query(`
        INSERT INTO audit_logs (id, user_id, user_name, user_role, action, entity_type, entity_id, old_values_json, new_values_json, ip_address, user_agent)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        logId,
        userId || 'user-admin',
        'System User',
        userRole,
        action,
        entityType,
        entityId,
        oldVal ? JSON.stringify(oldVal) : null,
        newVal ? JSON.stringify(newVal) : null,
        req.ip || '127.0.0.1',
        req.headers['user-agent'] || 'Express Server'
      ]);
    } catch (err) {
      console.error("[MySQL Audit Log Error]:", err);
    }
  };

  // -------------------------------------------------------------------------
  // API ROUTES
  // -------------------------------------------------------------------------

  // Health check
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({
      status: isMysqlConnected ? 'ok' : 'error',
      mysqlConnected: isMysqlConnected,
      timestamp: new Date().toISOString()
    });
  });

  // MySQL Database status
  app.get('/api/db/status', async (req: Request, res: Response) => {
    if (!checkDbConnection(res)) return;
    try {
      const [uRows]: any = await mysqlPool!.query('SELECT COUNT(*) as count FROM users');
      const [dRows]: any = await mysqlPool!.query('SELECT COUNT(*) as count FROM departments');
      const [cRows]: any = await mysqlPool!.query('SELECT COUNT(*) as count FROM categories');
      const [fyRows]: any = await mysqlPool!.query('SELECT COUNT(*) as count FROM financial_years');
      const [bRows]: any = await mysqlPool!.query('SELECT COUNT(*) as count FROM stock_batches');
      const [iRows]: any = await mysqlPool!.query('SELECT COUNT(*) as count FROM inventory_items');
      const [txRows]: any = await mysqlPool!.query('SELECT COUNT(*) as count FROM stock_transactions');
      const [logRows]: any = await mysqlPool!.query('SELECT COUNT(*) as count FROM audit_logs');

      res.json({
        success: true,
        engine: 'MySQL Database Engine',
        persistent: true,
        database: MYSQL_DATABASE,
        host: MYSQL_HOST,
        counts: {
          users: uRows[0].count,
          departments: dRows[0].count,
          categories: cRows[0].count,
          financialYears: fyRows[0].count,
          stockBatches: bRows[0].count,
          inventoryItems: iRows[0].count,
          stockTransactions: txRows[0].count,
          auditLogs: logRows[0].count
        },
        lastChecked: new Date().toISOString()
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: `Database Connection Failed: ${err.message}` });
    }
  });

  app.get('/api/db/export', async (req: Request, res: Response) => {
    if (!checkDbConnection(res)) return;
    try {
      const [users]: any = await mysqlPool!.query('SELECT * FROM users');
      const [departments]: any = await mysqlPool!.query('SELECT * FROM departments');
      const [categories]: any = await mysqlPool!.query('SELECT * FROM categories');
      const [financialYears]: any = await mysqlPool!.query('SELECT * FROM financial_years');
      const [stockBatches]: any = await mysqlPool!.query('SELECT * FROM stock_batches');
      const [inventoryItems]: any = await mysqlPool!.query('SELECT * FROM inventory_items');
      const [stockTransactions]: any = await mysqlPool!.query('SELECT * FROM stock_transactions');
      const [auditLogs]: any = await mysqlPool!.query('SELECT * FROM audit_logs');
      const [settings]: any = await mysqlPool!.query('SELECT * FROM system_settings');

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', 'attachment; filename="stockvault_mysql_database.json"');
      res.send(JSON.stringify({
        users: users.map(mapUserRow).map(sanitizeUser),
        departments: departments.map(mapDepartmentRow),
        categories: categories.map(mapCategoryRow),
        financialYears: financialYears.map(mapFinancialYearRow),
        stockBatches: stockBatches.map(mapStockBatchRow),
        inventoryItems: inventoryItems.map(mapInventoryItemRow),
        stockTransactions: stockTransactions.map(mapStockTransactionRow),
        auditLogs: auditLogs.map(mapAuditLogRow),
        settings
      }, null, 2));
    } catch (err: any) {
      res.status(500).json({ success: false, error: `Database Connection Failed: ${err.message}` });
    }
  });

  // 1. Dashboard Metrics
  app.get('/api/dashboard/metrics', async (req: Request, res: Response) => {
    if (!checkDbConnection(res)) return;
    try {
      const { deptId, isAdmin } = getUserScope(req);
      const [fyRows]: any = await mysqlPool!.query('SELECT * FROM financial_years');
      const financialYears = fyRows.map(mapFinancialYearRow);

      const fyId = (req.query.financialYearId as string) || (financialYears.find(f => f.isActive)?.id || financialYears[0]?.id || '');

      let bQuery = 'SELECT b.*, c.name as category_name, d.name as department_name, fy.year_code as financial_year_code FROM stock_batches b LEFT JOIN categories c ON b.category_id = c.id LEFT JOIN departments d ON b.department_id = d.id LEFT JOIN financial_years fy ON b.financial_year_id = fy.id WHERE b.financial_year_id = ?';
      let bParams: any[] = [fyId];

      if (!isAdmin && deptId) {
        bQuery += ' AND b.department_id = ?';
        bParams.push(deptId);
      }

      const [bRows]: any = await mysqlPool!.query(bQuery, bParams);
      const fyBatches = bRows.map(mapStockBatchRow);

      let iQuery = 'SELECT * FROM inventory_items WHERE financial_year_id = ?';
      let iParams: any[] = [fyId];
      if (!isAdmin && deptId) {
        iQuery += ' AND department_id = ?';
        iParams.push(deptId);
      }
      const [iRows]: any = await mysqlPool!.query(iQuery, iParams);
      const fyItems = iRows.map(mapInventoryItemRow);

      let tQuery = 'SELECT * FROM stock_transactions WHERE financial_year_id = ?';
      let tParams: any[] = [fyId];
      if (!isAdmin && deptId) {
        tQuery += ' AND (department_id = ? OR receiver_department_id = ?)';
        tParams.push(deptId, deptId);
      }
      const [tRows]: any = await mysqlPool!.query(tQuery, tParams);
      const fyTransactions = tRows.map(mapStockTransactionRow);

      const totalInventoryValuation = fyBatches.reduce((sum, b) => sum + (b.availableQuantity * b.unitCost), 0);
      const totalItemsCount = fyBatches.reduce((sum, b) => sum + b.availableQuantity, 0);
      const totalSerializedCount = fyItems.filter(i => i.status === 'IN_STOCK').length;

      const [cRows]: any = await mysqlPool!.query('SELECT * FROM categories');
      const categories = cRows.map(mapCategoryRow);

      const lowStockAlertsCount = fyBatches.filter(b => {
        const cat = categories.find(c => c.id === b.categoryId);
        const threshold = cat ? cat.lowStockThreshold : 5;
        return b.availableQuantity <= threshold && b.availableQuantity > 0;
      }).length;

      const deptBreakdownMap = new Map<string, { count: number; value: number }>();
      fyBatches.forEach(b => {
        const deptName = b.departmentName || 'General';
        const existing = deptBreakdownMap.get(deptName) || { count: 0, value: 0 };
        deptBreakdownMap.set(deptName, {
          count: existing.count + b.availableQuantity,
          value: existing.value + (b.availableQuantity * b.unitCost)
        });
      });

      const departmentBreakdown = Array.from(deptBreakdownMap.entries()).map(([departmentName, data]) => ({
        departmentName,
        count: data.count,
        value: data.value
      }));

      const catBreakdownMap = new Map<string, { count: number; value: number }>();
      fyBatches.forEach(b => {
        const catName = b.categoryName || 'Unassigned';
        const existing = catBreakdownMap.get(catName) || { count: 0, value: 0 };
        catBreakdownMap.set(catName, {
          count: existing.count + b.availableQuantity,
          value: existing.value + (b.availableQuantity * b.unitCost)
        });
      });

      const categoryBreakdown = Array.from(catBreakdownMap.entries()).map(([categoryName, data]) => ({
        categoryName,
        count: data.count,
        value: data.value
      }));

      const monthlyStockInValue = fyTransactions.filter(t => t.type === 'STOCK_IN').reduce((s, t) => s + t.totalValue, 0);
      const monthlyStockOutValue = fyTransactions.filter(t => t.type === 'STOCK_OUT').reduce((s, t) => s + t.totalValue, 0);

      const activeFy = financialYears.find(f => f.id === fyId) || financialYears.find(f => f.isActive);

      res.json({
        success: true,
        metrics: {
          totalInventoryValuation,
          totalItemsCount,
          totalSerializedCount,
          lowStockAlertsCount,
          activeFinancialYear: activeFy ? activeFy.yearCode : '2025-2026',
          pendingDispatchesCount: fyTransactions.filter(t => t.type === 'STOCK_OUT' && !t.signatures).length,
          monthlyStockInValue,
          monthlyStockOutValue,
          departmentBreakdown,
          categoryBreakdown
        }
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: `Database Connection Failed: ${err.message}` });
    }
  });

  // 2. Authentication & User Management
  app.post('/api/auth/login', async (req: Request, res: Response) => {
    if (!checkDbConnection(res)) return;
    try {
      const { username, password } = req.body;
      if (!username || !password) {
        res.status(400).json({ success: false, error: 'Username/Email and Password are required' });
        return;
      }

      const cleanInput = username.trim().toLowerCase();
      const [rows]: any = await mysqlPool!.query(
        'SELECT * FROM users WHERE LOWER(username) = ? OR LOWER(email) = ? OR (LOWER(?) = "admin" AND role = "ADMIN")',
        [cleanInput, cleanInput, cleanInput]
      );

      if (rows.length === 0) {
        await logAudit(req, 'LOGIN_FAILED', 'AUTH', username, undefined, { reason: 'User not found' });
        res.status(401).json({ success: false, error: 'Invalid username or password' });
        return;
      }

      const user = mapUserRow(rows[0]);

      if (user.status !== 'ACTIVE') {
        res.status(403).json({ success: false, error: 'Your account is deactivated. Contact System Administrator.' });
        return;
      }

      if (password !== user.password) {
        await logAudit(req, 'LOGIN_FAILED', 'AUTH', user.id, undefined, { reason: 'Incorrect password' });
        res.status(401).json({ success: false, error: 'Invalid username or password' });
        return;
      }

      await logAudit(req, 'USER_LOGIN_SUCCESS', 'AUTH', user.id, undefined, { loginTime: new Date().toISOString() });
      res.json({
        success: true,
        user: sanitizeUser(user),
        message: 'Login successful'
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: `Database Connection Failed: ${err.message}` });
    }
  });

  app.post('/api/auth/change-password', async (req: Request, res: Response) => {
    if (!checkDbConnection(res)) return;
    try {
      const { userId } = getUserScope(req);
      const { currentPassword, newPassword } = req.body;

      if (!userId) {
        res.status(401).json({ success: false, error: 'Unauthorized: Session missing' });
        return;
      }

      if (!currentPassword || !newPassword) {
        res.status(400).json({ success: false, error: 'Current password and new password are required' });
        return;
      }

      if (newPassword.length < 6) {
        res.status(400).json({ success: false, error: 'New password must be at least 6 characters long' });
        return;
      }

      const [rows]: any = await mysqlPool!.query('SELECT * FROM users WHERE id = ?', [userId]);
      if (rows.length === 0) {
        res.status(404).json({ success: false, error: 'User not found' });
        return;
      }

      const user = mapUserRow(rows[0]);
      if (currentPassword !== user.password) {
        res.status(400).json({ success: false, error: 'Current password is incorrect' });
        return;
      }

      await mysqlPool!.query('UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?', [newPassword, userId]);

      await logAudit(req, 'PASSWORD_CHANGED', 'USER', userId, undefined, { updatedBy: user.email });
      res.json({ success: true, message: 'Password updated successfully' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: `Database Connection Failed: ${err.message}` });
    }
  });

  app.put('/api/users/:id/reset-password', async (req: Request, res: Response) => {
    if (!checkDbConnection(res)) return;
    try {
      const { role } = getUserScope(req);
      if (role !== 'ADMIN') {
        res.status(403).json({ success: false, error: 'Forbidden: Admin privilege required to reset passwords' });
        return;
      }

      const { newPassword } = req.body;
      if (!newPassword || newPassword.length < 6) {
        res.status(400).json({ success: false, error: 'New password must be at least 6 characters long' });
        return;
      }

      const [rows]: any = await mysqlPool!.query('SELECT * FROM users WHERE id = ?', [req.params.id]);
      if (rows.length === 0) {
        res.status(404).json({ success: false, error: 'User account not found' });
        return;
      }

      const user = mapUserRow(rows[0]);
      await mysqlPool!.query('UPDATE users SET password = ?, updated_at = NOW() WHERE id = ?', [newPassword, user.id]);

      await logAudit(req, 'PASSWORD_RESET_BY_ADMIN', 'USER', user.id, undefined, { resetBy: req.headers['x-user-id'] || 'user-admin' });
      res.json({ success: true, user: sanitizeUser(user), message: `Password for ${user.fullName} has been reset successfully` });
    } catch (err: any) {
      res.status(500).json({ success: false, error: `Database Connection Failed: ${err.message}` });
    }
  });

  app.get('/api/users', async (req: Request, res: Response) => {
    if (!checkDbConnection(res)) return;
    try {
      const [rows]: any = await mysqlPool!.query('SELECT * FROM users ORDER BY created_at DESC');
      const users = rows.map(mapUserRow).map(sanitizeUser);
      res.json({ success: true, users });
    } catch (err: any) {
      res.status(500).json({ success: false, error: `Database Connection Failed: ${err.message}` });
    }
  });

  app.post('/api/users', async (req: Request, res: Response) => {
    if (!checkDbConnection(res)) return;
    try {
      const { role: userRole } = getUserScope(req);
      if (userRole !== 'ADMIN') {
        res.status(403).json({ success: false, error: 'Forbidden: Admin privilege required' });
        return;
      }

      const { fullName, email, username, password, role, departmentId } = req.body;
      if (!fullName || !email || !role || !departmentId) {
        res.status(400).json({ success: false, error: 'Missing required user parameters' });
        return;
      }

      const [existingEmail]: any = await mysqlPool!.query('SELECT id FROM users WHERE LOWER(email) = LOWER(?)', [email]);
      if (existingEmail.length > 0) {
        res.status(409).json({ success: false, error: 'User with this email address already exists' });
        return;
      }

      const assignedUsername = username || email.split('@')[0];
      const [existingUsername]: any = await mysqlPool!.query('SELECT id FROM users WHERE LOWER(username) = LOWER(?)', [assignedUsername]);
      if (existingUsername.length > 0) {
        res.status(409).json({ success: false, error: `Username '${assignedUsername}' is already taken` });
        return;
      }

      const [deptRows]: any = await mysqlPool!.query('SELECT * FROM departments WHERE id = ?', [departmentId]);
      const deptName = deptRows.length > 0 ? deptRows[0].name : 'General';

      const newUser: User = {
        id: `user-${Date.now()}`,
        username: assignedUsername,
        password: password || 'StockVault@2025',
        fullName,
        email,
        role,
        departmentId,
        departmentName: deptName,
        status: 'ACTIVE',
        createdBy: (req.headers['x-user-id'] as string) || 'user-admin',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await mysqlPool!.query(`
        INSERT INTO users (id, username, full_name, email, password, role, department_id, department_name, status, created_by)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?)
      `, [newUser.id, newUser.username, newUser.fullName, newUser.email, newUser.password, newUser.role, newUser.departmentId, newUser.departmentName, newUser.createdBy]);

      await logAudit(req, 'USER_PROVISIONED', 'USER', newUser.id, undefined, sanitizeUser(newUser));
      res.status(201).json({ success: true, user: sanitizeUser(newUser), message: 'User account created successfully' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: `Database Connection Failed: ${err.message}` });
    }
  });

  app.put('/api/users/:id/status', async (req: Request, res: Response) => {
    if (!checkDbConnection(res)) return;
    try {
      const { role } = getUserScope(req);
      if (role !== 'ADMIN') {
        res.status(403).json({ success: false, error: 'Forbidden: Admin privilege required' });
        return;
      }

      const [rows]: any = await mysqlPool!.query('SELECT * FROM users WHERE id = ?', [req.params.id]);
      if (rows.length === 0) {
        res.status(404).json({ success: false, error: 'User account not found' });
        return;
      }

      const user = mapUserRow(rows[0]);
      const newStatus = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

      await mysqlPool!.query('UPDATE users SET status = ?, updated_at = NOW() WHERE id = ?', [newStatus, user.id]);
      user.status = newStatus;

      await logAudit(req, 'USER_STATUS_TOGGLED', 'USER', user.id, { status: rows[0].status }, { status: newStatus });
      res.json({ success: true, user: sanitizeUser(user), message: `User status changed to ${newStatus}` });
    } catch (err: any) {
      res.status(500).json({ success: false, error: `Database Connection Failed: ${err.message}` });
    }
  });

  // 3. Departments
  app.get('/api/departments', async (req: Request, res: Response) => {
    if (!checkDbConnection(res)) return;
    try {
      const { deptId, isAdmin } = getUserScope(req);
      let query = 'SELECT * FROM departments ORDER BY name ASC';
      let params: any[] = [];
      if (!isAdmin && deptId) {
        query = 'SELECT * FROM departments WHERE id = ?';
        params = [deptId];
      }
      const [rows]: any = await mysqlPool!.query(query, params);
      const departments = rows.map(mapDepartmentRow);
      res.json({ success: true, departments });
    } catch (err: any) {
      res.status(500).json({ success: false, error: `Database Connection Failed: ${err.message}` });
    }
  });

  app.post('/api/departments', async (req: Request, res: Response) => {
    if (!checkDbConnection(res)) return;
    try {
      const { code, name, description, budgetCode } = req.body;
      const newDept: Department = {
        id: `dept-${Date.now()}`,
        code: code.toUpperCase(),
        name,
        description: description || '',
        budgetCode: budgetCode || `BUG-${code.toUpperCase()}-2025`,
        createdAt: new Date().toISOString()
      };

      await mysqlPool!.query(`
        INSERT INTO departments (id, code, name, description, budget_code)
        VALUES (?, ?, ?, ?, ?)
      `, [newDept.id, newDept.code, newDept.name, newDept.description, newDept.budgetCode]);

      await logAudit(req, 'DEPARTMENT_CREATED', 'DEPARTMENT', newDept.id, undefined, newDept);
      res.status(201).json({ success: true, department: newDept });
    } catch (err: any) {
      res.status(500).json({ success: false, error: `Database Connection Failed: ${err.message}` });
    }
  });

  app.put('/api/departments/:id', async (req: Request, res: Response) => {
    if (!checkDbConnection(res)) return;
    try {
      const { role } = getUserScope(req);
      if (role !== 'ADMIN') {
        res.status(403).json({ success: false, error: 'Forbidden: Admin privilege required' });
        return;
      }

      const [rows]: any = await mysqlPool!.query('SELECT * FROM departments WHERE id = ?', [req.params.id]);
      if (rows.length === 0) {
        res.status(404).json({ success: false, error: 'Department not found' });
        return;
      }

      const dept = mapDepartmentRow(rows[0]);
      const { code, name, description, budgetCode } = req.body;

      const updatedCode = code ? code.toUpperCase() : dept.code;
      const updatedName = name || dept.name;
      const updatedDesc = description !== undefined ? description : dept.description;
      const updatedBudget = budgetCode !== undefined ? budgetCode : dept.budgetCode;

      await mysqlPool!.query(`
        UPDATE departments SET code = ?, name = ?, description = ?, budget_code = ? WHERE id = ?
      `, [updatedCode, updatedName, updatedDesc, updatedBudget, dept.id]);

      if (name && name !== dept.name) {
        await mysqlPool!.query('UPDATE users SET department_name = ? WHERE department_id = ?', [updatedName, dept.id]);
      }

      dept.code = updatedCode;
      dept.name = updatedName;
      dept.description = updatedDesc;
      dept.budgetCode = updatedBudget;

      await logAudit(req, 'DEPARTMENT_UPDATED', 'DEPARTMENT', dept.id, rows[0], dept);
      res.json({ success: true, department: dept, message: 'Department updated successfully' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: `Database Connection Failed: ${err.message}` });
    }
  });

  app.delete('/api/departments/:id', async (req: Request, res: Response) => {
    if (!checkDbConnection(res)) return;
    try {
      const { role } = getUserScope(req);
      if (role !== 'ADMIN') {
        res.status(403).json({ success: false, error: 'Forbidden: Admin privilege required' });
        return;
      }

      const [rows]: any = await mysqlPool!.query('SELECT * FROM departments WHERE id = ?', [req.params.id]);
      if (rows.length === 0) {
        res.status(404).json({ success: false, error: 'Department not found' });
        return;
      }

      const dept = mapDepartmentRow(rows[0]);

      const [uCheck]: any = await mysqlPool!.query('SELECT COUNT(*) as count FROM users WHERE department_id = ?', [dept.id]);
      const [bCheck]: any = await mysqlPool!.query('SELECT COUNT(*) as count FROM stock_batches WHERE department_id = ?', [dept.id]);
      const [iCheck]: any = await mysqlPool!.query('SELECT COUNT(*) as count FROM inventory_items WHERE department_id = ?', [dept.id]);

      if (uCheck[0].count > 0 || bCheck[0].count > 0 || iCheck[0].count > 0) {
        res.status(400).json({
          success: false,
          error: `Cannot delete department '${dept.name}' because it is assigned to existing users, stock batches, or items.`
        });
        return;
      }

      await mysqlPool!.query('DELETE FROM departments WHERE id = ?', [dept.id]);
      await logAudit(req, 'DEPARTMENT_DELETED', 'DEPARTMENT', dept.id, dept, undefined);
      res.json({ success: true, message: 'Department deleted successfully' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: `Database Connection Failed: ${err.message}` });
    }
  });

  // 4. Categories
  app.get('/api/categories', async (req: Request, res: Response) => {
    if (!checkDbConnection(res)) return;
    try {
      const [rows]: any = await mysqlPool!.query('SELECT * FROM categories ORDER BY name ASC');
      const categories = rows.map(mapCategoryRow);
      res.json({ success: true, categories });
    } catch (err: any) {
      res.status(500).json({ success: false, error: `Database Connection Failed: ${err.message}` });
    }
  });

  app.post('/api/categories', async (req: Request, res: Response) => {
    if (!checkDbConnection(res)) return;
    try {
      const { code, name, description, lowStockThreshold } = req.body;
      const newCat: Category = {
        id: `cat-${Date.now()}`,
        code: code.toUpperCase(),
        name,
        description: description || '',
        lowStockThreshold: Number(lowStockThreshold) || 5,
        createdAt: new Date().toISOString()
      };

      await mysqlPool!.query(`
        INSERT INTO categories (id, code, name, description, low_stock_threshold)
        VALUES (?, ?, ?, ?, ?)
      `, [newCat.id, newCat.code, newCat.name, newCat.description, newCat.lowStockThreshold]);

      await logAudit(req, 'CATEGORY_CREATED', 'CATEGORY', newCat.id, undefined, newCat);
      res.status(201).json({ success: true, category: newCat });
    } catch (err: any) {
      res.status(500).json({ success: false, error: `Database Connection Failed: ${err.message}` });
    }
  });

  app.put('/api/categories/:id', async (req: Request, res: Response) => {
    if (!checkDbConnection(res)) return;
    try {
      const { role } = getUserScope(req);
      if (role !== 'ADMIN') {
        res.status(403).json({ success: false, error: 'Forbidden: Admin privilege required' });
        return;
      }

      const [rows]: any = await mysqlPool!.query('SELECT * FROM categories WHERE id = ?', [req.params.id]);
      if (rows.length === 0) {
        res.status(404).json({ success: false, error: 'Category not found' });
        return;
      }

      const cat = mapCategoryRow(rows[0]);
      const { code, name, description, lowStockThreshold } = req.body;

      const updatedCode = code ? code.toUpperCase() : cat.code;
      const updatedName = name || cat.name;
      const updatedDesc = description !== undefined ? description : cat.description;
      const updatedThreshold = lowStockThreshold !== undefined ? Number(lowStockThreshold) : cat.lowStockThreshold;

      await mysqlPool!.query(`
        UPDATE categories SET code = ?, name = ?, description = ?, low_stock_threshold = ? WHERE id = ?
      `, [updatedCode, updatedName, updatedDesc, updatedThreshold, cat.id]);

      cat.code = updatedCode;
      cat.name = updatedName;
      cat.description = updatedDesc;
      cat.lowStockThreshold = updatedThreshold;

      await logAudit(req, 'CATEGORY_UPDATED', 'CATEGORY', cat.id, rows[0], cat);
      res.json({ success: true, category: cat, message: 'Category updated successfully' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: `Database Connection Failed: ${err.message}` });
    }
  });

  app.delete('/api/categories/:id', async (req: Request, res: Response) => {
    if (!checkDbConnection(res)) return;
    try {
      const { role } = getUserScope(req);
      if (role !== 'ADMIN') {
        res.status(403).json({ success: false, error: 'Forbidden: Admin privilege required' });
        return;
      }

      const [rows]: any = await mysqlPool!.query('SELECT * FROM categories WHERE id = ?', [req.params.id]);
      if (rows.length === 0) {
        res.status(404).json({ success: false, error: 'Category not found' });
        return;
      }

      const cat = mapCategoryRow(rows[0]);

      const [bCheck]: any = await mysqlPool!.query('SELECT COUNT(*) as count FROM stock_batches WHERE category_id = ?', [cat.id]);
      const [iCheck]: any = await mysqlPool!.query('SELECT COUNT(*) as count FROM inventory_items WHERE category_id = ?', [cat.id]);

      if (bCheck[0].count > 0 || iCheck[0].count > 0) {
        res.status(400).json({
          success: false,
          error: `Cannot delete category '${cat.name}' because it is assigned to existing stock batches or inventory items.`
        });
        return;
      }

      await mysqlPool!.query('DELETE FROM categories WHERE id = ?', [cat.id]);
      await logAudit(req, 'CATEGORY_DELETED', 'CATEGORY', cat.id, cat, undefined);
      res.json({ success: true, message: 'Category deleted successfully' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: `Database Connection Failed: ${err.message}` });
    }
  });

  // 5. Financial Years
  app.get('/api/financial-years', async (req: Request, res: Response) => {
    if (!checkDbConnection(res)) return;
    try {
      const [rows]: any = await mysqlPool!.query('SELECT * FROM financial_years ORDER BY created_at DESC');
      const financialYears = rows.map(mapFinancialYearRow);
      res.json({ success: true, financialYears });
    } catch (err: any) {
      res.status(500).json({ success: false, error: `Database Connection Failed: ${err.message}` });
    }
  });

  app.post('/api/financial-years', async (req: Request, res: Response) => {
    if (!checkDbConnection(res)) return;
    try {
      const { role } = getUserScope(req);
      if (role !== 'ADMIN') {
        res.status(403).json({ success: false, error: 'Forbidden: Admin privilege required' });
        return;
      }

      const { yearCode, startDate, endDate, setAsActive } = req.body;
      if (!yearCode || !startDate || !endDate) {
        res.status(400).json({ success: false, error: 'Missing required parameters: yearCode, startDate, endDate' });
        return;
      }

      const [dupRows]: any = await mysqlPool!.query('SELECT id FROM financial_years WHERE LOWER(year_code) = LOWER(?)', [yearCode.trim()]);
      if (dupRows.length > 0) {
        res.status(409).json({ success: false, error: `Financial year code '${yearCode}' already exists.` });
        return;
      }

      const newFy: FinancialYear = {
        id: `fy-${Date.now()}`,
        yearCode: yearCode.trim(),
        startDate,
        endDate,
        isActive: Boolean(setAsActive),
        createdAt: new Date().toISOString()
      };

      if (newFy.isActive) {
        await mysqlPool!.query('UPDATE financial_years SET is_active = 0');
      }

      await mysqlPool!.query(`
        INSERT INTO financial_years (id, year_code, start_date, end_date, is_active)
        VALUES (?, ?, ?, ?, ?)
      `, [newFy.id, newFy.yearCode, newFy.startDate, newFy.endDate, newFy.isActive ? 1 : 0]);

      await logAudit(req, 'FINANCIAL_YEAR_CREATED', 'FINANCIAL_YEAR', newFy.id, undefined, newFy);
      res.status(201).json({ success: true, financialYear: newFy });
    } catch (err: any) {
      res.status(500).json({ success: false, error: `Database Connection Failed: ${err.message}` });
    }
  });

  app.put('/api/financial-years/:id', async (req: Request, res: Response) => {
    if (!checkDbConnection(res)) return;
    try {
      const { role } = getUserScope(req);
      if (role !== 'ADMIN') {
        res.status(403).json({ success: false, error: 'Forbidden: Admin privilege required' });
        return;
      }

      const [rows]: any = await mysqlPool!.query('SELECT * FROM financial_years WHERE id = ?', [req.params.id]);
      if (rows.length === 0) {
        res.status(404).json({ success: false, error: 'Financial year not found' });
        return;
      }

      const targetFy = mapFinancialYearRow(rows[0]);
      const { yearCode, startDate, endDate, isActive } = req.body;

      const updatedCode = yearCode ? yearCode.trim() : targetFy.yearCode;
      const updatedStart = startDate || targetFy.startDate;
      const updatedEnd = endDate || targetFy.endDate;

      if (isActive !== undefined) {
        const makeActive = Boolean(isActive);
        if (makeActive) {
          await mysqlPool!.query('UPDATE financial_years SET is_active = CASE WHEN id = ? THEN 1 ELSE 0 END', [targetFy.id]);
          targetFy.isActive = true;
        } else {
          await mysqlPool!.query('UPDATE financial_years SET is_active = 0 WHERE id = ?', [targetFy.id]);
          targetFy.isActive = false;
        }
      }

      await mysqlPool!.query(`
        UPDATE financial_years SET year_code = ?, start_date = ?, end_date = ? WHERE id = ?
      `, [updatedCode, updatedStart, updatedEnd, targetFy.id]);

      targetFy.yearCode = updatedCode;
      targetFy.startDate = updatedStart;
      targetFy.endDate = updatedEnd;

      await logAudit(req, 'FINANCIAL_YEAR_UPDATED', 'FINANCIAL_YEAR', targetFy.id, rows[0], targetFy);
      res.json({ success: true, financialYear: targetFy });
    } catch (err: any) {
      res.status(500).json({ success: false, error: `Database Connection Failed: ${err.message}` });
    }
  });

  app.delete('/api/financial-years/:id', async (req: Request, res: Response) => {
    if (!checkDbConnection(res)) return;
    try {
      const { role } = getUserScope(req);
      if (role !== 'ADMIN') {
        res.status(403).json({ success: false, error: 'Forbidden: Admin privilege required' });
        return;
      }

      const [rows]: any = await mysqlPool!.query('SELECT * FROM financial_years WHERE id = ?', [req.params.id]);
      if (rows.length === 0) {
        res.status(404).json({ success: false, error: 'Financial year not found' });
        return;
      }

      const targetFy = mapFinancialYearRow(rows[0]);
      if (targetFy.isActive) {
        res.status(400).json({ success: false, error: 'Cannot delete the currently active financial year. Activate another financial year first.' });
        return;
      }

      await mysqlPool!.query('DELETE FROM financial_years WHERE id = ?', [targetFy.id]);
      await logAudit(req, 'FINANCIAL_YEAR_DELETED', 'FINANCIAL_YEAR', targetFy.id, targetFy, undefined);
      res.json({ success: true, message: 'Financial year deleted successfully' });
    } catch (err: any) {
      res.status(500).json({ success: false, error: `Database Connection Failed: ${err.message}` });
    }
  });

  app.put('/api/financial-years/:id/activate', async (req: Request, res: Response) => {
    if (!checkDbConnection(res)) return;
    try {
      const [rows]: any = await mysqlPool!.query('SELECT * FROM financial_years WHERE id = ?', [req.params.id]);
      if (rows.length === 0) {
        res.status(404).json({ success: false, error: 'Financial year not found' });
        return;
      }

      const targetFy = mapFinancialYearRow(rows[0]);
      await mysqlPool!.query('UPDATE financial_years SET is_active = CASE WHEN id = ? THEN 1 ELSE 0 END', [targetFy.id]);
      targetFy.isActive = true;

      await logAudit(req, 'FINANCIAL_YEAR_ACTIVATED', 'FINANCIAL_YEAR', targetFy.id, undefined, { active: targetFy.yearCode });
      res.json({ success: true, activeFinancialYear: targetFy });
    } catch (err: any) {
      res.status(500).json({ success: false, error: `Database Connection Failed: ${err.message}` });
    }
  });

  // 6. Serial Check API
  app.get('/api/stock/check-serial', async (req: Request, res: Response) => {
    if (!checkDbConnection(res)) return;
    try {
      const serial = (req.query.serial as string || '').trim();
      if (!serial) {
        res.json({ exists: false });
        return;
      }

      const [rows]: any = await mysqlPool!.query(`
        SELECT i.*, d.name as department_name FROM inventory_items i
        LEFT JOIN departments d ON i.department_id = d.id
        WHERE LOWER(i.serial_number) = LOWER(?) AND i.status != 'DECOMMISSIONED'
      `, [serial]);

      if (rows.length > 0) {
        const item = mapInventoryItemRow(rows[0]);
        res.json({
          exists: true,
          item: {
            serialNumber: item.serialNumber,
            itemCode: item.itemCode,
            status: item.status,
            departmentName: item.departmentName
          },
          warning: `Serial Number '${serial}' is already registered under Item ${item.itemCode} (${item.status})`
        });
      } else {
        res.json({ exists: false });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, error: `Database Connection Failed: ${err.message}` });
    }
  });

  // 7. Stock Batches
  app.get('/api/stock/batches', async (req: Request, res: Response) => {
    if (!checkDbConnection(res)) return;
    try {
      const { deptId: userDeptId, isAdmin } = getUserScope(req);
      const fyId = req.query.financialYearId as string;

      let query = `
        SELECT b.*, c.name as category_name, d.name as department_name, fy.year_code as financial_year_code, u.full_name as received_by_name
        FROM stock_batches b
        LEFT JOIN categories c ON b.category_id = c.id
        LEFT JOIN departments d ON b.department_id = d.id
        LEFT JOIN financial_years fy ON b.financial_year_id = fy.id
        LEFT JOIN users u ON b.received_by_user_id = u.id
      `;
      const conditions: string[] = [];
      const params: any[] = [];

      if (fyId) {
        conditions.push('b.financial_year_id = ?');
        params.push(fyId);
      }

      if (!isAdmin && userDeptId) {
        conditions.push('b.department_id = ?');
        params.push(userDeptId);
      } else if (req.query.departmentId) {
        conditions.push('b.department_id = ?');
        params.push(req.query.departmentId);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ' ORDER BY b.created_at DESC';

      const [rows]: any = await mysqlPool!.query(query, params);
      const batches = rows.map(mapStockBatchRow);
      res.json({ success: true, batches });
    } catch (err: any) {
      res.status(500).json({ success: false, error: `Database Connection Failed: ${err.message}` });
    }
  });

  app.post('/api/stock/batches', async (req: Request, res: Response) => {
    if (!checkDbConnection(res)) return;
    try {
      const { deptId: userDeptId, isAdmin } = getUserScope(req);
      let {
        categoryId,
        departmentId,
        financialYearId,
        supplierName,
        unitCost,
        isSerialized,
        quantity,
        serials,
        remarks,
        receivedByUserId
      } = req.body;

      if (!isAdmin && userDeptId) {
        departmentId = userDeptId;
      }

      const [cRows]: any = await mysqlPool!.query('SELECT * FROM categories WHERE id = ?', [categoryId]);
      const [dRows]: any = await mysqlPool!.query('SELECT * FROM departments WHERE id = ?', [departmentId]);
      const [fyRows]: any = await mysqlPool!.query('SELECT * FROM financial_years WHERE id = ? OR is_active = 1 LIMIT 1', [financialYearId]);
      const [uRows]: any = await mysqlPool!.query('SELECT * FROM users WHERE id = ? LIMIT 1', [receivedByUserId]);

      const cat = cRows.length > 0 ? mapCategoryRow(cRows[0]) : null;
      const dept = dRows.length > 0 ? mapDepartmentRow(dRows[0]) : null;
      const fy = fyRows.length > 0 ? mapFinancialYearRow(fyRows[0]) : null;
      const receiver = uRows.length > 0 ? mapUserRow(uRows[0]) : { id: 'user-admin', fullName: 'System Admin' };

      const isSer = Boolean(isSerialized);
      const actualQty = isSer ? (serials ? serials.length : 0) : Number(quantity);

      if (isSer && Array.isArray(serials)) {
        const duplicateSerialsInReq: string[] = [];
        const existingDuplicatesInDb: string[] = [];
        const serialSet = new Set<string>();

        for (const sn of serials) {
          const cleanSn = String(sn).trim();
          if (serialSet.has(cleanSn.toLowerCase())) {
            duplicateSerialsInReq.push(cleanSn);
          } else {
            serialSet.add(cleanSn.toLowerCase());
          }

          const [checkDb]: any = await mysqlPool!.query(
            'SELECT id FROM inventory_items WHERE LOWER(serial_number) = LOWER(?) AND status != "DECOMMISSIONED"',
            [cleanSn]
          );
          if (checkDb.length > 0) {
            existingDuplicatesInDb.push(cleanSn);
          }
        }

        if (duplicateSerialsInReq.length > 0) {
          res.status(400).json({ success: false, error: `Duplicate serial numbers in request: ${duplicateSerialsInReq.join(', ')}` });
          return;
        }

        if (existingDuplicatesInDb.length > 0) {
          res.status(409).json({ success: false, error: `Serial numbers already registered in database: ${existingDuplicatesInDb.join(', ')}` });
          return;
        }
      }

      const batchId = `batch-${Date.now()}`;
      const batchNumber = `BAT-${fy ? fy.yearCode.substring(0, 4) : '2025'}-${cat ? cat.code : 'GEN'}-${Math.floor(100 + Math.random() * 900)}`;

      const newBatch: StockBatch = {
        id: batchId,
        batchNumber,
        categoryId,
        categoryName: cat?.name || 'Category',
        departmentId,
        departmentName: dept?.name || 'Department',
        financialYearId: fy ? fy.id : 'fy-2025',
        financialYearCode: fy ? fy.yearCode : '2025-2026',
        supplierName,
        unitCost: Number(unitCost),
        isSerialized: isSer,
        totalQuantity: actualQty,
        availableQuantity: actualQty,
        receivedByUserId: receiver.id,
        receivedByName: receiver.fullName,
        status: 'ACTIVE',
        remarks: remarks || '',
        createdAt: new Date().toISOString()
      };

      await mysqlPool!.query(`
        INSERT INTO stock_batches (id, batch_number, category_id, department_id, financial_year_id, supplier_name, unit_cost, is_serialized, total_quantity, available_quantity, status, received_by_user_id, remarks)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'ACTIVE', ?, ?)
      `, [newBatch.id, newBatch.batchNumber, newBatch.categoryId, newBatch.departmentId, newBatch.financialYearId, newBatch.supplierName, newBatch.unitCost, newBatch.isSerialized ? 1 : 0, newBatch.totalQuantity, newBatch.availableQuantity, newBatch.receivedByUserId, newBatch.remarks]);

      let itemsCreatedCount = 0;
      if (isSer && Array.isArray(serials)) {
        for (let idx = 0; idx < serials.length; idx++) {
          const sn = String(serials[idx]).trim();
          const itemCode = `ITM-${fy ? fy.yearCode.substring(0, 4) : '2025'}-${batchId.slice(-4)}-${strPad(idx + 1, 3)}`;
          const itemId = `item-${Date.now()}-${idx}`;

          await mysqlPool!.query(`
            INSERT INTO inventory_items (id, batch_id, item_code, serial_number, category_id, department_id, financial_year_id, status, unit_cost, location, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'IN_STOCK', ?, 'Central Storage - Bay A', 'Received via Batch Stock In')
          `, [itemId, batchId, itemCode, sn, categoryId, departmentId, fy ? fy.id : 'fy-2025', Number(unitCost)]);
          itemsCreatedCount++;
        }
      }

      const txCode = `TX-IN-${Date.now().toString().slice(-8)}`;
      const txId = `tx-${Date.now()}`;
      await mysqlPool!.query(`
        INSERT INTO stock_transactions (id, transaction_code, type, batch_id, financial_year_id, department_id, quantity, unit_cost, total_value, issued_by_user_id, received_by_name, receiver_department_id, remarks, ip_address)
        VALUES (?, ?, 'STOCK_IN', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [txId, txCode, batchId, fy ? fy.id : 'fy-2025', departmentId, actualQty, Number(unitCost), actualQty * Number(unitCost), receiver.id, 'Store Vault Central', departmentId, remarks || 'Supplier Delivery', req.ip || '127.0.0.1']);

      await logAudit(req, 'STOCK_IN_BATCH_CREATED', 'STOCK_BATCH', batchId, undefined, { batchNumber, totalQty: actualQty, isSerialized: isSer });

      res.status(201).json({
        success: true,
        batch: newBatch,
        itemsCount: itemsCreatedCount,
        message: `Stock batch ${batchNumber} registered in MySQL with ${actualQty} unit(s)`
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: `Database Connection Failed: ${err.message}` });
    }
  });

  // 8. Inventory Items & Status
  app.get('/api/stock/items', async (req: Request, res: Response) => {
    if (!checkDbConnection(res)) return;
    try {
      const { deptId: userDeptId, isAdmin } = getUserScope(req);
      const fyId = req.query.financialYearId as string;
      let deptId = req.query.departmentId as string;
      if (!isAdmin && userDeptId) {
        deptId = userDeptId;
      }
      const status = req.query.status as string;

      let query = `
        SELECT i.*, b.batch_number, c.name as category_name, d.name as department_name, fy.year_code as financial_year_code
        FROM inventory_items i
        LEFT JOIN stock_batches b ON i.batch_id = b.id
        LEFT JOIN categories c ON i.category_id = c.id
        LEFT JOIN departments d ON i.department_id = d.id
        LEFT JOIN financial_years fy ON i.financial_year_id = fy.id
      `;
      const conditions: string[] = [];
      const params: any[] = [];

      if (fyId) {
        conditions.push('i.financial_year_id = ?');
        params.push(fyId);
      }
      if (deptId) {
        conditions.push('i.department_id = ?');
        params.push(deptId);
      }
      if (status) {
        conditions.push('i.status = ?');
        params.push(status);
      }

      if (conditions.length > 0) {
        query += ' WHERE ' + conditions.join(' AND ');
      }

      query += ' ORDER BY i.created_at DESC';

      const [rows]: any = await mysqlPool!.query(query, params);
      const items = rows.map(mapInventoryItemRow);
      res.json({ success: true, items });
    } catch (err: any) {
      res.status(500).json({ success: false, error: `Database Connection Failed: ${err.message}` });
    }
  });

  app.put('/api/stock/items/:id/status', async (req: Request, res: Response) => {
    if (!checkDbConnection(res)) return;
    try {
      const { status, location, notes } = req.body as { status: ItemStatus; location?: string; notes?: string };
      const [rows]: any = await mysqlPool!.query('SELECT * FROM inventory_items WHERE id = ?', [req.params.id]);

      if (rows.length === 0) {
        res.status(404).json({ success: false, error: 'Inventory item not found' });
        return;
      }

      const item = mapInventoryItemRow(rows[0]);
      const oldStatus = item.status;

      const newLoc = location || item.location;
      const newNotes = notes || item.notes;

      await mysqlPool!.query(`
        UPDATE inventory_items SET status = ?, location = ?, notes = ?, updated_at = NOW() WHERE id = ?
      `, [status, newLoc, newNotes, item.id]);

      item.status = status;
      item.location = newLoc;
      item.notes = newNotes;

      const txCode = `TX-STATUS-${Date.now().toString().slice(-8)}`;
      const txId = `tx-${Date.now()}`;
      await mysqlPool!.query(`
        INSERT INTO stock_transactions (id, transaction_code, type, batch_id, item_id, financial_year_id, department_id, quantity, unit_cost, total_value, issued_by_user_id, received_by_name, receiver_department_id, remarks, ip_address)
        VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, 'Lifecycle Management', ?, ?, ?)
      `, [
        txId,
        txCode,
        status === 'DECOMMISSIONED' ? 'DECOMMISSION' : 'STATUS_CHANGE',
        item.batchId,
        item.id,
        item.financialYearId,
        item.departmentId,
        item.unitCost,
        item.unitCost,
        (req.headers['x-user-id'] as string) || 'user-keeper',
        item.departmentId,
        `Status transitioned from ${oldStatus} to ${status}. Notes: ${notes || 'None'}`,
        req.ip || '127.0.0.1'
      ]);

      await logAudit(req, 'ITEM_STATUS_CHANGED', 'INVENTORY_ITEM', item.id, { status: oldStatus }, { status, location, notes });
      res.json({ success: true, item, message: `Item status updated to ${status}` });
    } catch (err: any) {
      res.status(500).json({ success: false, error: `Database Connection Failed: ${err.message}` });
    }
  });

  // 9. Stock Dispatch (Stock Out)
  app.post('/api/stock/dispatch', async (req: Request, res: Response) => {
    if (!checkDbConnection(res)) return;
    try {
      const {
        batchId,
        itemId,
        quantity,
        receiverName,
        receiverDepartmentId,
        remarks,
        issuerUserId,
        signatures
      } = req.body;

      const [bRows]: any = await mysqlPool!.query('SELECT * FROM stock_batches WHERE id = ?', [batchId]);
      if (bRows.length === 0) {
        res.status(404).json({ success: false, error: 'Stock batch not found' });
        return;
      }

      const batch = mapStockBatchRow(bRows[0]);
      const qtyToIssue = batch.isSerialized ? 1 : Number(quantity || 1);

      if (batch.availableQuantity < qtyToIssue) {
        res.status(400).json({ success: false, error: `Insufficient stock in batch. Available: ${batch.availableQuantity}` });
        return;
      }

      let selectedItem: InventoryItem | undefined;
      if (batch.isSerialized) {
        let iRows: any = [];
        if (itemId) {
          const [rows]: any = await mysqlPool!.query('SELECT * FROM inventory_items WHERE id = ? AND status = "IN_STOCK"', [itemId]);
          iRows = rows;
        } else {
          const [rows]: any = await mysqlPool!.query('SELECT * FROM inventory_items WHERE batch_id = ? AND status = "IN_STOCK" LIMIT 1', [batchId]);
          iRows = rows;
        }

        if (!iRows || iRows.length === 0) {
          res.status(400).json({ success: false, error: 'No available in-stock item found for this serialized batch' });
          return;
        }

        selectedItem = mapInventoryItemRow(iRows[0]);
        await mysqlPool!.query('UPDATE inventory_items SET status = "ISSUED", department_id = ?, updated_at = NOW() WHERE id = ?', [receiverDepartmentId, selectedItem.id]);
      }

      const newAvailQty = batch.availableQuantity - qtyToIssue;
      const newStatus = newAvailQty <= 0 ? 'DEPLETED' : batch.status;

      await mysqlPool!.query('UPDATE stock_batches SET available_quantity = ?, status = ? WHERE id = ?', [newAvailQty, newStatus, batch.id]);

      const [uRows]: any = await mysqlPool!.query('SELECT * FROM users WHERE id = ? LIMIT 1', [issuerUserId]);
      const [dRows]: any = await mysqlPool!.query('SELECT * FROM departments WHERE id = ? LIMIT 1', [receiverDepartmentId]);
      const issuer = uRows.length > 0 ? mapUserRow(uRows[0]) : { id: 'user-keeper', fullName: 'Store Keeper', role: 'STORE_KEEPER' };
      const receiverDept = dRows.length > 0 ? mapDepartmentRow(dRows[0]) : { name: 'Recipient Dept' };

      const txCode = `TX-OUT-${Date.now().toString().slice(-8)}`;
      const txId = `tx-${Date.now()}`;

      const sigObj = signatures ? {
        issuerSignatureBase64: signatures.issuerSignatureBase64,
        issuerName: signatures.issuerName || issuer.fullName,
        issuerRole: issuer.role,
        receiverSignatureBase64: signatures.receiverSignatureBase64,
        receiverName,
        receiverRole: 'STAFF_RECEIVER',
        receiverDepartmentId,
        ipAddress: req.ip || '127.0.0.1',
        deviceTimestamp: new Date().toISOString()
      } : null;

      await mysqlPool!.query(`
        INSERT INTO stock_transactions (id, transaction_code, type, batch_id, item_id, financial_year_id, department_id, quantity, unit_cost, total_value, issued_by_user_id, received_by_name, receiver_department_id, remarks, signatures_json, ip_address)
        VALUES (?, ?, 'STOCK_OUT', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        txId,
        txCode,
        batch.id,
        selectedItem ? selectedItem.id : null,
        batch.financialYearId,
        batch.departmentId,
        qtyToIssue,
        batch.unitCost,
        qtyToIssue * batch.unitCost,
        issuer.id,
        receiverName,
        receiverDepartmentId,
        remarks || 'Stock out dispatch',
        sigObj ? JSON.stringify(sigObj) : null,
        req.ip || '127.0.0.1'
      ]);

      await logAudit(req, 'STOCK_DISPATCHED', 'STOCK_TRANSACTION', txId, undefined, { txCode, qty: qtyToIssue, receiverName, serialNumber: selectedItem?.serialNumber });

      res.status(201).json({
        success: true,
        message: `Successfully dispatched ${qtyToIssue} unit(s) to ${receiverName}`
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: `Database Connection Failed: ${err.message}` });
    }
  });

  // 10. Valuation Reports
  app.get('/api/reports/valuation', async (req: Request, res: Response) => {
    if (!checkDbConnection(res)) return;
    try {
      const { deptId: userDeptId, isAdmin } = getUserScope(req);
      const fyId = req.query.financialYearId as string;
      let deptId = req.query.departmentId as string;
      if (!isAdmin && userDeptId) {
        deptId = userDeptId;
      }

      const [fyRows]: any = await mysqlPool!.query('SELECT * FROM financial_years');
      const financialYears = fyRows.map(mapFinancialYearRow);
      const activeFy = financialYears.find(f => f.id === fyId) || financialYears.find(f => f.isActive) || financialYears[0];
      const targetFyId = activeFy ? activeFy.id : '';

      let bQuery = 'SELECT * FROM stock_batches WHERE financial_year_id = ?';
      let bParams: any[] = [targetFyId];
      if (deptId) {
        bQuery += ' AND department_id = ?';
        bParams.push(deptId);
      }
      const [bRows]: any = await mysqlPool!.query(bQuery, bParams);
      const filteredBatches = bRows.map(mapStockBatchRow);

      let tQuery = 'SELECT * FROM stock_transactions WHERE financial_year_id = ?';
      let tParams: any[] = [targetFyId];
      if (deptId) {
        tQuery += ' AND (department_id = ? OR receiver_department_id = ?)';
        tParams.push(deptId, deptId);
      }
      const [tRows]: any = await mysqlPool!.query(tQuery, tParams);
      const filteredTxs = tRows.map(mapStockTransactionRow);

      let iQuery = 'SELECT * FROM inventory_items WHERE financial_year_id = ?';
      let iParams: any[] = [targetFyId];
      if (deptId) {
        iQuery += ' AND department_id = ?';
        iParams.push(deptId);
      }
      const [iRows]: any = await mysqlPool!.query(iQuery, iParams);
      const filteredItems = iRows.map(mapInventoryItemRow);

      let deptName = 'All Departments';
      if (deptId) {
        const [dRows]: any = await mysqlPool!.query('SELECT name FROM departments WHERE id = ?', [deptId]);
        if (dRows.length > 0) deptName = dRows[0].name;
      }

      const totalIncomingQuantity = filteredBatches.reduce((s, b) => s + b.totalQuantity, 0);
      const totalIncomingValue = filteredBatches.reduce((s, b) => s + (b.totalQuantity * b.unitCost), 0);

      const outgoingTxs = filteredTxs.filter(t => t.type === 'STOCK_OUT');
      const totalOutgoingQuantity = outgoingTxs.reduce((s, t) => s + t.quantity, 0);
      const totalOutgoingValue = outgoingTxs.reduce((s, t) => s + t.totalValue, 0);

      const remainingStockCount = filteredBatches.reduce((s, b) => s + b.availableQuantity, 0);
      const remainingStockValue = filteredBatches.reduce((s, b) => s + (b.availableQuantity * b.unitCost), 0);

      const itemsUnderMaintenance = filteredItems.filter(i => i.status === 'UNDER_MAINTENANCE').length;
      const decommissionedItems = filteredItems.filter(i => i.status === 'DECOMMISSIONED').length;

      res.json({
        success: true,
        summary: {
          financialYearCode: activeFy ? activeFy.yearCode : '2025-2026',
          departmentName: deptName,
          totalIncomingQuantity,
          totalIncomingValue,
          totalOutgoingQuantity,
          totalOutgoingValue,
          remainingStockCount,
          remainingStockValue,
          itemsUnderMaintenance,
          decommissionedItems,
          generatedAt: new Date().toISOString()
        },
        batches: filteredBatches,
        transactions: filteredTxs
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: `Database Connection Failed: ${err.message}` });
    }
  });

  // 11. Transactions List
  app.get('/api/transactions', async (req: Request, res: Response) => {
    if (!checkDbConnection(res)) return;
    try {
      const { deptId: userDeptId, isAdmin } = getUserScope(req);
      let query = `
        SELECT t.*, b.batch_number, i.serial_number, c.name as category_name, fy.year_code as financial_year_code,
               d1.name as department_name, d2.name as receiver_department_name, u.full_name as issued_by_name
        FROM stock_transactions t
        LEFT JOIN stock_batches b ON t.batch_id = b.id
        LEFT JOIN inventory_items i ON t.item_id = i.id
        LEFT JOIN categories c ON b.category_id = c.id
        LEFT JOIN financial_years fy ON t.financial_year_id = fy.id
        LEFT JOIN departments d1 ON t.department_id = d1.id
        LEFT JOIN departments d2 ON t.receiver_department_id = d2.id
        LEFT JOIN users u ON t.issued_by_user_id = u.id
      `;
      const params: any[] = [];

      if (!isAdmin && userDeptId) {
        query += ' WHERE t.department_id = ? OR t.receiver_department_id = ?';
        params.push(userDeptId, userDeptId);
      }

      query += ' ORDER BY t.created_at DESC';

      const [rows]: any = await mysqlPool!.query(query, params);
      const transactions = rows.map(mapStockTransactionRow);
      res.json({ success: true, transactions });
    } catch (err: any) {
      res.status(500).json({ success: false, error: `Database Connection Failed: ${err.message}` });
    }
  });

  // 12. Audit Logs
  app.get('/api/audit-logs', async (req: Request, res: Response) => {
    if (!checkDbConnection(res)) return;
    try {
      const [rows]: any = await mysqlPool!.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 500');
      const logs = rows.map(mapAuditLogRow);
      res.json({ success: true, logs });
    } catch (err: any) {
      res.status(500).json({ success: false, error: `Database Connection Failed: ${err.message}` });
    }
  });

  // 13. System Settings
  app.get('/api/settings', async (req: Request, res: Response) => {
    if (!checkDbConnection(res)) return;
    try {
      const [rows]: any = await mysqlPool!.query('SELECT * FROM system_settings WHERE key_name = "global_settings"');
      if (rows.length > 0 && rows[0].value_text) {
        res.json({ success: true, settings: JSON.parse(rows[0].value_text) });
      } else {
        res.json({ success: true, settings: INITIAL_SETTINGS });
      }
    } catch (err: any) {
      res.status(500).json({ success: false, error: `Database Connection Failed: ${err.message}` });
    }
  });

  app.put('/api/settings', async (req: Request, res: Response) => {
    if (!checkDbConnection(res)) return;
    try {
      const [rows]: any = await mysqlPool!.query('SELECT * FROM system_settings WHERE key_name = "global_settings"');
      let currentSettings = INITIAL_SETTINGS;
      if (rows.length > 0 && rows[0].value_text) {
        try { currentSettings = JSON.parse(rows[0].value_text); } catch (e) {}
      }
      const updatedSettings = { ...currentSettings, ...req.body };

      await mysqlPool!.query(`
        INSERT INTO system_settings (key_name, value_text)
        VALUES ('global_settings', ?)
        ON DUPLICATE KEY UPDATE value_text = VALUES(value_text)
      `, [JSON.stringify(updatedSettings)]);

      await logAudit(req, 'SETTINGS_UPDATED', 'SYSTEM_SETTINGS', 'GLOBAL', undefined, updatedSettings);
      res.json({ success: true, settings: updatedSettings });
    } catch (err: any) {
      res.status(500).json({ success: false, error: `Database Connection Failed: ${err.message}` });
    }
  });

  function strPad(n: number, width: number): string {
    const z = '0';
    const num = n + '';
    return num.length >= width ? num : new Array(width - num.length + 1).join(z) + num;
  }

  // -------------------------------------------------------------------------
  // VITE MIDDLEWARE & STATIC FALLBACK
  // -------------------------------------------------------------------------
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[StockVault Enterprise] Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
