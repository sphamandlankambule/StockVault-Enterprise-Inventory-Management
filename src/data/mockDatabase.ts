import {
  User,
  Department,
  Category,
  FinancialYear,
  StockBatch,
  InventoryItem,
  StockTransaction,
  AuditLog,
  SystemSettings
} from '../types';

export const INITIAL_DEPARTMENTS: Department[] = [
  { id: 'dept-1', code: 'IT', name: 'Information Technology', description: 'Enterprise Infrastructure & Hardware', budgetCode: 'BUG-IT-2025', createdAt: '2025-04-01T08:00:00Z' },
  { id: 'dept-2', code: 'LOG', name: 'Logistics & Warehouse', description: 'Central Receiving & Material Dispatch', budgetCode: 'BUG-LOG-2025', createdAt: '2025-04-01T08:00:00Z' },
  { id: 'dept-3', code: 'FIN', name: 'Finance & Accounting', description: 'Financial Auditing & Asset Valuation', budgetCode: 'BUG-FIN-2025', createdAt: '2025-04-01T08:00:00Z' },
  { id: 'dept-4', code: 'HR', name: 'Human Resources', description: 'Talent Management & Operations', budgetCode: 'BUG-HR-2025', createdAt: '2025-04-01T08:00:00Z' },
  { id: 'dept-5', code: 'OPS', name: 'Operations & Facilities', description: 'Facilities Management & Fleet', budgetCode: 'BUG-OPS-2025', createdAt: '2025-04-01T08:00:00Z' },
];

export const INITIAL_CATEGORIES: Category[] = [
  { id: 'cat-1', code: 'COMP', name: 'Computers & Laptops', description: 'Laptops, Workstations, Desktops & Servers', lowStockThreshold: 5, createdAt: '2025-04-01T08:00:00Z' },
  { id: 'cat-2', code: 'NET', name: 'Networking Equipment', description: 'Switches, Routers, Access Points & Cables', lowStockThreshold: 3, createdAt: '2025-04-01T08:00:00Z' },
  { id: 'cat-3', code: 'PRN', name: 'Printers & Cartridges', description: 'Enterprise Laser Printers & High-Yield Toner', lowStockThreshold: 10, createdAt: '2025-04-01T08:00:00Z' },
  { id: 'cat-4', code: 'STAT', name: 'Office Stationery', description: 'Paper, Binders & Desk Essentials', lowStockThreshold: 20, createdAt: '2025-04-01T08:00:00Z' },
  { id: 'cat-5', code: 'FUR', name: 'Furniture & Fixtures', description: 'Ergonomic Chairs, Executive Desks', lowStockThreshold: 4, createdAt: '2025-04-01T08:00:00Z' },
];

export const INITIAL_FINANCIAL_YEARS: FinancialYear[] = [
  { id: 'fy-2024', yearCode: '2024-2025', startDate: '2024-04-01', endDate: '2025-03-31', isActive: false, createdAt: '2024-04-01T00:00:00Z' },
  { id: 'fy-2025', yearCode: '2025-2026', startDate: '2025-04-01', endDate: '2026-03-31', isActive: true, createdAt: '2025-04-01T00:00:00Z' },
  { id: 'fy-2026', yearCode: '2026-2027', startDate: '2026-04-01', endDate: '2027-03-31', isActive: false, createdAt: '2026-04-01T00:00:00Z' },
];

