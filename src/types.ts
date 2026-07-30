export type UserRole = 'ADMIN' | 'STORE_KEEPER' | 'STAFF_RECEIVER';

export interface User {
  id: string;
  username?: string;
  password?: string;
  role: UserRole;
  fullName: string;
  email: string;
  departmentId: string;
  departmentName?: string;
  status: 'ACTIVE' | 'INACTIVE';
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Department {
  id: string;
  code: string;
  name: string;
  description: string;
  budgetCode: string;
  createdAt: string;
}

export interface Category {
  id: string;
  code: string;
  name: string;
  description: string;
  lowStockThreshold: number;
  createdAt: string;
}

export interface FinancialYear {
  id: string;
  yearCode: string; // e.g. "2025-2026"
  startDate: string;
  endDate: string;
  isActive: boolean;
  createdAt: string;
}

export type ItemStatus = 'IN_STOCK' | 'ISSUED' | 'UNDER_MAINTENANCE' | 'DECOMMISSIONED';

export interface StockBatch {
  id: string;
  batchNumber: string;
  categoryId: string;
  categoryName?: string;
  departmentId: string;
  departmentName?: string;
  financialYearId: string;
  financialYearCode?: string;
  supplierName: string;
  unitCost: number;
  isSerialized: boolean;
  totalQuantity: number;
  availableQuantity: number;
  receivedByUserId: string;
  receivedByName?: string;
  status: 'ACTIVE' | 'DEPLETED' | 'CLOSED';
  remarks?: string;
  createdAt: string;
}

export interface InventoryItem {
  id: string;
  batchId: string;
  batchNumber?: string;
  itemCode: string;
  serialNumber?: string;
  categoryId: string;
  categoryName?: string;
  departmentId: string;
  departmentName?: string;
  financialYearId: string;
  financialYearCode?: string;
  status: ItemStatus;
  unitCost: number;
  location?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type TransactionType = 'STOCK_IN' | 'STOCK_OUT' | 'REPLENISHMENT' | 'STATUS_CHANGE' | 'DECOMMISSION';

export interface SignatureData {
  id?: string;
  transactionId?: string;
  issuerSignatureBase64: string;
  issuerName: string;
  issuerRole: string;
  receiverSignatureBase64: string;
  receiverName: string;
  receiverRole: string;
  receiverDepartmentId?: string;
  ipAddress: string;
  deviceTimestamp: string;
}

export interface StockTransaction {
  id: string;
  transactionCode: string;
  type: TransactionType;
  batchId?: string;
  itemId?: string;
  serialNumber?: string;
  categoryName?: string;
  financialYearId: string;
  financialYearCode?: string;
  departmentId: string;
  departmentName?: string;
  quantity: number;
  unitCost: number;
  totalValue: number;
  issuedByUserId: string;
  issuedByName: string;
  receivedByName: string;
  receiverDepartmentId: string;
  receiverDepartmentName?: string;
  remarks: string;
  signatures?: SignatureData;
  ipAddress: string;
  timestamp: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  userRole: UserRole;
  action: string;
  entityType: string;
  entityId: string;
  oldValues?: string;
  newValues?: string;
  ipAddress: string;
  userAgent?: string;
  createdAt: string;
}

export interface SystemSettings {
  lowStockGlobalThreshold: number;
  activeFinancialYearId: string;
  companyName: string;
  requireDualSignatures: boolean;
  phpApiBaseUrl: string;
  phpBridgeMode: boolean; // whether to simulate or forward to PHP API
  currencyCode: string; // e.g. 'SZL'
  currencySymbol: string; // e.g. 'E'
  currencyName: string; // e.g. 'Eswatini Lilangeni'
}

export interface DashboardMetrics {
  totalInventoryValuation: number;
  totalItemsCount: number;
  totalSerializedCount: number;
  lowStockAlertsCount: number;
  activeFinancialYear: string;
  pendingDispatchesCount: number;
  monthlyStockInValue: number;
  monthlyStockOutValue: number;
  departmentBreakdown: { departmentName: string; count: number; value: number }[];
  categoryBreakdown: { categoryName: string; count: number; value: number }[];
}

export interface ReportFilter {
  financialYearId: string;
  departmentId?: string;
  categoryId?: string;
  startDate?: string;
  endDate?: string;
}

export interface ReportSummary {
  financialYearCode: string;
  departmentName: string;
  totalIncomingQuantity: number;
  totalIncomingValue: number;
  totalOutgoingQuantity: number;
  totalOutgoingValue: number;
  remainingStockCount: number;
  remainingStockValue: number;
  itemsUnderMaintenance: number;
  decommissionedItems: number;
  generatedAt: string;
}
