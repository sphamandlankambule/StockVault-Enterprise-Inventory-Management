import express, { Request, Response } from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { UserRole, AuditLog } from './src/types';
import {
  INITIAL_DEPARTMENTS,
  INITIAL_CATEGORIES,
  INITIAL_FINANCIAL_YEARS,
  INITIAL_USERS,
  INITIAL_BATCHES,
  INITIAL_ITEMS,
  INITIAL_TRANSACTIONS,
  INITIAL_AUDIT_LOGS,
  INITIAL_SETTINGS
} from './src/data/mockDatabase';

const PORT = 3000;

// In-Memory Database Store initialized with default enterprise data
let dbDepartments = [...INITIAL_DEPARTMENTS];
let dbCategories = [...INITIAL_CATEGORIES];
let dbFinancialYears = [...INITIAL_FINANCIAL_YEARS];
let dbUsers = [...INITIAL_USERS];
let dbBatches = [...INITIAL_BATCHES];
let dbItems = [...INITIAL_ITEMS];
let dbTransactions = [...INITIAL_TRANSACTIONS];
let dbAuditLogs = [...INITIAL_AUDIT_LOGS];
let dbSettings = { ...INITIAL_SETTINGS };

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '10mb' }));

  const PHP_BACKEND_URL = process.env.PHP_BACKEND_URL || process.env.VITE_PHP_BACKEND_URL || 'http://127.0.0.1:8000/api';

  const forwardToPhp = async (phpScript: string, req: Request, res: Response): Promise<boolean> => {
    try {
      const queryString = new URLSearchParams(req.query as any).toString();
      const url = `${PHP_BACKEND_URL}/${phpScript}${queryString ? '?' + queryString : ''}`;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      };
      if (req.headers['x-user-id']) headers['x-user-id'] = String(req.headers['x-user-id']);
      if (req.headers['x-user-role']) headers['x-user-role'] = String(req.headers['x-user-role']);
      if (req.headers['x-user-department-id']) headers['x-user-department-id'] = String(req.headers['x-user-department-id']);

      const fetchOptions: RequestInit = {
        method: req.method,
        headers
      };
      if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body && Object.keys(req.body).length > 0) {
        fetchOptions.body = JSON.stringify(req.body);
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2000);
      fetchOptions.signal = controller.signal;

      const response = await fetch(url, fetchOptions);
      clearTimeout(timeout);

      if (response.ok) {
        const json = await response.json();
        res.json(json);
        return true;
      }
    } catch {
      // Fall through to native handler
    }
    return false;
  };

  // Helper to log audit events
  const addAuditLog = (
    userId: string,
    userName: string,
    userRole: string,
    action: string,
    entityType: string,
    entityId: string,
    newValues: any,
    req: Request
  ) => {
    const validRole: UserRole = (['ADMIN', 'STORE_KEEPER', 'STAFF_RECEIVER'].includes(userRole)
      ? userRole
      : 'ADMIN') as UserRole;

    const newLog: AuditLog = {
      id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      userId: userId || 'user-admin',
      userName: userName || 'System Administrator',
      userRole: validRole,
      action,
      entityType,
      entityId: String(entityId),
      newValues: typeof newValues === 'string' ? newValues : JSON.stringify(newValues),
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1',
      userAgent: req.headers['user-agent'] || 'StockVault System',
      createdAt: new Date().toISOString()
    };
    dbAuditLogs.unshift(newLog);
    return newLog;
  };

  // Healthcheck endpoint
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      mode: 'In-Memory Enterprise State Store',
      activeUsers: dbUsers.length,
      activeBatches: dbBatches.length
    });
  });

  // DB status endpoint
  app.get('/api/db/status', (_req: Request, res: Response) => {
    res.json({
      success: true,
      connected: true,
      engine: 'StockVault Native In-Memory Engine',
      tables: {
        users: dbUsers.length,
        departments: dbDepartments.length,
        categories: dbCategories.length,
        financialYears: dbFinancialYears.length,
        stockBatches: dbBatches.length,
        inventoryItems: dbItems.length,
        stockTransactions: dbTransactions.length,
        auditLogs: dbAuditLogs.length
      }
    });
  });

  // ---------------- AUTH ROUTES ----------------
  app.post(['/api/auth/login', '/api/auth.php'], (req: Request, res: Response) => {
    const { username, password } = req.body || {};
    const user = dbUsers.find(
      u => u.username?.toLowerCase() === String(username || '').toLowerCase() && u.password === password
    );

    if (user) {
      addAuditLog(user.id, user.fullName, user.role, 'USER_LOGIN', 'USER', user.id, { username }, req);
      res.json({ success: true, user, token: `token-${user.id}` });
    } else {
      res.status(401).json({ success: false, error: 'Invalid username or password' });
    }
  });

  app.post(['/api/auth/change-password', '/api/auth/change_password.php'], (req: Request, res: Response) => {
    const { userId, oldPassword, newPassword } = req.body || {};
    const userIndex = dbUsers.findIndex(u => String(u.id) === String(userId));
    if (userIndex !== -1) {
      if (dbUsers[userIndex].password === oldPassword) {
        dbUsers[userIndex].password = newPassword;
        dbUsers[userIndex].updatedAt = new Date().toISOString();
        addAuditLog(dbUsers[userIndex].id, dbUsers[userIndex].fullName, dbUsers[userIndex].role, 'PASSWORD_CHANGED', 'USER', dbUsers[userIndex].id, {}, req);
        res.json({ success: true, message: 'Password updated successfully' });
      } else {
        res.status(400).json({ success: false, error: 'Current password is incorrect' });
      }
    } else {
      res.status(404).json({ success: false, error: 'User not found' });
    }
  });

  // ---------------- USER ROUTES ----------------
  app.get(['/api/users', '/api/users.php'], (_req: Request, res: Response) => {
    res.json({ success: true, users: dbUsers });
  });

  app.post(['/api/users', '/api/users.php'], (req: Request, res: Response) => {
    const body = req.body || {};
    const newUser = {
      id: `user-${Date.now()}`,
      username: body.username || `user_${Date.now()}`,
      password: body.password || 'User@123',
      role: (body.role || 'STAFF_RECEIVER') as UserRole,
      fullName: body.fullName || 'New User',
      email: body.email || '',
      departmentId: String(body.departmentId || ''),
      departmentName: body.departmentName || '',
      status: 'ACTIVE' as const,
      createdBy: String(req.headers['x-user-id'] || 'ADMIN'),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    dbUsers.push(newUser);
    addAuditLog(newUser.createdBy, 'Admin', 'ADMIN', 'USER_CREATED', 'USER', newUser.id, { fullName: newUser.fullName, role: newUser.role }, req);
    res.json({ success: true, user: newUser, users: dbUsers });
  });

  app.put('/api/users/:id/status', (req: Request, res: Response) => {
    const { id } = req.params;
    const { status } = req.body || {};
    const u = dbUsers.find(user => String(user.id) === String(id));
    if (u) {
      u.status = status;
      u.updatedAt = new Date().toISOString();
      addAuditLog(String(req.headers['x-user-id'] || '1'), 'Admin', 'ADMIN', 'USER_STATUS_UPDATED', 'USER', u.id, { status }, req);
      res.json({ success: true, user: u });
    } else {
      res.status(404).json({ success: false, error: 'User not found' });
    }
  });

  app.post('/api/users/:id/reset-password', (req: Request, res: Response) => {
    const { id } = req.params;
    const { newPassword } = req.body || {};
    const u = dbUsers.find(user => String(user.id) === String(id));
    if (u) {
      u.password = newPassword || 'StockVault@123';
      u.updatedAt = new Date().toISOString();
      addAuditLog(String(req.headers['x-user-id'] || '1'), 'Admin', 'ADMIN', 'PASSWORD_RESET', 'USER', u.id, {}, req);
      res.json({ success: true, message: 'Password reset successful' });
    } else {
      res.status(404).json({ success: false, error: 'User not found' });
    }
  });

  // ---------------- DEPARTMENT ROUTES ----------------
  app.get(['/api/departments', '/api/departments.php'], (_req: Request, res: Response) => {
    res.json({ success: true, departments: dbDepartments });
  });

  app.post(['/api/departments', '/api/departments.php'], (req: Request, res: Response) => {
    const body = req.body || {};
    const newDept = {
      id: `dept-${Date.now()}`,
      code: body.code || `DEPT-${Date.now()}`,
      name: body.name || 'New Department',
      description: body.description || '',
      budgetCode: body.budgetCode || '',
      createdAt: new Date().toISOString()
    };
    dbDepartments.push(newDept);
    addAuditLog(String(req.headers['x-user-id'] || '1'), 'Admin', 'ADMIN', 'DEPARTMENT_CREATED', 'DEPARTMENT', newDept.id, { name: newDept.name }, req);
    res.json({ success: true, department: newDept, departments: dbDepartments });
  });

  // ---------------- CATEGORY ROUTES ----------------
  app.get(['/api/categories', '/api/categories.php'], (_req: Request, res: Response) => {
    res.json({ success: true, categories: dbCategories });
  });

  app.post(['/api/categories', '/api/categories.php'], (req: Request, res: Response) => {
    const body = req.body || {};
    const newCat = {
      id: `cat-${Date.now()}`,
      code: body.code || `CAT-${Date.now()}`,
      name: body.name || 'New Category',
      description: body.description || '',
      lowStockThreshold: Number(body.lowStockThreshold) || 5,
      createdAt: new Date().toISOString()
    };
    dbCategories.push(newCat);
    addAuditLog(String(req.headers['x-user-id'] || '1'), 'Admin', 'ADMIN', 'CATEGORY_CREATED', 'CATEGORY', newCat.id, { name: newCat.name }, req);
    res.json({ success: true, category: newCat, categories: dbCategories });
  });

  // ---------------- FINANCIAL YEAR ROUTES ----------------
  app.get(['/api/financial-years', '/api/financial_years.php'], (_req: Request, res: Response) => {
    res.json({ success: true, financialYears: dbFinancialYears });
  });

  app.post(['/api/financial-years', '/api/financial_years.php'], (req: Request, res: Response) => {
    const body = req.body || {};
    const newFy = {
      id: `fy-${Date.now()}`,
      yearCode: body.yearCode || body.label || '2025-2026',
      startDate: body.startDate || '2025-04-01',
      endDate: body.endDate || '2026-03-31',
      isActive: Boolean(body.isActive),
      createdAt: new Date().toISOString()
    };
    if (newFy.isActive) {
      dbFinancialYears.forEach(f => (f.isActive = false));
    }
    dbFinancialYears.push(newFy);
    addAuditLog(String(req.headers['x-user-id'] || '1'), 'Admin', 'ADMIN', 'FINANCIAL_YEAR_CREATED', 'FINANCIAL_YEAR', newFy.id, { label: newFy.yearCode }, req);
    res.json({ success: true, financialYear: newFy, financialYears: dbFinancialYears });
  });

  app.put(['/api/financial-years/:id/activate', '/api/financial_years/:id/activate'], (req: Request, res: Response) => {
    const { id } = req.params;
    dbFinancialYears.forEach(f => {
      f.isActive = String(f.id) === String(id);
    });
    addAuditLog(String(req.headers['x-user-id'] || '1'), 'Admin', 'ADMIN', 'FINANCIAL_YEAR_ACTIVATED', 'FINANCIAL_YEAR', id, { activeId: id }, req);
    res.json({ success: true, financialYears: dbFinancialYears });
  });

  // Helper function to resolve FY ID (handles numeric IDs like "1" or "fy-2025")
  const resolveFy = (queryFyId?: any) => {
    if (!queryFyId) {
      return dbFinancialYears.find(f => f.isActive) || dbFinancialYears[0];
    }
    const q = String(queryFyId);
    return (
      dbFinancialYears.find(f => String(f.id) === q) ||
      dbFinancialYears.find(f => f.id.endsWith(q)) ||
      dbFinancialYears[parseInt(q, 10) - 1] ||
      dbFinancialYears.find(f => f.isActive) ||
      dbFinancialYears[0]
    );
  };

  // ---------------- STOCK BATCHES / ADD STOCK ROUTES ----------------
  app.get(['/api/stock/batches', '/api/stock_batches.php'], (req: Request, res: Response) => {
    const { financialYearId, departmentId } = req.query;
    let filtered = [...dbBatches];
    if (financialYearId) {
      const targetFy = resolveFy(financialYearId);
      if (targetFy) {
        filtered = filtered.filter(b => String(b.financialYearId) === String(targetFy.id));
      }
    }
    if (departmentId) {
      filtered = filtered.filter(b => String(b.departmentId) === String(departmentId));
    }
    res.json({ success: true, batches: filtered });
  });

  app.post(['/api/stock/batches', '/api/add-stock', '/api/add_stock.php', '/api/stock_batches.php'], (req: Request, res: Response) => {
    const body = req.body || {};
    const cat = dbCategories.find(c => String(c.id) === String(body.categoryId));
    const dept = dbDepartments.find(d => String(d.id) === String(body.departmentId));
    const fy = resolveFy(body.financialYearId);

    const qty = Number(body.totalQuantity) || Number(body.quantity) || 1;
    const unitCost = Number(body.unitCost) || 0;
    const isSerialized = Boolean(body.isSerialized);

    const newBatch = {
      id: `batch-${Date.now()}`,
      batchNumber: body.batchNumber || `BAT-${Date.now()}`,
      categoryId: String(body.categoryId || ''),
      categoryName: cat ? cat.name : 'General',
      departmentId: String(body.departmentId || ''),
      departmentName: dept ? dept.name : 'Central Warehouse',
      financialYearId: String(fy ? fy.id : ''),
      financialYearCode: fy ? fy.yearCode : '2025-2026',
      supplierName: body.supplierName || 'Direct Vendor',
      unitCost,
      isSerialized,
      totalQuantity: qty,
      availableQuantity: qty,
      receivedByUserId: String(req.headers['x-user-id'] || '1'),
      receivedByName: body.receivedByName || 'Store Keeper',
      status: 'ACTIVE' as const,
      remarks: body.remarks || '',
      createdAt: new Date().toISOString()
    };

    dbBatches.unshift(newBatch);

    // If serialized, generate items
    if (isSerialized) {
      const serList: string[] = Array.isArray(body.serialNumbers) ? body.serialNumbers : [];
      for (let i = 0; i < qty; i++) {
        const newItem = {
          id: `item-${Date.now()}-${i}`,
          batchId: newBatch.id,
          batchNumber: newBatch.batchNumber,
          itemCode: `ITM-${Date.now()}-${i + 1}`,
          serialNumber: serList[i] || `SN-${newBatch.batchNumber}-${i + 1}`,
          categoryId: newBatch.categoryId,
          categoryName: newBatch.categoryName,
          departmentId: newBatch.departmentId,
          departmentName: newBatch.departmentName,
          financialYearId: newBatch.financialYearId,
          financialYearCode: newBatch.financialYearCode,
          status: 'IN_STOCK' as const,
          unitCost: newBatch.unitCost,
          location: body.location || 'Rack 1 - Shelf A',
          notes: 'Batch received',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        dbItems.unshift(newItem);
      }
    }

    // Add Stock In Transaction
    const newTx = {
      id: `tx-${Date.now()}`,
      transactionCode: `TX-IN-${Date.now()}`,
      type: 'STOCK_IN' as const,
      batchId: newBatch.id,
      financialYearId: newBatch.financialYearId,
      financialYearCode: newBatch.financialYearCode,
      departmentId: newBatch.departmentId,
      departmentName: newBatch.departmentName,
      quantity: qty,
      unitCost,
      totalValue: qty * unitCost,
      issuedByUserId: newBatch.receivedByUserId,
      issuedByName: newBatch.receivedByName,
      receivedByName: 'Store Vault Central',
      receiverDepartmentId: newBatch.departmentId,
      receiverDepartmentName: newBatch.departmentName,
      remarks: `Received batch ${newBatch.batchNumber}`,
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1',
      timestamp: new Date().toISOString()
    };
    dbTransactions.unshift(newTx);

    addAuditLog(newBatch.receivedByUserId, newBatch.receivedByName, 'STORE_KEEPER', 'STOCK_IN_BATCH', 'STOCK_BATCH', newBatch.id, { batchNumber: newBatch.batchNumber, qty }, req);

    res.json({ success: true, batch: newBatch, batches: dbBatches });
  });

  // ---------------- INVENTORY ITEMS ROUTES ----------------
  app.get(['/api/stock/items', '/api/inventory_items.php'], (req: Request, res: Response) => {
    const { financialYearId, departmentId } = req.query;
    let filtered = [...dbItems];
    if (financialYearId) {
      const targetFy = resolveFy(financialYearId);
      if (targetFy) {
        filtered = filtered.filter(i => String(i.financialYearId) === String(targetFy.id));
      }
    }
    if (departmentId) {
      filtered = filtered.filter(i => String(i.departmentId) === String(departmentId));
    }
    res.json({ success: true, items: filtered });
  });

  app.put(['/api/stock/items/:id/status', '/api/inventory_items/:id/status'], (req: Request, res: Response) => {
    const { id } = req.params;
    const { status, notes } = req.body || {};
    const item = dbItems.find(i => String(i.id) === String(id));
    if (item) {
      const oldStatus = item.status;
      item.status = status;
      if (notes) item.notes = notes;
      item.updatedAt = new Date().toISOString();

      addAuditLog(
        String(req.headers['x-user-id'] || '1'),
        'Store Keeper',
        'STORE_KEEPER',
        'ITEM_STATUS_CHANGED',
        'INVENTORY_ITEM',
        item.id,
        { itemCode: item.itemCode, oldStatus, newStatus: status, notes },
        req
      );
      res.json({ success: true, item });
    } else {
      res.status(404).json({ success: false, error: 'Inventory item not found' });
    }
  });

  // ---------------- DISPATCH / STOCK OUT ROUTES ----------------
  app.post(['/api/stock/dispatch', '/api/stock-out', '/api/stock_out.php'], (req: Request, res: Response) => {
    const body = req.body || {};
    const batch = dbBatches.find(b => String(b.id) === String(body.batchId));

    if (!batch) {
      return res.status(400).json({ success: false, error: 'Invalid batch selected for dispatch' });
    }

    const qty = Number(body.quantity) || 1;
    if (batch.availableQuantity < qty) {
      return res.status(400).json({ success: false, error: `Insufficient stock in batch. Available: ${batch.availableQuantity}` });
    }

    // Deduct stock
    batch.availableQuantity -= qty;

    let targetItem = null;
    if (body.itemId) {
      targetItem = dbItems.find(i => String(i.id) === String(body.itemId));
      if (targetItem) {
        targetItem.status = 'ISSUED';
        targetItem.updatedAt = new Date().toISOString();
      }
    }

    const sigs = body.signatures || {};
    const newTx = {
      id: `tx-${Date.now()}`,
      transactionCode: `TX-OUT-${Date.now()}`,
      type: 'STOCK_OUT' as const,
      batchId: batch.id,
      itemId: targetItem ? targetItem.id : undefined,
      serialNumber: targetItem ? targetItem.serialNumber : undefined,
      categoryName: batch.categoryName,
      financialYearId: batch.financialYearId,
      financialYearCode: batch.financialYearCode,
      departmentId: batch.departmentId,
      departmentName: batch.departmentName,
      quantity: qty,
      unitCost: batch.unitCost,
      totalValue: qty * batch.unitCost,
      issuedByUserId: String(body.issuerUserId || req.headers['x-user-id'] || 'user-keeper'),
      issuedByName: sigs.issuerName || 'Marcus Vance',
      receivedByName: body.receiverName || sigs.receiverName || 'Sarah Jenkins',
      receiverDepartmentId: String(body.receiverDepartmentId || body.departmentId || batch.departmentId),
      receiverDepartmentName: body.receiverDepartmentName || 'Department Receiver',
      remarks: body.remarks || 'Dispatched with verified dual signatures',
      signatures: {
        issuerSignatureBase64: sigs.issuerSignatureBase64 || sigs.issuerBase64 || '',
        issuerName: sigs.issuerName || 'Marcus Vance',
        issuerRole: 'STORE_KEEPER',
        receiverSignatureBase64: sigs.receiverSignatureBase64 || sigs.receiverBase64 || '',
        receiverName: body.receiverName || sigs.receiverName || 'Sarah Jenkins',
        receiverRole: 'STAFF_RECEIVER',
        receiverDepartmentId: String(body.receiverDepartmentId || batch.departmentId),
        ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1',
        deviceTimestamp: new Date().toISOString()
      },
      ipAddress: (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1',
      timestamp: new Date().toISOString()
    };

    dbTransactions.unshift(newTx);

    addAuditLog(
      newTx.issuedByUserId,
      newTx.issuedByName,
      'STORE_KEEPER',
      'STOCK_DISPATCH_DUAL_SIG',
      'STOCK_TRANSACTION',
      newTx.id,
      { txCode: newTx.transactionCode, batchId: batch.id, receiver: newTx.receivedByName, qty },
      req
    );

    res.json({ success: true, transaction: newTx, batch });
  });

  // ---------------- TRANSACTIONS ROUTES ----------------
  app.get(['/api/transactions', '/api/transactions.php'], (_req: Request, res: Response) => {
    res.json({ success: true, transactions: dbTransactions });
  });

  // ---------------- AUDIT LOGS ROUTES ----------------
  app.get(['/api/audit-logs', '/api/audit_logs.php'], (_req: Request, res: Response) => {
    res.json({ success: true, auditLogs: dbAuditLogs, logs: dbAuditLogs });
  });

  app.post(['/api/audit-logs', '/api/audit_logs.php'], (req: Request, res: Response) => {
    const body = req.body || {};
    const log = addAuditLog(
      body.userId || String(req.headers['x-user-id'] || '1'),
      body.userName || 'User',
      body.userRole || 'STAFF_RECEIVER',
      body.action || 'CUSTOM_ACTION',
      body.entityType || 'SYSTEM',
      body.entityId || '1',
      body.newValues || {},
      req
    );
    res.json({ success: true, log, logs: dbAuditLogs });
  });

  // ---------------- SETTINGS ROUTES ----------------
  app.get(['/api/settings', '/api/settings.php'], (_req: Request, res: Response) => {
    res.json({ success: true, settings: dbSettings });
  });

  app.post(['/api/settings', '/api/settings.php'], (req: Request, res: Response) => {
    dbSettings = { ...dbSettings, ...req.body };
    addAuditLog(String(req.headers['x-user-id'] || '1'), 'Admin', 'ADMIN', 'SETTINGS_UPDATED', 'SYSTEM', '1', dbSettings, req);
    res.json({ success: true, settings: dbSettings });
  });

  // ---------------- REPORTS & VALUATION ROUTES ----------------
  app.all(['/api/reports*', '/api/reports.php*'], async (req: Request, res: Response) => {
    if (await forwardToPhp('reports.php', req, res)) return;

    const fyQueryParam = req.query.financialYearId || req.query.financial_year_id || dbSettings.activeFinancialYearId;
    const deptId = req.query.departmentId || req.query.department_id || '';

    const fy = resolveFy(fyQueryParam);
    const fyLabel = fy ? fy.yearCode : '2025-2026';

    let deptName = 'All Organization Departments';
    if (deptId) {
      const d = dbDepartments.find(dep => String(dep.id) === String(deptId));
      if (d) deptName = d.name;
    }

    // Filter Batches
    let matchingBatches = dbBatches;
    if (fy) {
      matchingBatches = matchingBatches.filter(b => String(b.financialYearId) === String(fy.id));
    }
    if (deptId) {
      matchingBatches = matchingBatches.filter(b => String(b.departmentId) === String(deptId));
    }

    // Filter Transactions
    let matchingTxs = dbTransactions;
    if (fy) {
      matchingTxs = matchingTxs.filter(t => String(t.financialYearId) === String(fy.id));
    }
    if (deptId) {
      matchingTxs = matchingTxs.filter(t => String(t.departmentId) === String(deptId) || String(t.receiverDepartmentId) === String(deptId));
    }

    // Calculations
    const totalIncomingQty = matchingBatches.reduce((acc, b) => acc + (Number(b.totalQuantity) || 0), 0);
    const totalIncomingValue = matchingBatches.reduce((acc, b) => acc + (Number(b.totalQuantity) || 0) * (Number(b.unitCost) || 0), 0);

    const remainingQty = matchingBatches.reduce((acc, b) => acc + (Number(b.availableQuantity) || 0), 0);
    const remainingValue = matchingBatches.reduce((acc, b) => acc + (Number(b.availableQuantity) || 0) * (Number(b.unitCost) || 0), 0);

    const stockOutTxs = matchingTxs.filter(t => t.type === 'STOCK_OUT');
    const totalOutgoingQty = stockOutTxs.reduce((acc, t) => acc + (Number(t.quantity) || 0), 0);
    const totalOutgoingValue = stockOutTxs.reduce((acc, t) => acc + (Number(t.totalValue) || 0), 0);

    // Filter matching items for maintenance / decommissioned counts
    const matchingBatchIds = new Set(matchingBatches.map(b => String(b.id)));
    const matchingItems = dbItems.filter(i => matchingBatchIds.has(String(i.batchId)));

    const itemsUnderMaintenance = matchingItems.filter(i => i.status === 'UNDER_MAINTENANCE' || (i.status as string) === 'MAINTENANCE').length;
    const decommissionedItems = matchingItems.filter(i => i.status === 'DECOMMISSIONED').length;

    const summaryData = {
      financialYearCode: fyLabel,
      departmentName: deptName,
      totalIncomingQuantity: totalIncomingQty,
      totalIncomingValue: Math.round(totalIncomingValue * 100) / 100,
      totalOutgoingQuantity: totalOutgoingQty,
      totalOutgoingValue: Math.round(totalOutgoingValue * 100) / 100,
      remainingStockCount: remainingQty,
      remainingStockValue: Math.round(remainingValue * 100) / 100,
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
  });

  // ---------------- DASHBOARD METRICS ROUTES ----------------
  app.get(['/api/dashboard/metrics', '/api/dashboard_metrics.php'], (req: Request, res: Response) => {
    const fyParam = req.query.financialYearId || dbSettings.activeFinancialYearId;
    const userDeptId = (req.headers['x-user-department-id'] as string) || '';
    const userRole = (req.headers['x-user-role'] as string) || 'ADMIN';

    const fy = resolveFy(fyParam);

    let matchingBatches = dbBatches;
    if (fy) {
      matchingBatches = matchingBatches.filter(b => String(b.financialYearId) === String(fy.id));
    }
    if (userRole !== 'ADMIN' && userDeptId) {
      matchingBatches = matchingBatches.filter(b => String(b.departmentId) === String(userDeptId));
    }

    const totalValue = matchingBatches.reduce((acc, b) => acc + (Number(b.availableQuantity) || 0) * (Number(b.unitCost) || 0), 0);
    const lowStockCount = matchingBatches.filter(b => b.availableQuantity <= (b.categoryName === 'Office Stationery' ? 20 : 5)).length;

    let matchingItems = dbItems;
    if (fy) {
      matchingItems = matchingItems.filter(i => String(i.financialYearId) === String(fy.id));
    }
    if (userRole !== 'ADMIN' && userDeptId) {
      matchingItems = matchingItems.filter(i => String(i.departmentId) === String(userDeptId));
    }

    const issuedCount = matchingItems.filter(i => i.status === 'ISSUED').length;
    const maintenanceCount = matchingItems.filter(i => i.status === 'UNDER_MAINTENANCE' || (i.status as string) === 'MAINTENANCE').length;
    const decommissionedCount = matchingItems.filter(i => i.status === 'DECOMMISSIONED').length;

    res.json({
      success: true,
      metrics: {
        totalStockBatches: matchingBatches.length,
        totalStockValue: totalValue,
        lowStockAlerts: lowStockCount,
        totalItemsIssued: issuedCount,
        pendingMaintenance: maintenanceCount,
        decommissionedCount,
        activeDepartmentsCount: dbDepartments.length,
        recentTransactions: dbTransactions.slice(0, 5)
      }
    });
  });

  // Vite Dev Server / Static Serve
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
    console.log(`[StockVault Enterprise Engine] Running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