export const INITIAL_USERS: User[] = [
  {
    id: 'user-admin',
    username: 'Admin',
    password: 'Admin@123',
    role: 'ADMIN',
    fullName: 'David Sterling (System Director)',
    email: 'admin@stockvault.com',
    departmentId: 'dept-1',
    departmentName: 'Information Technology',
    status: 'ACTIVE',
    createdBy: 'SYSTEM_ROOT',
    createdAt: '2025-04-01T09:00:00Z',
    updatedAt: '2025-04-01T09:00:00Z'
  },
  {
    id: 'user-keeper',
    username: 'Keeper',
    password: 'Keeper@123',
    role: 'STORE_KEEPER',
    fullName: 'Marcus Vance (Chief Store Keeper)',
    email: 'marcus.vance@stockvault.com',
    departmentId: 'dept-2',
    departmentName: 'Logistics & Warehouse',
    status: 'ACTIVE',
    createdBy: 'user-admin',
    createdAt: '2025-04-02T10:15:00Z',
    updatedAt: '2025-04-02T10:15:00Z'
  },
  {
    id: 'user-receiver',
    username: 'Staff',
    password: 'Staff@123',
    role: 'STAFF_RECEIVER',
    fullName: 'Sarah Jenkins (Finance Lead Receiver)',
    email: 'sarah.jenkins@stockvault.com',
    departmentId: 'dept-3',
    departmentName: 'Finance & Accounting',
    status: 'ACTIVE',
    createdBy: 'user-admin',
    createdAt: '2025-04-03T11:30:00Z',
    updatedAt: '2025-04-03T11:30:00Z'
  },
  {
    id: 'user-hr',
    role: 'STAFF_RECEIVER',
    fullName: 'Robert Chen (HR Operations Specialist)',
    email: 'robert.chen@stockvault.com',
    departmentId: 'dept-4',
    departmentName: 'Human Resources',
    status: 'ACTIVE',
    createdBy: 'user-admin',
    createdAt: '2025-04-05T14:20:00Z',
    updatedAt: '2025-04-05T14:20:00Z'
  }
];

export const INITIAL_BATCHES: StockBatch[] = [
  {
    id: 'batch-1',
    batchNumber: 'BAT-2025-COMP-001',
    categoryId: 'cat-1',
    categoryName: 'Computers & Laptops',
    departmentId: 'dept-1',
    departmentName: 'Information Technology',
    financialYearId: 'fy-2025',
    financialYearCode: '2025-2026',
    supplierName: 'Dell Enterprise Solutions Ltd',
    unitCost: 1250.00,
    isSerialized: true,
    totalQuantity: 10,
    availableQuantity: 7,
    receivedByUserId: 'user-keeper',
    receivedByName: 'Marcus Vance (Chief Store Keeper)',
    status: 'ACTIVE',
    remarks: 'Dell Latitude 5540 i7 16GB 512GB SSD Batch',
    createdAt: '2025-04-10T09:00:00Z'
  },
  {
    id: 'batch-2',
    batchNumber: 'BAT-2025-NET-002',
    categoryId: 'cat-2',
    categoryName: 'Networking Equipment',
    departmentId: 'dept-1',
    departmentName: 'Information Technology',
    financialYearId: 'fy-2025',
    financialYearCode: '2025-2026',
    supplierName: 'Cisco Global Systems',
    unitCost: 2800.00,
    isSerialized: true,
    totalQuantity: 5,
    availableQuantity: 3,
    receivedByUserId: 'user-keeper',
    receivedByName: 'Marcus Vance (Chief Store Keeper)',
    status: 'ACTIVE',
    remarks: 'Cisco Catalyst 9300 48-Port Switches',
    createdAt: '2025-04-12T11:30:00Z'
  },
  {
    id: 'batch-3',
    batchNumber: 'BAT-2025-STAT-003',
    categoryId: 'cat-4',
    categoryName: 'Office Stationery',
    departmentId: 'dept-2',
    departmentName: 'Logistics & Warehouse',
    financialYearId: 'fy-2025',
    financialYearCode: '2025-2026',
    supplierName: 'Staples Industrial Supply',
    unitCost: 45.00,
    isSerialized: false,
    totalQuantity: 50,
    availableQuantity: 18, // Low stock trigger!
    receivedByUserId: 'user-keeper',
    receivedByName: 'Marcus Vance (Chief Store Keeper)',
    status: 'ACTIVE',
    remarks: 'A4 Premium Multipurpose Paper Boxes (50 Rims)',
    createdAt: '2025-04-15T14:00:00Z'
  },
  {
    id: 'batch-4',
    batchNumber: 'BAT-2025-PRN-004',
    categoryId: 'cat-3',
    categoryName: 'Printers & Cartridges',
    departmentId: 'dept-1',
    departmentName: 'Information Technology',
    financialYearId: 'fy-2025',
    financialYearCode: '2025-2026',
    supplierName: 'HP Enterprise Business',
    unitCost: 890.00,
    isSerialized: true,
    totalQuantity: 4,
    availableQuantity: 2,
    receivedByUserId: 'user-keeper',
    receivedByName: 'Marcus Vance (Chief Store Keeper)',
    status: 'ACTIVE',
    remarks: 'HP LaserJet Enterprise M507x Printers',
    createdAt: '2025-04-18T16:10:00Z'
  }
];

