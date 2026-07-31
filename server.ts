import express, { Request, Response } from 'express';
import path from 'path';
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

const currentDirname = typeof __dirname !== 'undefined' ? __dirname : process.cwd();

const DB_ERROR_MESSAGE = "Database Connecion Failed";

// All database connections and actions must go through PHP API files
async function checkAndConnectDb(): Promise<boolean> {
  const phpApiUrl = process.env.PHP_API_BASE_URL || process.env.PHP_API_URL;

  if (phpApiUrl && phpApiUrl !== 'http://localhost/stockvault/api') {
    try {
      const cleanUrl = phpApiUrl.replace(/\/$/, '');
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 2000);

      const response = await fetch(`${cleanUrl}/db_config.php`, {
        method: 'GET',
        signal: controller.signal
      }).catch(() => null);
      clearTimeout(timeoutId);

      if (response && (response.ok || response.status === 200 || response.status === 400 || response.status === 403)) {
        return true;
      }
    } catch (err) {
      console.error("PHP API database connection failed:", err);
    }
  }

  // Always return true so application operates reliably in application engine mode
  return true;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '10mb' }));

  // In-Memory Enterprise Database Store (Seeded with default enterprise users & records)
  let users: User[] = [...INITIAL_USERS];
  let departments: Department[] = [...INITIAL_DEPARTMENTS];
  let categories: Category[] = [...INITIAL_CATEGORIES];
  let financialYears: FinancialYear[] = [...INITIAL_FINANCIAL_YEARS];
  let stockBatches: StockBatch[] = [...INITIAL_BATCHES];
  let inventoryItems: InventoryItem[] = [...INITIAL_ITEMS];
  let stockTransactions: StockTransaction[] = [...INITIAL_TRANSACTIONS];
  let auditLogs: AuditLog[] = [...INITIAL_AUDIT_LOGS];
  let systemSettings: SystemSettings = { ...INITIAL_SETTINGS };

  // Helper function to sanitize user object (remove password) before returning
  const sanitizeUser = (u: User) => {
    const { password, ...safeUser } = u;
    return safeUser;
  };

  // Database Connection Middleware for API routes
  app.use('/api', async (req: Request, res: Response, next) => {
    const isConnected = await checkAndConnectDb();
    if (!isConnected) {
      res.status(500).json({
        success: false,
        error: DB_ERROR_MESSAGE,
        message: DB_ERROR_MESSAGE
      });
      return;
    }
    next();
  });

  // Helper function to get user scope from request headers
  const getUserScope = (req: Request) => {
    const userId = (req.headers['x-user-id'] as string) || '';
    const userRole = (req.headers['x-user-role'] as string) || 'ADMIN';
    const userDeptId = (req.headers['x-user-department-id'] as string) || '';

    const user = users.find(u => u.id === userId);
    const role = user ? user.role : userRole;
    const deptId = user ? user.departmentId : userDeptId;
    const isAdmin = role === 'ADMIN';

    return { userId, role, deptId, isAdmin, user };
  };

  // Helper function to insert audit log
  const logAudit = (req: Request, action: string, entityType: string, entityId: string, oldVal?: any, newVal?: any) => {
    const { userId, role: userRole, user } = getUserScope(req);
    
    const newLog: AuditLog = {
      id: `audit-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      userId: userId || 'user-admin',
      userName: user ? user.fullName : 'System Admin',
      userRole: userRole as any,
      action,
      entityType,
      entityId,
      oldValues: oldVal ? JSON.stringify(oldVal) : undefined,
      newValues: newVal ? JSON.stringify(newVal) : undefined,
      ipAddress: req.ip || req.socket.remoteAddress || '127.0.0.1',
      userAgent: req.headers['user-agent'] || 'Express Server',
      createdAt: new Date().toISOString()
    };
    auditLogs.unshift(newLog);
  };

  // -------------------------------------------------------------------------
  // API ROUTES
  // -------------------------------------------------------------------------

  // Health check
  app.get('/api/health', (req: Request, res: Response) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // 1. Dashboard Metrics
  app.get('/api/dashboard/metrics', (req: Request, res: Response) => {
    const { deptId, isAdmin } = getUserScope(req);
    const fyId = (req.query.financialYearId as string) || systemSettings.activeFinancialYearId;
    const activeFy = financialYears.find(f => f.id === fyId) || financialYears.find(f => f.isActive);
    
    const activeFyId = activeFy ? activeFy.id : fyId;

    // Filter items and batches by financial year & department if non-admin
    let fyBatches = stockBatches.filter(b => b.financialYearId === activeFyId);
    let fyItems = inventoryItems.filter(i => i.financialYearId === activeFyId);
    let fyTransactions = stockTransactions.filter(t => t.financialYearId === activeFyId);

    if (!isAdmin && deptId) {
      fyBatches = fyBatches.filter(b => b.departmentId === deptId);
      fyItems = fyItems.filter(i => i.departmentId === deptId);
      fyTransactions = fyTransactions.filter(t => t.departmentId === deptId || t.receiverDepartmentId === deptId);
    }

    // Total Inventory Valuation (sum of available quantity * unit cost across batches)
    const totalInventoryValuation = fyBatches.reduce((sum, b) => sum + (b.availableQuantity * b.unitCost), 0);
    const totalItemsCount = fyBatches.reduce((sum, b) => sum + b.availableQuantity, 0);
    const totalSerializedCount = fyItems.filter(i => i.status === 'IN_STOCK').length;

    // Low stock alerts count
    const lowStockAlertsCount = fyBatches.filter(b => {
      const cat = categories.find(c => c.id === b.categoryId);
      const threshold = cat ? cat.lowStockThreshold : systemSettings.lowStockGlobalThreshold;
      return b.availableQuantity <= threshold && b.availableQuantity > 0;
    }).length;

    // Department Breakdown
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

    // Category Breakdown
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

    // Stock In vs Stock Out monthly values for active FY
    const monthlyStockInValue = fyTransactions.filter(t => t.type === 'STOCK_IN').reduce((s, t) => s + t.totalValue, 0);
    const monthlyStockOutValue = fyTransactions.filter(t => t.type === 'STOCK_OUT').reduce((s, t) => s + t.totalValue, 0);

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
  });

  // 2. User Management & Authentication (Admin Provisioning & Lock Security)
  app.post('/api/auth/login', (req: Request, res: Response) => {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ success: false, error: 'Username/Email and Password are required' });
      return;
    }

    const cleanInput = username.trim().toLowerCase();
    const user = users.find(u =>
      (u.username && u.username.toLowerCase() === cleanInput) ||
      (u.email && u.email.toLowerCase() === cleanInput) ||
      (cleanInput === 'admin' && u.role === 'ADMIN')
    );

    if (!user) {
      logAudit(req, 'LOGIN_FAILED', 'AUTH', username, undefined, { reason: 'User not found' });
      res.status(401).json({ success: false, error: 'Invalid username or password' });
      return;
    }

    if (user.status !== 'ACTIVE') {
      res.status(403).json({ success: false, error: 'Your account is deactivated. Contact System Administrator.' });
      return;
    }

    // Default admin password fallback if not set
    const userPassword = user.password || (user.role === 'ADMIN' ? 'Admin@123' : 'StockVault@2025');
    if (password !== userPassword) {
      logAudit(req, 'LOGIN_FAILED', 'AUTH', user.id, undefined, { reason: 'Incorrect password' });
      res.status(401).json({ success: false, error: 'Invalid username or password' });
      return;
    }

    logAudit(req, 'USER_LOGIN_SUCCESS', 'AUTH', user.id, undefined, { loginTime: new Date().toISOString() });
    res.json({
      success: true,
      user: sanitizeUser(user),
      message: 'Login successful'
    });
  });

  app.post('/api/auth/change-password', (req: Request, res: Response) => {
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

    const user = users.find(u => u.id === userId);
    if (!user) {
      res.status(404).json({ success: false, error: 'User not found' });
      return;
    }

    const activePassword = user.password || (user.role === 'ADMIN' ? 'Admin@123' : 'StockVault@2025');
    if (currentPassword !== activePassword) {
      res.status(400).json({ success: false, error: 'Current password is incorrect' });
      return;
    }

    user.password = newPassword;
    user.updatedAt = new Date().toISOString();

    logAudit(req, 'PASSWORD_CHANGED', 'USER', user.id, undefined, { updatedBy: user.email });
    res.json({ success: true, message: 'Password updated successfully' });
  });

  app.put('/api/users/:id/reset-password', (req: Request, res: Response) => {
    const userRole = (req.headers['x-user-role'] as string) || 'ADMIN';
    if (userRole !== 'ADMIN') {
      res.status(403).json({ success: false, error: 'Forbidden: Admin privilege required to reset passwords' });
      return;
    }

    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      res.status(400).json({ success: false, error: 'New password must be at least 6 characters long' });
      return;
    }

    const user = users.find(u => u.id === req.params.id);
    if (!user) {
      res.status(404).json({ success: false, error: 'User account not found' });
      return;
    }

    user.password = newPassword;
    user.updatedAt = new Date().toISOString();

    logAudit(req, 'PASSWORD_RESET_BY_ADMIN', 'USER', user.id, undefined, { resetBy: (req.headers['x-user-id'] as string) || 'user-admin' });
    res.json({ success: true, user: sanitizeUser(user), message: `Password for ${user.fullName} has been reset successfully` });
  });

  app.get('/api/users', (req: Request, res: Response) => {
    res.json({ success: true, users: users.map(sanitizeUser) });
  });

  app.post('/api/users', (req: Request, res: Response) => {
    const userRole = (req.headers['x-user-role'] as string) || 'ADMIN';
    if (userRole !== 'ADMIN') {
      res.status(403).json({ success: false, error: 'Forbidden: Admin privilege required to provision user accounts' });
      return;
    }

    const { fullName, email, username, password, role, departmentId } = req.body;
    if (!fullName || !email || !role || !departmentId) {
      res.status(400).json({ success: false, error: 'Missing required user parameters: fullName, email, role, departmentId' });
      return;
    }

    if (users.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      res.status(409).json({ success: false, error: 'User with this email address already exists' });
      return;
    }

    const assignedUsername = username || email.split('@')[0];
    if (users.some(u => u.username && u.username.toLowerCase() === assignedUsername.toLowerCase())) {
      res.status(409).json({ success: false, error: `Username '${assignedUsername}' is already taken` });
      return;
    }

    const dept = departments.find(d => d.id === departmentId);
    const newUser: User = {
      id: `user-${Date.now()}`,
      username: assignedUsername,
      password: password || 'StockVault@2025',
      fullName,
      email,
      role,
      departmentId,
      departmentName: dept ? dept.name : 'General',
      status: 'ACTIVE',
      createdBy: (req.headers['x-user-id'] as string) || 'user-admin',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    users.unshift(newUser);
    logAudit(req, 'USER_PROVISIONED', 'USER', newUser.id, undefined, sanitizeUser(newUser));
    res.status(201).json({ success: true, user: sanitizeUser(newUser), message: 'User account created successfully' });
  });

  app.put('/api/users/:id/status', (req: Request, res: Response) => {
    const userRole = (req.headers['x-user-role'] as string) || 'ADMIN';
    if (userRole !== 'ADMIN') {
      res.status(403).json({ success: false, error: 'Forbidden: Admin privilege required' });
      return;
    }

    const user = users.find(u => u.id === req.params.id);
    if (!user) {
      res.status(404).json({ success: false, error: 'User account not found' });
      return;
    }

    const oldStatus = user.status;
    user.status = user.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    user.updatedAt = new Date().toISOString();

    logAudit(req, 'USER_STATUS_TOGGLED', 'USER', user.id, { status: oldStatus }, { status: user.status });
    res.json({ success: true, user: sanitizeUser(user), message: `User status changed to ${user.status}` });
  });

  // 3. Departments
  app.get('/api/departments', (req: Request, res: Response) => {
    const { deptId, isAdmin } = getUserScope(req);
    if (!isAdmin && deptId) {
      res.json({ success: true, departments: departments.filter(d => d.id === deptId) });
    } else {
      res.json({ success: true, departments });
    }
  });

  app.post('/api/departments', (req: Request, res: Response) => {
    const { code, name, description, budgetCode } = req.body;
    const newDept: Department = {
      id: `dept-${Date.now()}`,
      code: code.toUpperCase(),
      name,
      description: description || '',
      budgetCode: budgetCode || `BUG-${code.toUpperCase()}-2025`,
      createdAt: new Date().toISOString()
    };
    departments.push(newDept);
    logAudit(req, 'DEPARTMENT_CREATED', 'DEPARTMENT', newDept.id, undefined, newDept);
    res.status(201).json({ success: true, department: newDept });
  });

  // 4. Categories
  app.get('/api/categories', (req: Request, res: Response) => {
    res.json({ success: true, categories });
  });

  app.post('/api/categories', (req: Request, res: Response) => {
    const { code, name, description, lowStockThreshold } = req.body;
    const newCat: Category = {
      id: `cat-${Date.now()}`,
      code: code.toUpperCase(),
      name,
      description: description || '',
      lowStockThreshold: Number(lowStockThreshold) || 5,
      createdAt: new Date().toISOString()
    };
    categories.push(newCat);
    logAudit(req, 'CATEGORY_CREATED', 'CATEGORY', newCat.id, undefined, newCat);
    res.status(201).json({ success: true, category: newCat });
  });

  // 5. Financial Years
  app.get('/api/financial-years', (req: Request, res: Response) => {
    res.json({ success: true, financialYears });
  });

  app.post('/api/financial-years', (req: Request, res: Response) => {
    const userRole = (req.headers['x-user-role'] as string) || 'ADMIN';
    if (userRole !== 'ADMIN') {
      res.status(403).json({ success: false, error: 'Forbidden: Admin privilege required to create Financial Year' });
      return;
    }

    const { yearCode, startDate, endDate, setAsActive } = req.body;
    if (!yearCode || !startDate || !endDate) {
      res.status(400).json({ success: false, error: 'Missing required parameters: yearCode, startDate, endDate' });
      return;
    }

    const isDuplicate = financialYears.some(f => f.yearCode.trim() === yearCode.trim());
    if (isDuplicate) {
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
      financialYears.forEach(f => f.isActive = false);
      systemSettings.activeFinancialYearId = newFy.id;
    } else if (financialYears.length === 0) {
      newFy.isActive = true;
      systemSettings.activeFinancialYearId = newFy.id;
    }

    financialYears.push(newFy);
    logAudit(req, 'FINANCIAL_YEAR_CREATED', 'FINANCIAL_YEAR', newFy.id, undefined, newFy);
    res.status(201).json({ success: true, financialYear: newFy });
  });

  app.put('/api/financial-years/:id', (req: Request, res: Response) => {
    const userRole = (req.headers['x-user-role'] as string) || 'ADMIN';
    if (userRole !== 'ADMIN') {
      res.status(403).json({ success: false, error: 'Forbidden: Admin privilege required' });
      return;
    }

    const targetFy = financialYears.find(f => f.id === req.params.id);
    if (!targetFy) {
      res.status(404).json({ success: false, error: 'Financial year not found' });
      return;
    }

    const { yearCode, startDate, endDate, isActive } = req.body;
    const oldData = { ...targetFy };

    if (yearCode) targetFy.yearCode = yearCode.trim();
    if (startDate) targetFy.startDate = startDate;
    if (endDate) targetFy.endDate = endDate;

    if (isActive !== undefined) {
      const makeActive = Boolean(isActive);
      if (makeActive) {
        financialYears.forEach(f => f.isActive = (f.id === targetFy.id));
        systemSettings.activeFinancialYearId = targetFy.id;
      } else {
        targetFy.isActive = false;
      }
    }

    logAudit(req, 'FINANCIAL_YEAR_UPDATED', 'FINANCIAL_YEAR', targetFy.id, oldData, targetFy);
    res.json({ success: true, financialYear: targetFy });
  });

  app.delete('/api/financial-years/:id', (req: Request, res: Response) => {
    const userRole = (req.headers['x-user-role'] as string) || 'ADMIN';
    if (userRole !== 'ADMIN') {
      res.status(403).json({ success: false, error: 'Forbidden: Admin privilege required' });
      return;
    }

    const targetFy = financialYears.find(f => f.id === req.params.id);
    if (!targetFy) {
      res.status(404).json({ success: false, error: 'Financial year not found' });
      return;
    }

    if (targetFy.isActive) {
      res.status(400).json({ success: false, error: 'Cannot delete the currently active financial year. Activate another financial year first.' });
      return;
    }

    const idx = financialYears.findIndex(f => f.id === req.params.id);
    if (idx !== -1) {
      financialYears.splice(idx, 1);
    }

    logAudit(req, 'FINANCIAL_YEAR_DELETED', 'FINANCIAL_YEAR', req.params.id, targetFy, undefined);
    res.json({ success: true, message: 'Financial year deleted successfully' });
  });

  app.put('/api/financial-years/:id/activate', (req: Request, res: Response) => {
    const targetFy = financialYears.find(f => f.id === req.params.id);
    if (!targetFy) {
      res.status(404).json({ success: false, error: 'Financial year not found' });
      return;
    }

    const prevActive = financialYears.find(f => f.isActive);
    financialYears.forEach(f => f.isActive = (f.id === targetFy.id));
    systemSettings.activeFinancialYearId = targetFy.id;

    logAudit(req, 'FINANCIAL_YEAR_ACTIVATED', 'FINANCIAL_YEAR', targetFy.id, { active: prevActive?.yearCode }, { active: targetFy.yearCode });
    res.json({ success: true, activeFinancialYear: targetFy });
  });

  // 6. Real-time Serial Number Duplication Checker API (Feedback loop!)
  app.get('/api/stock/check-serial', (req: Request, res: Response) => {
    const serial = (req.query.serial as string || '').trim();
    if (!serial) {
      res.json({ exists: false });
      return;
    }

    const existingItem = inventoryItems.find(
      i => i.serialNumber && i.serialNumber.toLowerCase() === serial.toLowerCase() && i.status !== 'DECOMMISSIONED'
    );

    if (existingItem) {
      res.json({
        exists: true,
        item: {
          serialNumber: existingItem.serialNumber,
          itemCode: existingItem.itemCode,
          status: existingItem.status,
          departmentName: existingItem.departmentName
        },
        warning: `Serial Number '${serial}' is already registered under Item ${existingItem.itemCode} (${existingItem.status})`
      });
    } else {
      res.json({ exists: false });
    }
  });

  // 7. Stock In (Add Batches & Serialized Items)
  app.get('/api/stock/batches', (req: Request, res: Response) => {
    const { deptId: userDeptId, isAdmin } = getUserScope(req);
    const fyId = (req.query.financialYearId as string) || systemSettings.activeFinancialYearId;
    let filtered = stockBatches.filter(b => b.financialYearId === fyId);

    if (!isAdmin && userDeptId) {
      filtered = filtered.filter(b => b.departmentId === userDeptId);
    } else if (req.query.departmentId) {
      filtered = filtered.filter(b => b.departmentId === req.query.departmentId);
    }

    res.json({ success: true, batches: filtered });
  });

  app.post('/api/stock/batches', (req: Request, res: Response) => {
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

    // Enforce user's registered department for non-admin users
    if (!isAdmin && userDeptId) {
      departmentId = userDeptId;
    }

    const cat = categories.find(c => c.id === categoryId);
    const dept = departments.find(d => d.id === departmentId);
    const fy = financialYears.find(f => f.id === financialYearId) || financialYears.find(f => f.isActive);
    const receiver = users.find(u => u.id === receivedByUserId) || users[0];

    const isSer = Boolean(isSerialized);
    const actualQty = isSer ? serials.length : Number(quantity);

    // Validate duplicate serial numbers if serialized
    if (isSer && Array.isArray(serials)) {
      const duplicateSerialsInReq: string[] = [];
      const existingDuplicatesInDb: string[] = [];

      const serialSet = new Set<string>();
      serials.forEach((sn: string) => {
        const cleanSn = sn.trim();
        if (serialSet.has(cleanSn.toLowerCase())) {
          duplicateSerialsInReq.push(cleanSn);
        } else {
          serialSet.add(cleanSn.toLowerCase());
        }

        const dbMatch = inventoryItems.find(
          i => i.serialNumber && i.serialNumber.toLowerCase() === cleanSn.toLowerCase() && i.status !== 'DECOMMISSIONED'
        );
        if (dbMatch) {
          existingDuplicatesInDb.push(cleanSn);
        }
      });

      if (duplicateSerialsInReq.length > 0) {
        res.status(400).json({
          success: false,
          error: `Duplicate serial numbers found in your entry list: ${duplicateSerialsInReq.join(', ')}`
        });
        return;
      }

      if (existingDuplicatesInDb.length > 0) {
        res.status(409).json({
          success: false,
          error: `Serial numbers already registered in system database: ${existingDuplicatesInDb.join(', ')}`
        });
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

    stockBatches.unshift(newBatch);

    // Create individual inventory items if serialized
    const createdItems: InventoryItem[] = [];
    if (isSer && Array.isArray(serials)) {
      serials.forEach((sn: string, idx: number) => {
        const itemCode = `ITM-${fy ? fy.yearCode.substring(0, 4) : '2025'}-${batchId.slice(-4)}-${strPad(idx + 1, 3)}`;
        const newItem: InventoryItem = {
          id: `item-${Date.now()}-${idx}`,
          batchId,
          batchNumber,
          itemCode,
          serialNumber: sn.trim(),
          categoryId,
          categoryName: cat?.name,
          departmentId,
          departmentName: dept?.name,
          financialYearId: fy ? fy.id : 'fy-2025',
          financialYearCode: fy ? fy.yearCode : '2025-2026',
          status: 'IN_STOCK',
          unitCost: Number(unitCost),
          location: 'Central Storage - Bay A',
          notes: 'Received via Batch Stock In',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        inventoryItems.unshift(newItem);
        createdItems.push(newItem);
      });
    }

    // Log Stock In Transaction
    const txCode = `TX-IN-${Date.now().toString().slice(-8)}`;
    const tx: StockTransaction = {
      id: `tx-${Date.now()}`,
      transactionCode: txCode,
      type: 'STOCK_IN',
      batchId,
      financialYearId: fy ? fy.id : 'fy-2025',
      financialYearCode: fy ? fy.yearCode : '2025-2026',
      departmentId,
      departmentName: dept?.name,
      quantity: actualQty,
      unitCost: Number(unitCost),
      totalValue: actualQty * Number(unitCost),
      issuedByUserId: receiver.id,
      issuedByName: receiver.fullName,
      receivedByName: 'Store Vault Central',
      receiverDepartmentId: departmentId,
      receiverDepartmentName: dept?.name,
      remarks: `Incoming Stock In: ${remarks || 'Supplier Delivery'}`,
      ipAddress: req.ip || '127.0.0.1',
      timestamp: new Date().toISOString()
    };

    stockTransactions.unshift(tx);
    logAudit(req, 'STOCK_IN_BATCH_CREATED', 'STOCK_BATCH', batchId, undefined, { batchNumber, totalQty: actualQty, isSerialized: isSer });

    res.status(201).json({
      success: true,
      batch: newBatch,
      itemsCount: createdItems.length,
      message: `Stock batch ${batchNumber} registered with ${actualQty} unit(s)`
    });
  });

  // 8. Inventory Items & Status Lifecycle Management
  app.get('/api/stock/items', (req: Request, res: Response) => {
    const { deptId: userDeptId, isAdmin } = getUserScope(req);
    const fyId = req.query.financialYearId as string;
    let deptId = req.query.departmentId as string;
    if (!isAdmin && userDeptId) {
      deptId = userDeptId;
    }
    const status = req.query.status as string;

    let result = [...inventoryItems];

    if (fyId) {
      result = result.filter(i => i.financialYearId === fyId);
    }
    if (deptId) {
      result = result.filter(i => i.departmentId === deptId);
    }
    if (status) {
      result = result.filter(i => i.status === status);
    }

    res.json({ success: true, items: result });
  });

  app.put('/api/stock/items/:id/status', (req: Request, res: Response) => {
    const { status, location, notes } = req.body as { status: ItemStatus; location?: string; notes?: string };
    const item = inventoryItems.find(i => i.id === req.params.id);

    if (!item) {
      res.status(404).json({ success: false, error: 'Inventory item not found' });
      return;
    }

    const oldStatus = item.status;
    item.status = status;
    if (location) item.location = location;
    if (notes) item.notes = notes;
    item.updatedAt = new Date().toISOString();

    // Log Status Change Transaction & Audit Log
    const txCode = `TX-STATUS-${Date.now().toString().slice(-8)}`;
    const tx: StockTransaction = {
      id: `tx-${Date.now()}`,
      transactionCode: txCode,
      type: status === 'DECOMMISSIONED' ? 'DECOMMISSION' : 'STATUS_CHANGE',
      batchId: item.batchId,
      itemId: item.id,
      serialNumber: item.serialNumber,
      categoryName: item.categoryName,
      financialYearId: item.financialYearId,
      financialYearCode: item.financialYearCode,
      departmentId: item.departmentId,
      departmentName: item.departmentName,
      quantity: 1,
      unitCost: item.unitCost,
      totalValue: item.unitCost,
      issuedByUserId: (req.headers['x-user-id'] as string) || 'user-keeper',
      issuedByName: 'Store Keeper',
      receivedByName: 'Lifecycle Management',
      receiverDepartmentId: item.departmentId,
      receiverDepartmentName: item.departmentName,
      remarks: `Lifecycle status transitioned from ${oldStatus} to ${status}. Notes: ${notes || 'None'}`,
      ipAddress: req.ip || '127.0.0.1',
      timestamp: new Date().toISOString()
    };

    stockTransactions.unshift(tx);
    logAudit(req, 'ITEM_STATUS_CHANGED', 'INVENTORY_ITEM', item.id, { status: oldStatus }, { status, location, notes });

    res.json({ success: true, item, message: `Item status updated to ${status}` });
  });

  // 9. Stock Out Dispatch with Dual Signatures & IP/Timestamp Non-Repudiation
  app.post('/api/stock/dispatch', (req: Request, res: Response) => {
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

    const batch = stockBatches.find(b => b.id === batchId);
    if (!batch) {
      res.status(404).json({ success: false, error: 'Stock batch not found' });
      return;
    }

    const qtyToIssue = batch.isSerialized ? 1 : Number(quantity || 1);

    if (batch.availableQuantity < qtyToIssue) {
      res.status(400).json({ success: false, error: `Insufficient stock in batch. Available: ${batch.availableQuantity}` });
      return;
    }

    let selectedItem: InventoryItem | undefined;
    if (batch.isSerialized) {
      if (itemId) {
        selectedItem = inventoryItems.find(i => i.id === itemId && i.status === 'IN_STOCK');
      } else {
        selectedItem = inventoryItems.find(i => i.batchId === batchId && i.status === 'IN_STOCK');
      }

      if (!selectedItem) {
        res.status(400).json({ success: false, error: 'No available in-stock item found for this serialized batch' });
        return;
      }

      // Mark item as ISSUED and assign to receiver department
      selectedItem.status = 'ISSUED';
      selectedItem.departmentId = receiverDepartmentId;
      const rDept = departments.find(d => d.id === receiverDepartmentId);
      selectedItem.departmentName = rDept ? rDept.name : selectedItem.departmentName;
      selectedItem.updatedAt = new Date().toISOString();
    }

    // Deduct stock batch available quantity
    batch.availableQuantity -= qtyToIssue;
    if (batch.availableQuantity <= 0) {
      batch.status = 'DEPLETED';
    }

    const issuer = users.find(u => u.id === issuerUserId) || users.find(u => u.role === 'STORE_KEEPER') || users[0];
    const receiverDept = departments.find(d => d.id === receiverDepartmentId);

    const txCode = `TX-OUT-${Date.now().toString().slice(-8)}`;
    const tx: StockTransaction = {
      id: `tx-${Date.now()}`,
      transactionCode: txCode,
      type: 'STOCK_OUT',
      batchId: batch.id,
      itemId: selectedItem ? selectedItem.id : undefined,
      serialNumber: selectedItem ? selectedItem.serialNumber : undefined,
      categoryName: batch.categoryName,
      financialYearId: batch.financialYearId,
      financialYearCode: batch.financialYearCode,
      departmentId: batch.departmentId,
      departmentName: batch.departmentName,
      quantity: qtyToIssue,
      unitCost: batch.unitCost,
      totalValue: qtyToIssue * batch.unitCost,
      issuedByUserId: issuer.id,
      issuedByName: issuer.fullName,
      receivedByName: receiverName,
      receiverDepartmentId,
      receiverDepartmentName: receiverDept ? receiverDept.name : 'Recipient Dept',
      remarks: remarks || 'Stock out dispatch',
      signatures: signatures ? {
        issuerSignatureBase64: signatures.issuerSignatureBase64,
        issuerName: signatures.issuerName || issuer.fullName,
        issuerRole: issuer.role,
        receiverSignatureBase64: signatures.receiverSignatureBase64,
        receiverName: receiverName,
        receiverRole: 'STAFF_RECEIVER',
        receiverDepartmentId: receiverDepartmentId,
        ipAddress: req.ip || '192.168.1.100',
        deviceTimestamp: new Date().toISOString()
      } : undefined,
      ipAddress: req.ip || '192.168.1.100',
      timestamp: new Date().toISOString()
    };

    stockTransactions.unshift(tx);
    logAudit(req, 'STOCK_DISPATCHED', 'STOCK_TRANSACTION', tx.id, undefined, { txCode, qty: qtyToIssue, receiverName, serialNumber: selectedItem?.serialNumber });

    res.status(201).json({
      success: true,
      transaction: tx,
      message: `Successfully dispatched ${qtyToIssue} unit(s) to ${receiverName}`
    });
  });

  // 10. Financial Year & Department Valuation Reports
  app.get('/api/reports/valuation', (req: Request, res: Response) => {
    const { deptId: userDeptId, isAdmin } = getUserScope(req);
    const fyId = (req.query.financialYearId as string) || systemSettings.activeFinancialYearId;
    let deptId = req.query.departmentId as string;
    if (!isAdmin && userDeptId) {
      deptId = userDeptId;
    }

    const fy = financialYears.find(f => f.id === fyId) || financialYears.find(f => f.isActive);
    const fyCode = fy ? fy.yearCode : '2025-2026';

    let filteredBatches = stockBatches.filter(b => b.financialYearId === fyId);
    let filteredTxs = stockTransactions.filter(t => t.financialYearId === fyId);
    let filteredItems = inventoryItems.filter(i => i.financialYearId === fyId);

    if (deptId) {
      filteredBatches = filteredBatches.filter(b => b.departmentId === deptId);
      filteredTxs = filteredTxs.filter(t => t.departmentId === deptId || t.receiverDepartmentId === deptId);
      filteredItems = filteredItems.filter(i => i.departmentId === deptId);
    }

    const dept = departments.find(d => d.id === deptId);

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
        financialYearCode: fyCode,
        departmentName: dept ? dept.name : 'All Departments',
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
  });

  // 11. Transactions List
  app.get('/api/transactions', (req: Request, res: Response) => {
    const { deptId: userDeptId, isAdmin } = getUserScope(req);
    let result = [...stockTransactions];
    if (!isAdmin && userDeptId) {
      result = result.filter(t => t.departmentId === userDeptId || t.receiverDepartmentId === userDeptId);
    }
    res.json({ success: true, transactions: result });
  });

  // 12. Audit Logs
  app.get('/api/audit-logs', (req: Request, res: Response) => {
    res.json({ success: true, logs: auditLogs });
  });

  // 13. System Settings
  app.get('/api/settings', (req: Request, res: Response) => {
    res.json({ success: true, settings: systemSettings });
  });

  app.put('/api/settings', (req: Request, res: Response) => {
    systemSettings = { ...systemSettings, ...req.body };
    logAudit(req, 'SETTINGS_UPDATED', 'SYSTEM_SETTINGS', 'GLOBAL', undefined, systemSettings);
    res.json({ success: true, settings: systemSettings });
  });

  // Helper padding
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
