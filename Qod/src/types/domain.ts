export type Role = 'owner' | 'admin' | 'manager' | 'cashier' | 'production' | 'inventory';

export type LocationId = 'home_bakery' | 'cafe';

export interface LocationInfo {
  id: LocationId;
  name: string;
  kind: string;
}

export interface Product {
  id: string;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  priceCents: number;
  isPublished: boolean;
  isAvailable: boolean;
  artIndex: number;
  sortOrder: number;
}

export type CustomerKind = 'individual' | 'organization';

export interface Customer {
  id: string;
  kind: CustomerKind;
  name: string;
  organization?: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
  createdAt: string;
  isWalkIn?: boolean;
}

export type OrderType = 'regular' | 'custom' | 'bulk' | 'organizational';

export type OrderStatus =
  | 'inquiry'
  | 'quoted'
  | 'confirmed'
  | 'in_production'
  | 'ready'
  | 'fulfilled'
  | 'cancelled';

export type OrderSource = 'pos' | 'bms' | 'website';

export interface OrderItem {
  id: string;
  productId?: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
}

export interface Order {
  id: string;
  code: string;
  type: OrderType;
  status: OrderStatus;
  source: OrderSource;
  customerId: string;
  items: OrderItem[];
  location: LocationId;
  deliveryLocation?: LocationId;
  deliveryDate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export type PaymentMethod = 'cash' | 'transfer' | 'card' | 'pos';

export type PaymentKind = 'payment' | 'refund';

export type PaymentRole = 'deposit' | 'partial' | 'final' | 'refund';

export interface Payment {
  id: string;
  orderId: string;
  customerId: string;
  kind: PaymentKind;
  role: PaymentRole;
  method: PaymentMethod;
  amountCents: number;
  location: LocationId;
  note?: string;
  createdAt: string;
}

export type ItemKind = 'raw' | 'packaging' | 'finished';

export type Unit = 'kg' | 'g' | 'l' | 'ml' | 'pcs';

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  kind: ItemKind;
  unit: Unit;
  costPerUnitCents: number;
  reorderLevel: number;
  productId?: string;
}

export interface StockLevel {
  itemId: string;
  location: LocationId;
  quantity: number;
}

export type MovementReason =
  | 'opening'
  | 'purchase_receipt'
  | 'production_consumption'
  | 'production_output'
  | 'sale'
  | 'return'
  | 'transfer_out'
  | 'transfer_in'
  | 'adjustment'
  | 'wastage';

export interface StockMovement {
  id: string;
  itemId: string;
  location: LocationId;
  quantityDelta: number;
  reason: MovementReason;
  refId?: string;
  note?: string;
  createdAt: string;
  createdBy: string;
}

export interface Supplier {
  id: string;
  name: string;
  contactName?: string;
  phone?: string;
  email?: string;
  notes?: string;
  createdAt: string;
}

export type PurchaseOrderStatus = 'ordered' | 'partially_received' | 'received' | 'cancelled';

export interface PurchaseOrderLine {
  itemId: string;
  quantity: number;
  unitCostCents: number;
}

export interface PurchaseOrder {
  id: string;
  code: string;
  supplierId: string;
  status: PurchaseOrderStatus;
  lines: PurchaseOrderLine[];
  expectedAt?: string;
  notes?: string;
  createdAt: string;
}

export interface PurchaseReceiptLine {
  itemId: string;
  quantity: number;
  unitCostCents: number;
}

export interface PurchaseReceipt {
  id: string;
  purchaseOrderId: string;
  supplierId: string;
  location: LocationId;
  lines: PurchaseReceiptLine[];
  receivedAt: string;
  receivedBy: string;
}

export interface SupplierPayment {
  id: string;
  supplierId: string;
  amountCents: number;
  method: PaymentMethod;
  note?: string;
  createdAt: string;
}

export interface RecipeLine {
  itemId: string;
  quantity: number;
}

export interface Recipe {
  id: string;
  productId: string;
  yieldQuantity: number;
  lines: RecipeLine[];
  notes?: string;
  updatedAt: string;
}

export type BatchStatus =
  | 'pending'
  | 'scheduled'
  | 'in_production'
  | 'quality_check'
  | 'completed'
  | 'ready'
  | 'cancelled';

export interface ProductionBatch {
  id: string;
  code: string;
  title: string;
  productId?: string;
  recipeId?: string;
  orderId?: string;
  quantity: number;
  location: LocationId;
  status: BatchStatus;
  assignedEmployeeId?: string;
  scheduledFor?: string;
  startedAt?: string;
  completedAt?: string;
  qualityNote?: string;
  notes?: string;
  createdAt: string;
}

export type TransferStatus = 'requested' | 'approved' | 'dispatched' | 'received' | 'cancelled';

export interface TransferLine {
  itemId: string;
  quantity: number;
}

export interface Transfer {
  id: string;
  code: string;
  from: LocationId;
  to: LocationId;
  lines: TransferLine[];
  status: TransferStatus;
  notes?: string;
  createdAt: string;
  dispatchedAt?: string;
  receivedAt?: string;
}

export interface Expense {
  id: string;
  category: 'ingredients' | 'packaging' | 'utilities' | 'rent' | 'salaries' | 'marketing' | 'other';
  amountCents: number;
  location: LocationId;
  note: string;
  incurredAt: string;
  recordedBy: string;
}

export interface Employee {
  id: string;
  name: string;
  email: string;
  password: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
}

export interface Message {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  subject: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

export interface SiteContent {
  heroEyebrow: string;
  heroTitle: string;
  heroLead: string;
  aboutTitle: string;
  aboutLead: string;
  aboutBody: string;
  customOrderNote: string;
  contactPhone: string;
  contactEmail: string;
  contactAddress: string;
  openingHours: string;
  galleryCaptions: string[];
}

export interface ActivityEntry {
  id: string;
  message: string;
  actor: string;
  createdAt: string;
}

export interface BusinessSettings {
  businessName: string;
  currency: string;
  tagline: string;
  locations: LocationInfo[];
}

export interface Database {
  version: number;
  products: Product[];
  customers: Customer[];
  orders: Order[];
  payments: Payment[];
  inventoryItems: InventoryItem[];
  stock: StockLevel[];
  movements: StockMovement[];
  suppliers: Supplier[];
  purchaseOrders: PurchaseOrder[];
  purchaseReceipts: PurchaseReceipt[];
  supplierPayments: SupplierPayment[];
  recipes: Recipe[];
  batches: ProductionBatch[];
  transfers: Transfer[];
  expenses: Expense[];
  employees: Employee[];
  messages: Message[];
  siteContent: SiteContent;
  settings: BusinessSettings;
  activity: ActivityEntry[];
  counters: Record<string, number>;
}

export interface SessionUser {
  employeeId: string;
  name: string;
  email: string;
  role: Role;
}