export const INITIAL_ITEMS: InventoryItem[] = [
  // Batch 1 Items
  { id: 'item-1', batchId: 'batch-1', batchNumber: 'BAT-2025-COMP-001', itemCode: 'ITM-2025-001-01', serialNumber: 'SN-DELL-982101', categoryId: 'cat-1', categoryName: 'Computers & Laptops', departmentId: 'dept-1', departmentName: 'Information Technology', financialYearId: 'fy-2025', financialYearCode: '2025-2026', status: 'IN_STOCK', unitCost: 1250, location: 'Rack A1 - Bay 4', notes: 'Inspected and certified', createdAt: '2025-04-10T09:00:00Z', updatedAt: '2025-04-10T09:00:00Z' },
  { id: 'item-2', batchId: 'batch-1', batchNumber: 'BAT-2025-COMP-001', itemCode: 'ITM-2025-001-02', serialNumber: 'SN-DELL-982102', categoryId: 'cat-1', categoryName: 'Computers & Laptops', departmentId: 'dept-1', departmentName: 'Information Technology', financialYearId: 'fy-2025', financialYearCode: '2025-2026', status: 'IN_STOCK', unitCost: 1250, location: 'Rack A1 - Bay 4', notes: 'Inspected', createdAt: '2025-04-10T09:00:00Z', updatedAt: '2025-04-10T09:00:00Z' },
  { id: 'item-3', batchId: 'batch-1', batchNumber: 'BAT-2025-COMP-001', itemCode: 'ITM-2025-001-03', serialNumber: 'SN-DELL-982103', categoryId: 'cat-1', categoryName: 'Computers & Laptops', departmentId: 'dept-3', departmentName: 'Finance & Accounting', financialYearId: 'fy-2025', financialYearCode: '2025-2026', status: 'ISSUED', unitCost: 1250, location: 'Finance Desk F04', notes: 'Issued to Sarah Jenkins', createdAt: '2025-04-10T09:00:00Z', updatedAt: '2025-04-14T11:00:00Z' },
  { id: 'item-4', batchId: 'batch-1', batchNumber: 'BAT-2025-COMP-001', itemCode: 'ITM-2025-001-04', serialNumber: 'SN-DELL-982104', categoryId: 'cat-1', categoryName: 'Computers & Laptops', departmentId: 'dept-1', departmentName: 'Information Technology', financialYearId: 'fy-2025', financialYearCode: '2025-2026', status: 'UNDER_MAINTENANCE', unitCost: 1250, location: 'IT Repair Bench', notes: 'Keyboard replacement required', createdAt: '2025-04-10T09:00:00Z', updatedAt: '2025-04-19T09:30:00Z' },
  { id: 'item-5', batchId: 'batch-1', batchNumber: 'BAT-2025-COMP-001', itemCode: 'ITM-2025-001-05', serialNumber: 'SN-DELL-982105', categoryId: 'cat-1', categoryName: 'Computers & Laptops', departmentId: 'dept-1', departmentName: 'Information Technology', financialYearId: 'fy-2025', financialYearCode: '2025-2026', status: 'DECOMMISSIONED', unitCost: 1250, location: 'Scrap Locker', notes: 'Motherboard short circuit - Scrapped with audit approval', createdAt: '2025-04-10T09:00:00Z', updatedAt: '2025-04-22T15:00:00Z' },
  
  // Batch 2 Items
  { id: 'item-6', batchId: 'batch-2', batchNumber: 'BAT-2025-NET-002', itemCode: 'ITM-2025-002-01', serialNumber: 'SN-CISCO-44101', categoryId: 'cat-2', categoryName: 'Networking Equipment', departmentId: 'dept-1', departmentName: 'Information Technology', financialYearId: 'fy-2025', financialYearCode: '2025-2026', status: 'IN_STOCK', unitCost: 2800, location: 'Server Room - Bay 2', notes: '48 Port PoE Switch', createdAt: '2025-04-12T11:30:00Z', updatedAt: '2025-04-12T11:30:00Z' },
  { id: 'item-7', batchId: 'batch-2', batchNumber: 'BAT-2025-NET-002', itemCode: 'ITM-2025-002-02', serialNumber: 'SN-CISCO-44102', categoryId: 'cat-2', categoryName: 'Networking Equipment', departmentId: 'dept-1', departmentName: 'Information Technology', financialYearId: 'fy-2025', financialYearCode: '2025-2026', status: 'ISSUED', unitCost: 2800, location: 'Floor 3 Network Closet', notes: 'Deployed for Finance Floor', createdAt: '2025-04-12T11:30:00Z', updatedAt: '2025-04-16T10:00:00Z' },

  // Batch 4 Items
  { id: 'item-8', batchId: 'batch-4', batchNumber: 'BAT-2025-PRN-004', itemCode: 'ITM-2025-004-01', serialNumber: 'SN-HP-300101', categoryId: 'cat-3', categoryName: 'Printers & Cartridges', departmentId: 'dept-4', departmentName: 'Human Resources', financialYearId: 'fy-2025', financialYearCode: '2025-2026', status: 'ISSUED', unitCost: 890, location: 'HR Office Hallway', notes: 'Issued to Robert Chen', createdAt: '2025-04-18T16:10:00Z', updatedAt: '2025-04-20T11:15:00Z' },
  { id: 'item-9', batchId: 'batch-4', batchNumber: 'BAT-2025-PRN-004', itemCode: 'ITM-2025-004-02', serialNumber: 'SN-HP-300102', categoryId: 'cat-3', categoryName: 'Printers & Cartridges', departmentId: 'dept-1', departmentName: 'Information Technology', financialYearId: 'fy-2025', financialYearCode: '2025-2026', status: 'IN_STOCK', unitCost: 890, location: 'Rack B2', notes: 'Ready for deployment', createdAt: '2025-04-18T16:10:00Z', updatedAt: '2025-04-18T16:10:00Z' }
];

// Sample Dual Signature Base64 SVG mock data
const SAMPLE_ISSUER_SIG = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80"><path d="M10,40 Q50,10 90,50 T180,30" stroke="%232563eb" stroke-width="3" fill="none"/><text x="10" y="70" font-size="12" fill="%2364748b">Verified: Marcus Vance</text></svg>';
const SAMPLE_RECEIVER_SIG = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="80"><path d="M15,50 Q60,80 110,20 T170,60" stroke="%2316a34a" stroke-width="3" fill="none"/><text x="10" y="70" font-size="12" fill="%2364748b">Verified: Sarah Jenkins</text></svg>';

export const INITIAL_TRANSACTIONS: StockTransaction[] = [
  {
    id: 'tx-1',
    transactionCode: 'TX-IN-20250410-01',
    type: 'STOCK_IN',
    batchId: 'batch-1',
    financialYearId: 'fy-2025',
    financialYearCode: '2025-2026',
    departmentId: 'dept-1',
    departmentName: 'Information Technology',
    quantity: 10,
    unitCost: 1250,
    totalValue: 12500,
    issuedByUserId: 'user-keeper',
    issuedByName: 'Marcus Vance',
    receivedByName: 'Store Vault Central',
    receiverDepartmentId: 'dept-2',
    receiverDepartmentName: 'Logistics & Warehouse',
    remarks: 'Received 10x Dell Latitude 5540 Laptops with original vendor warranty',
    ipAddress: '192.168.1.104',
    timestamp: '2025-04-10T09:00:00Z'
  },
  {
    id: 'tx-2',
    transactionCode: 'TX-OUT-20250414-08',
    type: 'STOCK_OUT',
    batchId: 'batch-1',
    itemId: 'item-3',
    serialNumber: 'SN-DELL-982103',
    categoryName: 'Computers & Laptops',
    financialYearId: 'fy-2025',
    financialYearCode: '2025-2026',
    departmentId: 'dept-2',
    departmentName: 'Logistics & Warehouse',
    quantity: 1,
    unitCost: 1250,
    totalValue: 1250,
    issuedByUserId: 'user-keeper',
    issuedByName: 'Marcus Vance',
    receivedByName: 'Sarah Jenkins',
    receiverDepartmentId: 'dept-3',
    receiverDepartmentName: 'Finance & Accounting',
    remarks: 'Issued laptop for senior finance auditor onboarding',
    signatures: {
      issuerSignatureBase64: SAMPLE_ISSUER_SIG,
      issuerName: 'Marcus Vance',
      issuerRole: 'STORE_KEEPER',
      receiverSignatureBase64: SAMPLE_RECEIVER_SIG,
      receiverName: 'Sarah Jenkins',
      receiverRole: 'STAFF_RECEIVER',
      receiverDepartmentId: 'dept-3',
      ipAddress: '192.168.1.104',
      deviceTimestamp: '2025-04-14 11:00:15 UTC'
    },
    ipAddress: '192.168.1.104',
    timestamp: '2025-04-14T11:00:00Z'
  }
];

export const INITIAL_AUDIT_LOGS: AuditLog[] = [
  {
    id: 'audit-1',
    userId: 'user-admin',
    userName: 'David Sterling',
    userRole: 'ADMIN',
    action: 'USER_PROVISIONED',
    entityType: 'USER',
    entityId: 'user-keeper',
    newValues: '{"fullName":"Marcus Vance","role":"STORE_KEEPER","dept":"Logistics"}',
    ipAddress: '10.0.4.12',
    userAgent: 'Mozilla/5.0 (X11; Linux x86_64)',
    createdAt: '2025-04-02T10:15:00Z'
  },
  {
    id: 'audit-2',
    userId: 'user-keeper',
    userName: 'Marcus Vance',
    userRole: 'STORE_KEEPER',
    action: 'STOCK_IN_BATCH',
    entityType: 'STOCK_BATCH',
    entityId: 'batch-1',
    newValues: '{"batchNumber":"BAT-2025-COMP-001","qty":10,"unitCost":1250,"serialized":true}',
    ipAddress: '192.168.1.104',
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
    createdAt: '2025-04-10T09:00:00Z'
  },
  {
    id: 'audit-3',
    userId: 'user-keeper',
    userName: 'Marcus Vance',
    userRole: 'STORE_KEEPER',
    action: 'STOCK_DISPATCH_DUAL_SIG',
    entityType: 'STOCK_TRANSACTION',
    entityId: 'tx-2',
    newValues: '{"txCode":"TX-OUT-20250414-08","serial":"SN-DELL-982103","receiver":"Sarah Jenkins","dualSignaturesVerified":true}',
    ipAddress: '192.168.1.104',
    userAgent: 'Mozilla/5.0 (iPad; CPU OS 16_5 like Mac OS X)',
    createdAt: '2025-04-14T11:00:00Z'
  }
];

export const INITIAL_SETTINGS: SystemSettings = {
  lowStockGlobalThreshold: 5,
  activeFinancialYearId: 'fy-2025',
  companyName: 'StockVault Enterprise Global',
  requireDualSignatures: true,
  phpApiBaseUrl: 'http://localhost/stockvault/api',
  phpBridgeMode: false,
  currencyCode: 'SZL',
  currencySymbol: 'E',
  currencyName: 'Eswatini Lilangeni'
};
